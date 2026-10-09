import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, bootstrapOwner, sync, makeRec } from './helpers.mjs';
import { openDb, indexSlip } from '../db.mjs';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from '../index.mjs';

const KEY = 'secret-key-123';
const SLIP = 'slip-token-abcdefghijklmnop'; // >= 22 chars

async function pushSlip(base, token) {
  const slip = makeRec('slip', {
    token: SLIP, kind: 'bazaar', sourceId: 'bz', weaverId: 'w-1',
    weaverName: 'Ramu', weaverPhone: '9', textHi: 'hi', textEn: 'en', lines: [],
  }, { by: 'u-owner' });
  await sync(base, 'unit-1', KEY, [slip], 0, token);
}

test('M2: CORS reflects only allow-listed origins, no wildcard', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());

  const allowed = await fetch(`${srv.base}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');

  const evil = await fetch(`${srv.base}/api/health`, { headers: { Origin: 'http://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);

  // Never a wildcard.
  assert.notEqual(allowed.headers.get('access-control-allow-origin'), '*');
});

test('H3: X-Forwarded-For is ignored (not trusted) so spoofing cannot bypass the limiter', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  await pushSlip(srv.base, token);

  // 30 requests allowed per minute per IP. All come from the same socket IP;
  // rotating X-Forwarded-For must NOT reset the counter → the 31st is 429.
  let last = 200;
  for (let i = 0; i < 31; i++) {
    const res = await fetch(`${srv.base}/api/slips/${SLIP}`, {
      headers: { 'X-Forwarded-For': `10.0.0.${i}` },
    });
    last = res.status;
  }
  assert.equal(last, 429, 'spoofed XFF did not bypass the per-IP window');
});

test('H4: slip past its 90-day TTL returns 410 expired', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'bunkar-slip-'));
  const dbPath = join(dir, 'slip.db');
  // Seed a slip with an old created_at directly, then serve via a running server.
  const seedDb = openDb(dbPath);
  const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
  indexSlip(seedDb, {
    token: SLIP, unitId: 'u', slipId: 's',
    json: JSON.stringify({ kind: 'bazaar', weaverName: 'R', lines: [], textHi: '', textEn: '' }),
    createdAt: old,
  });
  seedDb.close();

  const instance = createServer({ dbPath, port: 0 });
  const port = await instance.listen();
  t.after(async () => { await instance.close(); rmSync(dir, { recursive: true, force: true }); });

  const res = await fetch(`http://127.0.0.1:${port}/api/slips/${SLIP}`);
  assert.equal(res.status, 410);
  assert.equal((await res.json()).error, 'expired');
});

test('H4: fresh slip is served; response stays one-time', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  await pushSlip(srv.base, token);

  const get = await fetch(`${srv.base}/api/slips/${SLIP}`);
  assert.equal(get.status, 200);

  const a = await fetch(`${srv.base}/api/slips/${SLIP}/response`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'agree' }),
  });
  assert.equal(a.status, 200);
  const b = await fetch(`${srv.base}/api/slips/${SLIP}/response`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'dispute' }),
  });
  assert.equal(b.status, 409);
});
