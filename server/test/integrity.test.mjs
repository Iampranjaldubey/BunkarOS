// SPEC-M16: server integrity — locked-month reversals, wage amounts, stock below zero, photo ids.
// (AC5, same-day undo by the server's date, is in rules.test.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, bootstrapUnit, addStaff, makeRec, sync, UNIT_KEY, istToday } from './helpers.mjs';

let srv, unitId, ownerId, token, staffId, staffToken;
test.before(async () => {
  srv = await startTestServer();
  ({ unitId, ownerId, token } = await bootstrapUnit(srv.base));
  ({ staffId, staffToken } = await addStaff(srv.base, unitId, ownerId, token));
});
test.after(async () => { await srv.stop(); });

const o = (type, payload, day = istToday(), over = {}) => makeRec(type, payload, { unitId, by: ownerId, role: 'owner', day, ...over });
const st = (type, payload, day = istToday()) => makeRec(type, payload, { unitId, by: staffId, role: 'staff', day });
const push = async (recs, tok = token) => (await sync(srv.base, unitId, UNIT_KEY, recs, 0, tok)).body;
const reasons = (body) => body.rejected.map((x) => x.reason);
const payment = (over = {}) => ({ workerId: 'w-pay', month: '2026-07', grossPaise: 100000, otPaise: 0, deductions: [], advanceRecoveredPaise: 0, netPaise: 100000, roundingPaise: 0, paidPaise: 100000, mode: 'cash', snapshot: { present: 26, half: 0, absent: 0, otHours: 0, pieces: 0, payType: 'monthly', ratePaise: 100000 }, ...over });

test('AC2: nobody can reverse an entry of a locked month; unlock first, then the owner can', async () => {
  // A month the staff can still write to today: use a past month and let the owner record everything.
  const mon = '2026-06';
  const attOwner = o('attendance', { workerId: 'w-lock', status: 'absent', otHours: 0 }, `${mon}-10`);
  const advOwner = o('advance', { workerId: 'w-lock', amountPaise: 50000, mode: 'cash' }, `${mon}-11`);
  const pay = o('wage_payment', payment({ workerId: 'w-lock', month: mon }), `${mon}-30`);
  // Paid for June but recorded in July (payment day outside the month): locked via payload.month.
  const payLate = o('wage_payment', payment({ workerId: 'w-lock-2', month: mon }), '2026-07-02');
  assert.deepEqual(reasons(await push([attOwner, advOwner, pay, payLate])), []);
  const lock = o('period_lock', { month: mon }, '2026-07-01');
  assert.deepEqual(reasons(await push([lock])), []);

  const rev = (target, by) => (by === 'owner' ? o : st)('reversal', { targetId: target.id, reason: 'fix' });
  let body = await push([rev(attOwner, 'owner'), rev(advOwner, 'owner'), rev(pay, 'owner'), rev(payLate, 'owner')]);
  assert.deepEqual(reasons(body), ['period_locked', 'period_locked', 'period_locked', 'period_locked'], 'owner refused while locked');
  body = await push([rev(attOwner, 'staff')], staffToken);
  assert.deepEqual(reasons(body), ['period_locked'], 'staff refused while locked');

  // Unlock, then the same reversal goes through — even in one push after the unlock.
  const unlock = o('reversal', { targetId: lock.id, reason: 'reopen' });
  const fixAtt = rev(attOwner, 'owner');
  body = await push([unlock, fixAtt]);
  assert.deepEqual(reasons(body), []);
  assert.deepEqual(body.accepted, [unlock.id, fixAtt.id]);
  assert.deepEqual(reasons(await push([rev(pay, 'owner')])), [], 'payment reversal accepted after unlock');
});

test('AC3: wage payment net, rounding and paid limits', async () => {
  const m = (n) => `2026-0${n}`;
  const cases = [
    [payment({ workerId: 'n1', month: m(1), grossPaise: 0, netPaise: -30, roundingPaise: 30, paidPaise: 0, deductions: [{ label: 'x', amountPaise: 30 }] }), 'negative_net'],
    [payment({ workerId: 'n2', month: m(1), grossPaise: 100001, netPaise: 100001, roundingPaise: 99, paidPaise: 100100 }), 'invalid_rounding'],
    [payment({ workerId: 'n3', month: m(1), grossPaise: 100060, netPaise: 100060, roundingPaise: -60, paidPaise: 100000 }), 'invalid_rounding'],
    [payment({ workerId: 'n4', month: m(1), grossPaise: 20, netPaise: 20, roundingPaise: -40, paidPaise: -20 }), 'negative_paid'],
  ];
  const body = await push(cases.map(([p]) => o('wage_payment', p, '2026-02-01')));
  assert.deepEqual(reasons(body), cases.map(([, r]) => r));
  const ok = o('wage_payment', payment({ workerId: 'n5', month: m(1), grossPaise: 100050, netPaise: 100050, roundingPaise: 50, paidPaise: 100100 }), '2026-02-01');
  assert.deepEqual(reasons(await push([ok])), [], 'rounding +50 paise is allowed');
});

test('AC4: stock cannot go below zero unless the owner overrides with a reason', async () => {
  const item = 'item-' + Date.now();
  const out = (qty, extra = {}) => ({ itemId: item, qty, purpose: 'other', ...extra });
  assert.deepEqual(reasons(await push([st('stock_out', out(1000))], staffToken)), ['insufficient_stock'], 'staff, zero stock');
  assert.deepEqual(reasons(await push([o('stock_out', out(1000))])), ['insufficient_stock'], 'owner without the flag');
  assert.deepEqual(reasons(await push([o('stock_out', out(1000, { allowNegative: true }))])), ['insufficient_stock'], 'owner flag without a reason');
  assert.deepEqual(reasons(await push([st('stock_out', out(1000, { allowNegative: true, overrideReason: 'count later' }))], staffToken)), ['insufficient_stock'], 'staff with the flag');
  assert.deepEqual(reasons(await push([o('stock_out', out(1000, { allowNegative: true, overrideReason: 'count later' }))])), [], 'owner with flag and reason');
  // Balance is now −1 kg. In 5, out 3, out 3 in one push → the second out is refused (5 − 1 − 3 = 1 left).
  const inn = o('stock_in', { itemId: item, qty: 5000 });
  const o1 = o('stock_out', out(3000)); const o2 = o('stock_out', out(3000));
  let body = await push([inn, o1, o2]);
  assert.deepEqual(body.accepted, [inn.id, o1.id]);
  assert.deepEqual(reasons(body), ['insufficient_stock']);
  // Negative adjustment follows the same rule (balance 1 kg).
  assert.deepEqual(reasons(await push([st('stock_adjust', { itemId: item, qtyDelta: -2000, reason: 'wastage', note: 'wet' })], staffToken)), ['insufficient_stock']);
  assert.deepEqual(reasons(await push([st('stock_adjust', { itemId: item, qtyDelta: -1000, reason: 'wastage', note: 'wet' })], staffToken)), []);
  // Reversing a stock out gives the stock back.
  const rev = o('reversal', { targetId: o1.id, reason: 'wrong item' });
  const o3 = o('stock_out', out(3000));
  body = await push([rev, o3]);
  assert.deepEqual(reasons(body), [], 'reversal of an out frees the stock in the same push');
  // Delivery from a finished item: 2 pieces on hand, deliver 3 refused, 2 accepted.
  const carpet = 'fin-' + Date.now();
  assert.deepEqual(reasons(await push([o('finished_in', { itemId: carpet, qty: 2000 })])), []);
  assert.deepEqual(reasons(await push([st('delivery', { orderId: 'ord-1', qty: 3, finishedItemId: carpet })], staffToken)), ['insufficient_stock']);
  assert.deepEqual(reasons(await push([st('delivery', { orderId: 'ord-1', qty: 2, finishedItemId: carpet })], staffToken)), []);
  // A delivery not linked to finished stock does not touch stock.
  assert.deepEqual(reasons(await push([st('delivery', { orderId: 'ord-2', qty: 50 })], staffToken)), []);
});

test('AC6: photo ids belong to one unit and are never overwritten', async () => {
  const other = await bootstrapUnit(srv.base);
  const id = 'photo-' + Date.now();
  const put = (u, tok, bytes) => fetch(`${srv.base}/api/photos/${id}`, { method: 'PUT', headers: { 'x-unit-id': u, 'x-unit-key': UNIT_KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'image/jpeg' }, body: Buffer.from(bytes) });
  const get = (u, tok) => fetch(`${srv.base}/api/photos/${id}`, { headers: { 'x-unit-id': u, 'x-unit-key': UNIT_KEY, Authorization: `Bearer ${tok}` } });
  const original = [0xff, 0xd8, 1, 2, 3];
  assert.equal((await put(unitId, token, original)).status, 200);
  let r = await put(other.unitId, other.token, [0xff, 0xd8, 9, 9]);
  assert.equal(r.status, 409); assert.equal((await r.json()).error, 'photo_id_taken');
  r = await get(unitId, token);
  assert.equal(r.status, 200);
  assert.deepEqual([...Buffer.from(await r.arrayBuffer())], original, 'unit A still has its own bytes');
  assert.equal((await get(other.unitId, other.token)).status, 404, 'unit B cannot read A\'s photo');
  assert.equal((await put(unitId, token, original)).status, 200, 'same bytes again = retry');
  r = await put(unitId, token, [0xff, 0xd8, 7]);
  assert.equal(r.status, 409); assert.equal((await r.json()).error, 'photo_exists');
  r = await get(unitId, token);
  assert.deepEqual([...Buffer.from(await r.arrayBuffer())], original, 'original kept');
});
