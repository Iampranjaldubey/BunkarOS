// Bunkar OS — slip-audio handler tests (SPEC-015).
// Exercises handleSlipAudio via a tiny node:http server backed by a temp sqlite
// db, covering: RIFF header + duration bounds, 404 unknown, 410 expired, cache
// hit (second call reuses the stored blob), and 503 when the engine path is
// overridden to a missing file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openDb, indexSlip } from '../db.mjs';
import { handleSlipAudio } from '../slip-audio.mjs';

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123'; // ≥ 22 chars

function jsonError(res, status, error) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error }));
}

/** Spin up a tiny http server whose only route is the slip-audio handler. */
async function startServer(db, opts = {}) {
  const server = createServer((req, res) => {
    const m = req.url.match(/^\/api\/slips\/([^/]+)\/audio$/);
    if (!m) return jsonError(res, 404, 'not_found');
    const token = decodeURIComponent(m[1]);
    handleSlipAudio(req, res, { db, token, sendError: jsonError, ...opts }).catch((e) => {
      jsonError(res, 500, String(e && e.message));
    });
  });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((r) => server.close(r)) };
}

function makeDb() {
  const dir = mkdtempSync(join(tmpdir(), 'bunkar-tts-'));
  const db = openDb(join(dir, 'test.db'));
  return { db, dir };
}

function seedSlip(db, { token = TOKEN, createdAt = new Date().toISOString() } = {}) {
  indexSlip(db, {
    token,
    unitId: 'unit-1',
    slipId: 'bz-1',
    json: JSON.stringify({
      token, kind: 'bazaar', sourceId: 'bz-1', weaverId: 'w-1',
      weaverName: 'रफ़ीक़', weaverPhone: '9811111111',
      textHi: 'आपकी मजदूरी तैयार है।', textEn: 'Your wage is ready.',
      speechHi: 'रफ़ीक़ जी, नमस्ते। आपकी मजदूरी एक हज़ार नौ सौ पचपन रुपये। सही है तो सही दबाएँ, गलत है तो गलत दबाएँ।',
      lines: [],
    }),
    createdAt,
  });
}

function wavInfo(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return {
    riff: buf.toString('ascii', 0, 4),
    wave: buf.toString('ascii', 8, 12),
    channels: dv.getUint16(22, true),
    sampleRate: dv.getUint32(24, true),
    bits: dv.getUint16(34, true),
    dataLen: dv.getUint32(40, true),
  };
}

test('valid slip → 200 audio/wav, RIFF header, 2–60 s', async (t) => {
  const { db, dir } = makeDb();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  seedSlip(db);
  const srv = await startServer(db);
  t.after(() => srv.close());

  const res = await fetch(`${srv.base}/api/slips/${TOKEN}/audio`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /audio\/wav/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('cache-control') || '', /private/);
  const buf = Buffer.from(await res.arrayBuffer());
  const info = wavInfo(buf);
  assert.equal(info.riff, 'RIFF');
  assert.equal(info.wave, 'WAVE');
  assert.equal(info.channels, 1);
  assert.equal(info.sampleRate, 11025);
  assert.equal(info.bits, 16);
  const seconds = info.dataLen / 2 / info.sampleRate;
  assert.ok(seconds >= 2 && seconds <= 60, `duration ${seconds}s out of 2–60`);
});

test('unknown token → 404', async (t) => {
  const { db, dir } = makeDb();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const srv = await startServer(db);
  t.after(() => srv.close());
  const res = await fetch(`${srv.base}/api/slips/zzzzzzzzzzzzzzzzzzzzzzzzzz/audio`);
  assert.equal(res.status, 404);
});

test('slip older than 90 days → 410', async (t) => {
  const { db, dir } = makeDb();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const old = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
  seedSlip(db, { createdAt: old });
  const srv = await startServer(db);
  t.after(() => srv.close());
  const res = await fetch(`${srv.base}/api/slips/${TOKEN}/audio`);
  assert.equal(res.status, 410);
});

test('cache hit: second call reuses stored blob (slip_audio table)', async (t) => {
  const { db, dir } = makeDb();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  seedSlip(db);
  const srv = await startServer(db);
  t.after(() => srv.close());

  const r1 = await fetch(`${srv.base}/api/slips/${TOKEN}/audio`);
  const b1 = Buffer.from(await r1.arrayBuffer());
  assert.equal(r1.status, 200);
  const cached = db.prepare('SELECT wav FROM slip_audio WHERE token = ?').get(TOKEN);
  assert.ok(cached && cached.wav && cached.wav.length === b1.length);

  // Second call: point the synth at a missing engine. If it still returns the
  // same bytes, the cache (not a fresh synth) served it.
  const srv2 = await startServer(db, { synthPath: resolve(dir, 'does-not-exist.mjs') });
  t.after(() => srv2.close());
  const r2 = await fetch(`${srv2.base}/api/slips/${TOKEN}/audio`);
  assert.equal(r2.status, 200);
  const b2 = Buffer.from(await r2.arrayBuffer());
  assert.equal(b2.length, b1.length);
});

test('engine missing → 503 tts_unavailable', async (t) => {
  const { db, dir } = makeDb();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  seedSlip(db);
  const srv = await startServer(db, { synthPath: resolve(dir, 'missing-synth.mjs') });
  t.after(() => srv.close());
  const res = await fetch(`${srv.base}/api/slips/${TOKEN}/audio`);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, 'tts_unavailable');
});
