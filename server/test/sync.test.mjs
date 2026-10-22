import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, bootstrapUnit, makeRec, sync, UNIT_KEY } from './helpers.mjs';

let srv;
test.before(async () => { srv = await startTestServer(); });
test.after(async () => { await srv.stop(); });

test('health', async () => {
  const r = await fetch(`${srv.base}/api/health`);
  assert.equal(r.status, 200);
});

test('bootstrap unit → owner token → push/pull with cursor', async () => {
  const { unitId, ownerId, token } = await bootstrapUnit(srv.base);
  assert.ok(token, 'token issued');
  const worker = makeRec('worker', { entityId: 'w1', name: 'Rafiq', jobTitle: 'weaver', payType: 'monthly', salaryPaise: 1200000, otRatePaise: 5800, joinedOn: '2026-01-01', active: true }, { unitId, by: ownerId });
  const r1 = await sync(srv.base, unitId, UNIT_KEY, [worker], 0, token);
  assert.equal(r1.status, 200);
  assert.deepEqual(r1.body.accepted, [worker.id]);
  assert.equal(r1.body.rejected.length, 0);
  assert.equal(r1.body.records.length, 3, 'setting + user + worker pulled');
  const cursor = r1.body.cursor;
  // idempotent re-push, nothing new to pull
  const r2 = await sync(srv.base, unitId, UNIT_KEY, [worker], cursor, token);
  assert.deepEqual(r2.body.accepted, [worker.id]);
  assert.equal(r2.body.records.length, 0);
});

test('no token: writes refused, user-only bootstrap pull allowed', async () => {
  const { unitId, ownerId } = await bootstrapUnit(srv.base);
  const w = makeRec('worker', { entityId: 'w2', name: 'X', jobTitle: 'weaver', payType: 'daily', dailyRatePaise: 40000, otRatePaise: 5000, joinedOn: '2026-01-01', active: true }, { unitId, by: ownerId });
  const r = await sync(srv.base, unitId, UNIT_KEY, [w], 0);
  assert.equal(r.status, 401);
  const pull = await sync(srv.base, unitId, UNIT_KEY, [], 0);
  assert.equal(pull.status, 200);
  assert.ok(pull.body.records.every((x) => x.type === 'user'));
  assert.equal(pull.body.cursor, 0, 'cursor not advanced on filtered pull');
});

test('wrong PIN → 401; wrong unit key → 401', async () => {
  const { unitId, ownerId } = await bootstrapUnit(srv.base);
  const bad = await fetch(`${srv.base}/api/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitId, unitKey: UNIT_KEY, userId: ownerId, pin: '0000' }) });
  assert.equal(bad.status, 401);
  const r = await sync(srv.base, unitId, 'x'.repeat(43), [], 0);
  assert.equal(r.status, 401);
});
