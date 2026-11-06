// SPEC-M11: PIN hashes never leave the server; photos need a user login.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, bootstrapUnit, makeRec, sync, authHeaders, UNIT_KEY, PIN, createOrg, claim } from './helpers.mjs';

let srv, unitId, ownerId, token;
test.before(async () => {
  srv = await startTestServer();
  ({ unitId, ownerId, token } = await bootstrapUnit(srv.base));
});
test.after(async () => { await srv.stop(); });

const login = (userId, pin = '1234') => fetch(`${srv.base}/api/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitId, unitKey: UNIT_KEY, userId, pin }) });
const noHash = (records) => records.filter((r) => r.type === 'user').every((r) => r.payload.pinHash === undefined && r.payload.pinSalt === undefined);

test('AC1: bootstrap pull (no token) returns user records without PIN hash/salt', async () => {
  const r = await sync(srv.base, unitId, UNIT_KEY, [], 0);
  assert.equal(r.status, 200);
  const users = r.body.records.filter((x) => x.type === 'user');
  assert.ok(users.length >= 1);
  assert.ok(noHash(r.body.records), 'bootstrap pull leaked a PIN hash');
  assert.equal(users[0].payload.name, 'Owner');
});

test('AC1: authenticated pull and push echo return no PIN hash/salt', async () => {
  const staffId = 'u-staff-sec';
  const staff = makeRec('user', { entityId: staffId, name: 'Munshi', phone: '', role: 'staff', pinHash: PIN.hash, pinSalt: PIN.salt, active: true }, { unitId, by: ownerId });
  const r = await sync(srv.base, unitId, UNIT_KEY, [staff], 0, token);
  assert.deepEqual(r.body.rejected, []);
  assert.ok(r.body.records.some((x) => x.id === staff.id), 'pushed record not echoed');
  assert.ok(noHash(r.body.records), 'authenticated pull leaked a PIN hash');
  assert.equal((await login(staffId)).status, 200, 'staff login must still work (server kept the hash)');
});

test('AC1: a user edit without hash keeps the stored PIN; login still works', async () => {
  const staffId = 'u-staff-edit';
  const created = makeRec('user', { entityId: staffId, name: 'Rakesh', phone: '', role: 'staff', pinHash: PIN.hash, pinSalt: PIN.salt, active: true }, { unitId, by: ownerId });
  assert.deepEqual((await sync(srv.base, unitId, UNIT_KEY, [created], 0, token)).body.rejected, []);
  // Edit as the phone now sends it: no pinHash/pinSalt (deactivate, then reactivate).
  const later = (s) => new Date(Date.now() + s * 1000).toISOString();
  const off = makeRec('user', { entityId: staffId, name: 'Rakesh', phone: '', role: 'staff', active: false }, { unitId, by: ownerId, at: later(1) });
  assert.deepEqual((await sync(srv.base, unitId, UNIT_KEY, [off], 0, token)).body.rejected, []);
  assert.equal((await login(staffId)).status, 401, 'inactive user cannot log in');
  const on = makeRec('user', { entityId: staffId, name: 'Rakesh K', phone: '', role: 'staff', active: true }, { unitId, by: ownerId, at: later(2) });
  assert.deepEqual((await sync(srv.base, unitId, UNIT_KEY, [on], 0, token)).body.rejected, []);
  assert.equal((await login(staffId)).status, 200, 'reactivated user logs in with the original PIN');
  assert.equal((await login(staffId, '9999')).status, 401);
});

test('AC1: unknown user without hash, or with an empty hash → invalid_user', async () => {
  const ghost = makeRec('user', { entityId: 'u-ghost', name: 'Ghost', phone: '', role: 'staff', active: true }, { unitId, by: ownerId });
  const empty = makeRec('user', { entityId: 'u-empty', name: 'Empty', phone: '', role: 'staff', pinHash: '', pinSalt: '', active: true }, { unitId, by: ownerId });
  const r = await sync(srv.base, unitId, UNIT_KEY, [ghost, empty], 0, token);
  assert.deepEqual(r.body.rejected.map((x) => x.reason), ['invalid_user', 'invalid_user']);
});

test('AC2: photos need a user token once the unit has users', async () => {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 9]);
  const unitOnly = { 'x-unit-id': unitId, 'x-unit-key': UNIT_KEY };
  let r = await fetch(`${srv.base}/api/photos/sec1`, { method: 'PUT', headers: { ...unitOnly, 'Content-Type': 'image/jpeg' }, body: bytes });
  assert.equal(r.status, 401); assert.equal((await r.json()).error, 'needs_login');
  r = await fetch(`${srv.base}/api/photos/sec1`, { method: 'PUT', headers: { ...unitOnly, Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' }, body: bytes });
  assert.equal(r.status, 200);
  r = await fetch(`${srv.base}/api/photos/sec1`, { headers: unitOnly });
  assert.equal(r.status, 401); assert.equal((await r.json()).error, 'needs_login');
  r = await fetch(`${srv.base}/api/photos/sec1`, { headers: { ...unitOnly, Authorization: 'Bearer not-a-token' } });
  assert.equal(r.status, 401);
  r = await fetch(`${srv.base}/api/photos/sec1`, { headers: { ...unitOnly, Authorization: `Bearer ${token}` } });
  assert.equal(r.status, 200);
  assert.equal(Buffer.from(await r.arrayBuffer()).length, bytes.length);
});

test('AC2: a token from another unit cannot read this unit\'s photos', async () => {
  const other = await bootstrapUnit(srv.base);
  const r = await fetch(`${srv.base}/api/photos/sec1`, { headers: { 'x-unit-id': unitId, 'x-unit-key': UNIT_KEY, Authorization: `Bearer ${other.token}` } });
  assert.equal(r.status, 401);
  // Bootstrap unit (no users yet) still accepts unit-key-only photos.
  const { unitId: fresh, invite } = await createOrg(srv.base, { name: 'Fresh' });
  assert.equal((await claim(srv.base, invite)).status, 200);
  const put = await fetch(`${srv.base}/api/photos/fresh1`, { method: 'PUT', headers: { ...authHeaders(fresh, UNIT_KEY), 'Content-Type': 'image/jpeg' }, body: Buffer.from([0xff, 0xd8]) });
  assert.equal(put.status, 200);
});
