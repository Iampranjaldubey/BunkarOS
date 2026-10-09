import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, sync, makeRec, bootstrapOwner } from './helpers.mjs';

const KEY = 'secret-key-123';
const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123'; // >= 22 chars base64url-ish

async function bootstrapWithSlip(base) {
  const { token } = await bootstrapOwner(base, 'unit-1', KEY);
  const slip = makeRec('slip', {
    token: TOKEN,
    kind: 'bazaar',
    sourceId: 'bz-1',
    weaverId: 'w-1',
    weaverName: 'Ramu Weaver',
    weaverPhone: '9811111111',
    textHi: 'आपकी मजदूरी ₹7,200 तैयार है।',
    textEn: 'Your wage of ₹7,200 is ready.',
    lines: [{ label: 'Gross', amountPaise: 720000, sign: '+' }],
  }, { by: 'u-owner' });
  const r = await sync(base, 'unit-1', KEY, [slip], 0, token);
  assert.deepEqual(r.body.accepted, [slip.id]);
  return token;
}

test('slip public get returns view only, no key', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await bootstrapWithSlip(srv.base);

  const res = await fetch(`${srv.base}/api/slips/${TOKEN}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.slip.kind, 'bazaar');
  assert.equal(body.slip.weaverName, 'Ramu Weaver');
  assert.ok(Array.isArray(body.slip.lines));
  assert.equal(body.slip.textHi.includes('मजदूरी'), true);
  assert.equal(body.response, undefined);
  // Must not leak unit key / weaverPhone / sourceId.
  const raw = JSON.stringify(body);
  assert.equal(raw.includes(KEY), false);
  assert.equal(raw.includes('9811111111'), false);
});

test('bad / short token → 404', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await bootstrapWithSlip(srv.base);

  const short = await fetch(`${srv.base}/api/slips/tooshort`);
  assert.equal(short.status, 404);

  const unknown = await fetch(`${srv.base}/api/slips/zzzzzzzzzzzzzzzzzzzzzzzzzz`);
  assert.equal(unknown.status, 404);
});

test('slip respond + double respond 409', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const token = await bootstrapWithSlip(srv.base);

  const r1 = await fetch(`${srv.base}/api/slips/${TOKEN}/response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: 'agree', note: 'theek hai' }),
  });
  assert.equal(r1.status, 200);
  assert.equal((await r1.json()).ok, true);

  // GET now shows the response.
  const g = await fetch(`${srv.base}/api/slips/${TOKEN}`);
  const gb = await g.json();
  assert.equal(gb.response.answer, 'agree');
  assert.ok(gb.response.at);

  // Second response → 409.
  const r2 = await fetch(`${srv.base}/api/slips/${TOKEN}/response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: 'dispute' }),
  });
  assert.equal(r2.status, 409);
  assert.equal((await r2.json()).error, 'already_answered');

  // The slip_response record flows back on pull (role weaver, device server).
  const pull = await sync(srv.base, 'unit-1', KEY, [], 0, token);
  const resp = pull.body.records.find((x) => x.type === 'slip_response');
  assert.ok(resp);
  assert.equal(resp.role, 'weaver');
  assert.equal(resp.device, 'server');
  assert.equal(resp.by, 'weaver:w-1');
  assert.equal(resp.payload.answer, 'agree');
});

test('invalid answer rejected 400', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await bootstrapWithSlip(srv.base);
  const r = await fetch(`${srv.base}/api/slips/${TOKEN}/response`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: 'maybe' }),
  });
  assert.equal(r.status, 400);
});
