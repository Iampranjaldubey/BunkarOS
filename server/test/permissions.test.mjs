// SPEC-M13 (operator toggles, price removal) and SPEC-M14 (overrides, correction steps) on the server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, bootstrapUnit, addStaff, makeRec, sync, UNIT_KEY, istToday } from './helpers.mjs';

let srv, unitId, ownerId, token, staff1, staff2;
test.before(async () => {
  srv = await startTestServer();
  ({ unitId, ownerId, token } = await bootstrapUnit(srv.base));
  staff1 = await addStaff(srv.base, unitId, ownerId, token, 'op-1');
  staff2 = await addStaff(srv.base, unitId, ownerId, token, 'op-2');
});
test.after(async () => { await srv.stop(); });

const baseSetting = { entityId: 'unit', unitName: 'Test Unit', ownerPhone: '9999999999', lang: 'hi', workingDaysPerMonth: 26, photoRequiredAbovePaise: 200000, holidays: [] };
let tick = 0;
const later = () => new Date(Date.now() + 1000 * ++tick).toISOString(); // each new setting version is the latest
const o = (type, payload, day = istToday(), over = {}) => makeRec(type, payload, { unitId, by: ownerId, role: 'owner', day, at: later(), ...over });
const op = (s, type, payload, day = istToday()) => makeRec(type, payload, { unitId, by: s.staffId, role: 'staff', day, at: later() });
const push = async (recs, tok = token, since = 0) => (await sync(srv.base, unitId, UNIT_KEY, recs, since, tok)).body;
const reasons = (b) => b.rejected.map((x) => x.reason);
const setPerms = async (perms) => assert.deepEqual(reasons(await push([o('setting', { ...baseSetting, operatorPerms: perms })])), []);

test('settings: owner-only, valid values only', async () => {
  assert.deepEqual(reasons(await push([op(staff1, 'setting', { ...baseSetting, overtimeEnabled: true })], staff1.staffToken)), ['forbidden_role']);
  const bad = [{ overtimeEnabled: 'yes' }, { offDayPolicy: 'weekends' }, { slipSections: { qr: true } }, { slipSections: { net: 'on' } }, { operatorPerms: { deleteAll: true } }, { workingDaysPerMonth: 40 }];
  const body = await push(bad.map((x) => o('setting', { ...baseSetting, ...x })));
  assert.deepEqual(reasons(body), bad.map(() => 'invalid_setting'));
  assert.deepEqual(reasons(await push([o('setting', { ...baseSetting, overtimeEnabled: true, offDayPolicy: 'sundays', slipSections: { attendance: true, signature: false }, operatorPerms: { addEntries: true, editPast: false, seePrices: true, export: false } })])), []);
});

test('AC3 + AC8: "add entries" off refuses every operator write, for all operators; on again → accepted', async () => {
  await setPerms({ addEntries: false });
  const att = (s) => op(s, 'attendance', { workerId: 'w1', status: 'present', otHours: 0 });
  assert.deepEqual(reasons(await push([att(staff1)], staff1.staffToken)), ['forbidden_permission']);
  assert.deepEqual(reasons(await push([att(staff2), op(staff2, 'advance', { workerId: 'w1', amountPaise: 1000, mode: 'cash' })], staff2.staffToken)), ['forbidden_permission', 'forbidden_permission']);
  assert.deepEqual(reasons(await push([o('attendance', { workerId: 'w1', status: 'present', otHours: 0 })])), [], 'the owner is not affected');
  await setPerms({ addEntries: true });
  assert.deepEqual(reasons(await push([att(staff1)], staff1.staffToken)), []);
});

test('AC4: "edit past entries" on → operator reverses another user\'s entry from yesterday; off → refused, also back-dated', async () => {
  const yesterday = istToday(-1);
  const ownerOld = o('attendance', { workerId: 'w2', status: 'present', otHours: 0 }, yesterday);
  const ownerToday = o('attendance', { workerId: 'w3', status: 'present', otHours: 0 });
  const lock = o('period_lock', { month: '2025-01' }, '2025-02-01');
  assert.deepEqual(reasons(await push([ownerOld, ownerToday, lock])), []);
  const rev = (target, day = istToday(), reason = 'galat') => op(staff1, 'reversal', { targetId: target.id, reason }, day);
  await setPerms({ addEntries: true, editPast: false });
  assert.deepEqual(reasons(await push([rev(ownerOld), rev(ownerOld, yesterday)], staff1.staffToken)), ['forbidden_reversal', 'forbidden_reversal']);
  await setPerms({ addEntries: true, editPast: true });
  assert.deepEqual(reasons(await push([rev(ownerToday)], staff1.staffToken)), ['forbidden_reversal'], 'another user\'s entry from today is still not theirs to undo');
  assert.deepEqual(reasons(await push([rev(lock)], staff1.staffToken)), ['forbidden_reversal'], 'an operator can never unlock a month');
  assert.deepEqual(reasons(await push([rev(ownerOld, istToday(), '')], staff1.staffToken)), ['reason_required']);
  assert.deepEqual(reasons(await push([rev(ownerOld)], staff1.staffToken)), [], 'edit past on: accepted with a reason');
  await setPerms({ addEntries: true, editPast: false });
});

test('AC5 + AC6 + AC7: "see prices" off — server removes prices from pull and echo, keeps them on operator edits, refuses priced operator records', async () => {
  const order = { entityId: 'ord-p', buyerId: 'b1', orderNo: 'ORD-900', design: 'Kashan', size: '8x10', qty: 4, dueDate: '2026-12-01', pricePaise: 500000, receivedOn: istToday() };
  assert.deepEqual(reasons(await push([o('order', order)])), []);
  // On (default): operator sees the price, view says so.
  let body = await push([], staff1.staffToken);
  assert.equal(body.view.seePrices, true);
  assert.equal(body.records.filter((r) => r.type === 'order' && r.payload.entityId === 'ord-p').at(-1).payload.pricePaise, 500000);
  // Off: neither operator receives any order price, in a full pull or in the echo of their own push.
  await setPerms({ addEntries: true, seePrices: false });
  for (const s of [staff1, staff2]) {
    body = await push([], s.staffToken);
    assert.equal(body.view.seePrices, false);
    const orders = body.records.filter((r) => r.type === 'order');
    assert.ok(orders.length >= 1);
    assert.ok(orders.every((r) => !('pricePaise' in r.payload)), 'no order price in an operator pull');
  }
  // Operator changes the due date without a price → accepted, stored price kept (owner still sees it).
  const edit = op(staff1, 'order', { ...order, dueDate: '2026-12-15', pricePaise: undefined });
  delete edit.payload.pricePaise;
  body = await push([edit], staff1.staffToken);
  assert.deepEqual(reasons(body), []);
  assert.ok(body.records.filter((r) => r.type === 'order').every((r) => !('pricePaise' in r.payload)), 'echo has no price');
  const ownerView = await push([]);
  assert.equal(ownerView.view.seePrices, true);
  const latest = ownerView.records.filter((r) => r.type === 'order' && r.payload.entityId === 'ord-p').at(-1).payload;
  assert.deepEqual([latest.dueDate, latest.pricePaise], ['2026-12-15', 500000]);
  // An operator record that carries a price is refused.
  assert.deepEqual(reasons(await push([op(staff2, 'order', { ...order, entityId: 'ord-q', orderNo: 'ORD-901', pricePaise: 100 })], staff2.staffToken)), ['forbidden_price']);
  // On again: the operator gets prices back.
  await setPerms({ addEntries: true, seePrices: true });
  body = await push([], staff1.staffToken);
  assert.equal(body.view.seePrices, true);
  assert.equal(body.records.filter((r) => r.type === 'order' && r.payload.entityId === 'ord-p').at(-1).payload.pricePaise, 500000);
});

const payment = (over = {}) => ({ workerId: 'rafiq', month: '2026-03', grossPaise: 1126923, otPaise: 0, deductions: [], advanceRecoveredPaise: 100000, netPaise: 1026923, roundingPaise: -23, paidPaise: 1026900, mode: 'cash',
  snapshot: { present: 1, half: 1, absent: 2, otHours: 3, pieces: 0, payType: 'monthly', ratePaise: 1200000, parts: { base: 1200000, absent_deduct: 92308, half_deduct: 23077, overtime: 0, advance_recovered: 100000, rounding: -23 } },
  overrides: [{ line: 'absent_deduct', computedPaise: 92308, finalPaise: 50000, reason: 'एक दिन की छुट्टी दी थी' }], ...over });

test('SPEC-M14 AC1/AC3/AC4: Example C accepted from the owner; operators cannot override; bad overrides refused', async () => {
  assert.deepEqual(reasons(await push([op(staff1, 'wage_payment', payment({ workerId: 'w-op' }), '2026-04-01')], staff1.staffToken)), ['forbidden_override']);
  const bad = [
    payment({ workerId: 'b1', overrides: [{ line: 'absent_deduct', computedPaise: 92308, finalPaise: 50000, reason: ' ' }] }),
    payment({ workerId: 'b2', overrides: [{ line: 'bonus', computedPaise: 0, finalPaise: 50000, reason: 'x' }] }),
    payment({ workerId: 'b3', overrides: [{ line: 'base', computedPaise: 1200000, finalPaise: -1, reason: 'x' }] }),
  ];
  assert.deepEqual(reasons(await push(bad.map((p) => o('wage_payment', p, '2026-04-01')))), ['invalid_override', 'invalid_override', 'invalid_override']);
  // Override that makes net negative: gross 0 after a base override of 0 → net −1,23,077 → refused.
  const neg = payment({ workerId: 'b4', grossPaise: -115385, netPaise: -215385, roundingPaise: 0, paidPaise: 0, overrides: [{ line: 'base', computedPaise: 1200000, finalPaise: 0, reason: 'x' }] });
  assert.deepEqual(reasons(await push([o('wage_payment', neg, '2026-04-01')])), ['negative_net']);
  // Example C itself.
  const ok = o('wage_payment', payment(), '2026-04-01');
  assert.deepEqual(reasons(await push([ok])), []);
  const stored = (await push([])).records.find((r) => r.id === ok.id).payload;
  assert.deepEqual([stored.grossPaise, stored.paidPaise, stored.overrides[0].finalPaise, stored.overrides[0].computedPaise], [1126923, 1026900, 50000, 92308]);
});

test('SPEC-M14 AC7/AC8: changing a paid, locked month: unlock → reverse → pay again → lock, each with a reason', async () => {
  const mon = '2026-05';
  const first = o('wage_payment', payment({ workerId: 'rafiq', month: mon }), '2026-05-31');
  const lock = o('period_lock', { month: mon }, '2026-06-01');
  assert.deepEqual(reasons(await push([first, lock])), []);
  const revPay = (reason) => o('reversal', { targetId: first.id, reason });
  assert.deepEqual(reasons(await push([revPay('छुट्टी का दिन ग़लत लगा')])), ['period_locked'], 'cannot reverse the payment while locked');
  assert.deepEqual(reasons(await push([o('reversal', { targetId: lock.id, reason: '' })])), ['reason_required'], 'unlock needs a reason');
  const unlock = o('reversal', { targetId: lock.id, reason: 'पगार दोबारा देनी है' });
  assert.deepEqual(reasons(await push([unlock])), []);
  assert.deepEqual(reasons(await push([revPay('')])), ['reason_required']);
  assert.deepEqual(reasons(await push([revPay('छुट्टी का दिन ग़लत लगा')])), []);
  // Pay again: needs a correction reason; overrides allowed again.
  const again = (over) => o('wage_payment', payment({ workerId: 'rafiq', month: mon, ...over }), '2026-06-02');
  assert.deepEqual(reasons(await push([again({})])), ['reason_required']);
  assert.deepEqual(reasons(await push([again({ correctionReason: 'सही छुट्टी के साथ' })])), [], 'second payment accepted because the first is reversed');
  // Lock again: needs a reason because the month was locked before.
  assert.deepEqual(reasons(await push([o('period_lock', { month: mon }, '2026-06-03')])), ['reason_required']);
  assert.deepEqual(reasons(await push([o('period_lock', { month: mon, reason: 'सुधार पूरा' }, '2026-06-03')])), []);
  // A first lock of another month needs no reason.
  assert.deepEqual(reasons(await push([o('period_lock', { month: '2026-07' }, '2026-08-01')])), []);
});
