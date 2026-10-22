import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, bootstrapUnit, makeRec, sync, UNIT_KEY, PIN } from './helpers.mjs';

let srv, unitId, ownerId, token, staffId, staffToken;
test.before(async () => {
  srv = await startTestServer();
  ({ unitId, ownerId, token } = await bootstrapUnit(srv.base));
  staffId = 'u-staff';
  const staff = makeRec('user', { entityId: staffId, name: 'Munshi', phone: '', role: 'staff', pinHash: PIN.hash, pinSalt: PIN.salt, active: true }, { unitId, by: ownerId });
  const r = await sync(srv.base, unitId, UNIT_KEY, [staff], 0, token);
  assert.equal(r.body.rejected.length, 0);
  const tok = await fetch(`${srv.base}/api/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitId, unitKey: UNIT_KEY, userId: staffId, pin: '1234' }) });
  staffToken = (await tok.json()).token;
  assert.ok(staffToken);
});
test.after(async () => { await srv.stop(); });

const att = (by, day, over = {}) => makeRec('attendance', { workerId: 'w1', status: 'present', otHours: 0 }, { unitId, by, role: by === ownerId ? 'owner' : 'staff', day, ...over });

test('forged author is rejected', async () => {
  const r = await sync(srv.base, unitId, UNIT_KEY, [att(ownerId, '2026-10-23')], 0, staffToken);
  assert.deepEqual(r.body.rejected.map((x) => x.reason), ['forged_author']);
});

test('staff cannot write setting / user / period_lock', async () => {
  const lock = makeRec('period_lock', { month: '2026-09' }, { unitId, by: staffId, role: 'staff' });
  const r = await sync(srv.base, unitId, UNIT_KEY, [lock], 0, staffToken);
  assert.deepEqual(r.body.rejected.map((x) => x.reason), ['forbidden_role']);
});

test('locked month refuses attendance + advance + payment; reversal of the lock re-opens it', async () => {
  const lock = makeRec('period_lock', { month: '2026-09' }, { unitId, by: ownerId });
  let r = await sync(srv.base, unitId, UNIT_KEY, [lock], 0, token);
  assert.equal(r.body.rejected.length, 0);
  const a = att(staffId, '2026-09-15');
  const adv = makeRec('advance', { workerId: 'w1', amountPaise: 50000, mode: 'cash' }, { unitId, by: staffId, role: 'staff', day: '2026-09-02' });
  r = await sync(srv.base, unitId, UNIT_KEY, [a, adv], 0, staffToken);
  assert.deepEqual(r.body.rejected.map((x) => x.reason), ['period_locked', 'period_locked']);
  const unlock = makeRec('reversal', { targetId: lock.id, reason: 'reopen' }, { unitId, by: ownerId });
  r = await sync(srv.base, unitId, UNIT_KEY, [unlock], 0, token);
  assert.equal(r.body.rejected.length, 0);
  r = await sync(srv.base, unitId, UNIT_KEY, [att(staffId, '2026-09-16')], 0, staffToken);
  assert.equal(r.body.rejected.length, 0);
});

test('wage_payment: arithmetic must hold; one per worker+month', async () => {
  const pay = (over = {}) => makeRec('wage_payment', { workerId: 'w1', month: '2026-08', grossPaise: 1084600, otPaise: 17400, deductions: [{ label: 'x', amountPaise: 0 }], advanceRecoveredPaise: 100000, netPaise: 1002000, paidPaise: 1002000, roundingPaise: 0, mode: 'cash', snapshot: { present: 23, half: 1, absent: 2, otHours: 3, pieces: 0, payType: 'monthly', ratePaise: 1200000 }, ...over }, { unitId, by: ownerId, day: '2026-09-01' });
  let r = await sync(srv.base, unitId, UNIT_KEY, [pay({ netPaise: 999 })], 0, token);
  assert.deepEqual(r.body.rejected.map((x) => x.reason), ['invalid_amounts']);
  r = await sync(srv.base, unitId, UNIT_KEY, [pay()], 0, token);
  assert.equal(r.body.rejected.length, 0);
  r = await sync(srv.base, unitId, UNIT_KEY, [pay()], 0, token);
  assert.deepEqual(r.body.rejected.map((x) => x.reason), ['duplicate_payment']);
});

test('staff may reverse only own same-day records; owner any', async () => {
  const mine = att(staffId, '2026-10-20');
  const theirs = att(ownerId, '2026-10-20');
  let r = await sync(srv.base, unitId, UNIT_KEY, [mine], 0, staffToken); assert.equal(r.body.rejected.length, 0);
  r = await sync(srv.base, unitId, UNIT_KEY, [theirs], 0, token); assert.equal(r.body.rejected.length, 0);
  const revOk = makeRec('reversal', { targetId: mine.id, reason: 'edited' }, { unitId, by: staffId, role: 'staff', day: '2026-10-20' });
  const revOther = makeRec('reversal', { targetId: theirs.id, reason: 'x' }, { unitId, by: staffId, role: 'staff', day: '2026-10-20' });
  const revLate = makeRec('reversal', { targetId: mine.id, reason: 'x' }, { unitId, by: staffId, role: 'staff', day: '2026-10-21' });
  r = await sync(srv.base, unitId, UNIT_KEY, [revOk, revOther, revLate], 0, staffToken);
  assert.deepEqual(r.body.rejected.map((x) => x.reason).sort(), ['forbidden_reversal', 'forbidden_reversal']);
  assert.deepEqual(r.body.accepted, [revOk.id]);
  const ownerRev = makeRec('reversal', { targetId: theirs.id, reason: 'owner' }, { unitId, by: ownerId });
  r = await sync(srv.base, unitId, UNIT_KEY, [ownerRev], 0, token);
  assert.equal(r.body.rejected.length, 0);
});

test('staff cannot change a worker\'s pay fields; owner can', async () => {
  const base = { entityId: 'w9', name: 'Salim', jobTitle: 'weaver', payType: 'monthly', salaryPaise: 1000000, otRatePaise: 5000, joinedOn: '2026-01-01', active: true };
  let r = await sync(srv.base, unitId, UNIT_KEY, [makeRec('worker', base, { unitId, by: ownerId })], 0, token);
  assert.equal(r.body.rejected.length, 0);
  r = await sync(srv.base, unitId, UNIT_KEY, [makeRec('worker', { ...base, phone: '9' }, { unitId, by: staffId, role: 'staff' })], 0, staffToken);
  assert.equal(r.body.rejected.length, 0, 'phone edit by staff ok');
  r = await sync(srv.base, unitId, UNIT_KEY, [makeRec('worker', { ...base, salaryPaise: 1500000 }, { unitId, by: staffId, role: 'staff' })], 0, staffToken);
  assert.deepEqual(r.body.rejected.map((x) => x.reason), ['forbidden_rate_change']);
  r = await sync(srv.base, unitId, UNIT_KEY, [makeRec('worker', { ...base, salaryPaise: 1500000 }, { unitId, by: ownerId })], 0, token);
  assert.equal(r.body.rejected.length, 0);
});

test('photos: PUT/GET round trip, wrong mime 415', async () => {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  let r = await fetch(`${srv.base}/api/photos/p1`, { method: 'PUT', headers: { 'x-unit-id': unitId, 'x-unit-key': UNIT_KEY, 'Content-Type': 'image/jpeg' }, body: bytes });
  assert.equal(r.status, 200);
  r = await fetch(`${srv.base}/api/photos/p1`, { headers: { 'x-unit-id': unitId, 'x-unit-key': UNIT_KEY } });
  assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/jpeg');
  assert.equal(Buffer.from(await r.arrayBuffer()).length, bytes.length);
  r = await fetch(`${srv.base}/api/photos/p2`, { method: 'PUT', headers: { 'x-unit-id': unitId, 'x-unit-key': UNIT_KEY, 'Content-Type': 'text/html' }, body: 'x' });
  assert.equal(r.status, 415);
});
