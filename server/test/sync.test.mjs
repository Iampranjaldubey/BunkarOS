import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, createUnit, sync, makeRec, bootstrapOwner, authHeaders, hashPin } from './helpers.mjs';

const KEY = 'secret-key-123';

/** Bootstrap an owner and return a token to author subsequent records. */
async function bootstrap(base) {
  const b = await bootstrapOwner(base, 'unit-1', KEY);
  assert.ok(b.token, 'owner token issued');
  return b;
}

test('sync push/pull with cursor', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrap(srv.base);

  const loom = makeRec('loom', { entityId: 'l-1', code: 'L-01', village: 'Gopiganj', widthIn: 96, weaverIds: [], active: true });
  const r1 = await sync(srv.base, 'unit-1', KEY, [loom], 0, token);
  assert.deepEqual(r1.body.accepted, [loom.id]);
  // Pull from cursor 0 returns owner + loom.
  assert.ok(r1.body.records.length >= 2);
  const cursor = r1.body.cursor;
  assert.ok(cursor > 0);

  // Push another; pull since cursor only returns the new one.
  const weaver = makeRec('weaver', { entityId: 'w-1', name: 'Ramu', fatherName: 'Shyam', village: 'Gopiganj', phone: '9811111111', phoneType: 'keypad', active: true });
  const r2 = await sync(srv.base, 'unit-1', KEY, [weaver], cursor, token);
  assert.deepEqual(r2.body.accepted, [weaver.id]);
  assert.equal(r2.body.records.length, 1);
  assert.equal(r2.body.records[0].id, weaver.id);
  assert.equal(r2.body.records[0].sync, 'synced');
  assert.ok(typeof r2.body.records[0].serverSeq === 'number');
  assert.ok(r2.body.cursor > cursor);
});

test('idempotent resend of same id', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrap(srv.base);

  const rec = makeRec('loom', { entityId: 'l-9', code: 'L-09', village: 'X', widthIn: 72, weaverIds: [], active: true });
  const a = await sync(srv.base, 'unit-1', KEY, [rec], 0, token);
  const b = await sync(srv.base, 'unit-1', KEY, [rec], 0, token);
  assert.deepEqual(a.body.accepted, [rec.id]);
  assert.deepEqual(b.body.accepted, [rec.id]);
  assert.deepEqual(b.body.rejected, []);

  // Only one copy stored: full pull has exactly one loom with entityId l-9.
  const full = await sync(srv.base, 'unit-1', KEY, [], 0, token);
  const looms = full.body.records.filter((x) => x.type === 'loom' && x.payload.entityId === 'l-9');
  assert.equal(looms.length, 1);
});

test('records with wrong unitId rejected invalid', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrap(srv.base);

  const bad = makeRec('loom', { entityId: 'l-x', code: 'X', village: 'X', widthIn: 72, weaverIds: [], active: true }, { unitId: 'other-unit' });
  const r = await sync(srv.base, 'unit-1', KEY, [bad], 0, token);
  assert.equal(r.body.accepted.length, 0);
  assert.equal(r.body.rejected[0].reason, 'invalid');
});

test('malformed record rejected invalid', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrap(srv.base);

  const r = await sync(srv.base, 'unit-1', KEY, [{ id: 'bad1', type: 'nope', unitId: 'unit-1' }], 0, token);
  assert.equal(r.body.rejected[0].reason, 'invalid');
});

test('sync without a token once the unit has users → needs_login', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await bootstrap(srv.base);
  // No Bearer token: a push is rejected 401 needs_login.
  const loom = makeRec('loom', { entityId: 'l-nt', code: 'NT', village: 'X', widthIn: 72, weaverIds: [], active: true });
  const r = await fetch(`${srv.base}/api/sync`, {
    method: 'POST',
    headers: authHeaders('unit-1', KEY),
    body: JSON.stringify({ records: [loom], since: 0 }),
  });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, 'needs_login');
});

test('two-device bootstrap: token-less pull returns ONLY user records', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  // Owner bootstraps + authors a second (munshi) user and a non-user record.
  const { token } = await bootstrap(srv.base);
  const { pinHash, pinSalt } = hashPin('1111');
  const munshi = makeRec(
    'user',
    { entityId: 'u-munshi', name: 'Munshi', phone: '9811111111', role: 'munshi', pinHash, pinSalt, active: true },
    { by: 'u-owner', role: 'owner' },
  );
  const loom = makeRec('loom', { entityId: 'l-1', code: 'L-01', village: 'Gopiganj', widthIn: 96, weaverIds: [], active: true });
  await sync(srv.base, 'unit-1', KEY, [munshi, loom], 0, token);

  // Second device: unit key only, NO token, empty records → bootstrap pull.
  const res = await fetch(`${srv.base}/api/sync`, {
    method: 'POST',
    headers: authHeaders('unit-1', KEY),
    body: JSON.stringify({ records: [], since: 0 }),
  });
  assert.equal(res.status, 200, 'bootstrap pull is permitted (not 401)');
  const body = await res.json();
  assert.ok(body.records.length >= 2, 'returns the owner + munshi user records');
  assert.ok(body.records.every((r) => r.type === 'user'), 'returns ONLY user records (no loom leaked)');
  const ids = body.records.map((r) => r.payload.entityId).sort();
  assert.deepEqual(ids, ['u-munshi', 'u-owner']);
  // The joined device can now see login identities (names + hashes, never raw PIN).
  const owner = body.records.find((r) => r.payload.entityId === 'u-owner');
  assert.equal(owner.payload.name, 'Malik');
  assert.ok(owner.payload.pinHash && owner.payload.pinSalt, 'pin hash/salt present');
  assert.equal(owner.payload.pin, undefined, 'raw PIN never present');
  assert.deepEqual(body.accepted, []);
  assert.deepEqual(body.rejected, []);
  // Cursor must NOT advance past non-user records (else the post-login full pull
  // would skip the loom and everything else). since:0 → cursor:0.
  assert.equal(body.cursor, 0, 'bootstrap pull leaves the cursor at `since`');
});

test('two-device bootstrap: token-less WRITE is still rejected needs_login', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await bootstrap(srv.base);
  // Attempt to piggyback a write on an unauthenticated bootstrap request.
  const loom = makeRec('loom', { entityId: 'l-evil', code: 'EVIL', village: 'X', widthIn: 72, weaverIds: [], active: true });
  const res = await fetch(`${srv.base}/api/sync`, {
    method: 'POST',
    headers: authHeaders('unit-1', KEY),
    body: JSON.stringify({ records: [loom], since: 0 }),
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'needs_login');
});
