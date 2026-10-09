// Route-level test for the C9 voice clip: GET /api/slips/:token/audio wired in routes.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startTestServer, sync, makeRec, bootstrapOwner } from './helpers.mjs';

const KEY = 'secret-key-123';
const TOKEN = 'audioTokenAbcdefghijklmnop012'; // >= 22 chars
const here = dirname(fileURLToPath(import.meta.url));
const engineInstalled = existsSync(resolve(here, '..', 'tts', 'node_modules'));

async function seedSlip(base) {
  const { token } = await bootstrapOwner(base, 'unit-a', KEY);
  const slip = makeRec('slip', {
    token: TOKEN, kind: 'bazaar', sourceId: 'bz-1', weaverId: 'w-1',
    weaverName: 'Rafiq Ansari', weaverPhone: '9811111111',
    textHi: 'रफ़ीक़ जी, आज दिए गए ₹1,955', textEn: 'Rafiq ji, paid today ₹1,955',
    speechHi: 'रफ़ीक़ जी, आज दिए गए एक हज़ार नौ सौ पचपन रुपये।',
    lines: [{ label: 'Paid', amountPaise: 195500 }],
  }, { unitId: 'unit-a', by: 'u-owner' });
  const r = await sync(base, 'unit-a', KEY, [slip], 0, token);
  assert.deepEqual(r.body.accepted, [slip.id]);
}

test('public slip view exposes speechHi but still no phone', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await seedSlip(srv.base);
  const body = await (await fetch(`${srv.base}/api/slips/${TOKEN}`)).json();
  assert.equal(body.slip.speechHi.includes('पचपन रुपये'), true);
  assert.equal(JSON.stringify(body).includes('9811111111'), false);
});

test('GET /api/slips/:token/audio → WAV clip (or 503 when the optional engine is absent)', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await seedSlip(srv.base);
  const res = await fetch(`${srv.base}/api/slips/${TOKEN}/audio`);
  if (!engineInstalled) {
    assert.equal(res.status, 503);
    return;
  }
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'audio/wav');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(buf.subarray(8, 12).toString('ascii'), 'WAVE');
  const byteRate = buf.readUInt32LE(28);
  const seconds = (buf.length - 44) / byteRate;
  assert.ok(seconds >= 1 && seconds <= 60, `duration ${seconds}s out of range`);
});

test('audio route: unknown token 404, short token 404', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await seedSlip(srv.base);
  assert.equal((await fetch(`${srv.base}/api/slips/zzzzzzzzzzzzzzzzzzzzzzzzzz/audio`)).status, 404);
  assert.equal((await fetch(`${srv.base}/api/slips/short/audio`)).status, 404);
});
