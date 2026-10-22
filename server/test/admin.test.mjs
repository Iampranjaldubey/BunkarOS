import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, bootstrapUnit, makeRec, sync, UNIT_KEY } from './helpers.mjs';

let srv, unitId, ownerId, token;
test.before(async () => {
  process.env.ADMIN_KEYS = 'shubham:test-admin-key-123,pranjal:other-admin-key-456';
  srv = await startTestServer();
  ({ unitId, ownerId, token } = await bootstrapUnit(srv.base));
  const r = await sync(srv.base, unitId, UNIT_KEY, [makeRec('worker', { entityId: 'w1', name: 'Rafiq', jobTitle: 'weaver', payType: 'monthly', salaryPaise: 1200000, otRatePaise: 5800, joinedOn: '2026-01-01', active: true, accessCode: '4821' }, { unitId, by: ownerId })], 0, token);
  assert.equal(r.body.rejected.length, 0);
});
test.after(async () => { await srv.stop(); delete process.env.ADMIN_KEYS; });

const login = (name, key) => fetch(`${srv.base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, key }) });

test('wrong key or unknown name → 401; right key → token', async () => {
  assert.equal((await login('shubham', 'nope')).status, 401);
  assert.equal((await login('someone', 'test-admin-key-123')).status, 401);
  const ok = await login('Shubham', 'test-admin-key-123');
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).name, 'shubham');
});

test('units list shows the unit with owner + worker counts; unit detail returns records without PIN hashes', async () => {
  const { token: at } = await (await login('pranjal', 'other-admin-key-456')).json();
  const list = await fetch(`${srv.base}/api/admin/units`, { headers: { Authorization: `Bearer ${at}` } });
  assert.equal(list.status, 200);
  const lb = await list.json();
  const u = lb.units.find((x) => x.unitId === unitId);
  assert.ok(u, 'unit listed');
  assert.equal(u.name, 'Test Unit'); assert.equal(u.ownerName, 'Owner'); assert.equal(u.users, 1); assert.equal(u.workers, 1);
  assert.match(u.shortCode, /^\d{6}$/);
  const det = await fetch(`${srv.base}/api/admin/units/${unitId}`, { headers: { Authorization: `Bearer ${at}` } });
  assert.equal(det.status, 200);
  const db = await det.json();
  const user = db.records.find((r) => r.type === 'user');
  assert.equal(user.payload.pinHash, undefined); assert.equal(user.payload.pinSalt, undefined);
  assert.ok(db.records.some((r) => r.type === 'worker' && r.payload.accessCode === '4821'), 'admin sees worker codes for support');
});

test('an admin token is not a unit token: /api/sync and /api/worker-links refuse it; no token → 401', async () => {
  const { token: at } = await (await login('shubham', 'test-admin-key-123')).json();
  const s = await fetch(`${srv.base}/api/sync`, { method: 'POST', headers: { 'x-unit-id': unitId, 'x-unit-key': UNIT_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${at}` }, body: JSON.stringify({ records: [makeRec('advance', { workerId: 'w1', amountPaise: 1, mode: 'cash' }, { unitId, by: ownerId })], since: 0 }) });
  assert.equal(s.status, 401);
  const wl = await fetch(`${srv.base}/api/worker-links`, { method: 'POST', headers: { 'x-unit-id': unitId, 'x-unit-key': UNIT_KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${at}` }, body: JSON.stringify({ workerId: 'w1' }) });
  assert.equal(wl.status, 401);
  assert.equal((await fetch(`${srv.base}/api/admin/units`)).status, 401);
});

test('admin disabled when ADMIN_KEYS is unset → 403', async () => {
  const saved = process.env.ADMIN_KEYS; delete process.env.ADMIN_KEYS;
  try { assert.equal((await login('shubham', 'test-admin-key-123')).status, 403); } finally { process.env.ADMIN_KEYS = saved; }
});
