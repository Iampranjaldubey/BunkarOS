// SPEC-M15 catalogue rules on the server, and SPEC-M13 price removal for the catalogue and orders,
// checked on the raw response text (criterion 5: no price field reaches an operator while prices are hidden).
import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, bootstrapUnit, addStaff, makeRec, sync, authHeaders, UNIT_KEY, istToday } from './helpers.mjs';

let srv, unitId, ownerId, token, staff;
test.before(async () => {
  srv = await startTestServer();
  ({ unitId, ownerId, token } = await bootstrapUnit(srv.base));
  staff = await addStaff(srv.base, unitId, ownerId, token, 'op-cat');
});
test.after(async () => { await srv.stop(); });

let tick = 0;
const later = () => new Date(Date.now() + 1000 * ++tick).toISOString();
const o = (type, payload, day = istToday()) => makeRec(type, payload, { unitId, by: ownerId, role: 'owner', day, at: later() });
const op = (type, payload, day = istToday()) => makeRec(type, payload, { unitId, by: staff.staffId, role: 'staff', day, at: later() });
const push = async (recs, tok = token) => (await sync(srv.base, unitId, UNIT_KEY, recs, 0, tok)).body;
const reasons = (b) => b.rejected.map((x) => x.reason);
const carpet = (over = {}) => ({ entityId: 'kashan', design: 'Kashan 101', lengthMilli: 8000, widthMilli: 10000, sizeUnit: 'ft', mode: 'quantity', photoIds: ['ph1', 'ph2', 'ph3'], costPaise: 3_000_000, pricePaise: 4_500_000, active: true, ...over });
const order = (over = {}) => ({ entityId: 'ord-1', buyerId: 'b1', orderNo: 'ORD-001', design: 'Kashan', size: '8x10', qty: 4, dueDate: '2026-12-31', pricePaise: 500_000, receivedOn: istToday(), ...over });
const baseSetting = { entityId: 'unit', unitName: 'Test Unit', ownerPhone: '9999999999', lang: 'hi', workingDaysPerMonth: 26, photoRequiredAbovePaise: 200000, holidays: [] };

test('AC1–AC5, AC10–AC13: add, reserve, deliver, release, sold directly, written off, with the limits', async () => {
  assert.deepEqual(reasons(await push([o('carpet', carpet()), o('carpet_in', { carpetId: 'kashan', qty: 5 }), o('order', order())])), []);
  // AC4: reserve 3; 2 more exceeds what the order still needs (1).
  const res3 = o('carpet_reserve', { carpetId: 'kashan', orderId: 'ord-1', qty: 3 });
  assert.deepEqual(reasons(await push([res3])), []);
  assert.deepEqual(reasons(await push([o('carpet_reserve', { carpetId: 'kashan', orderId: 'ord-1', qty: 2 })])), ['exceeds_order']);
  assert.deepEqual(reasons(await push([o('carpet_reserve', { carpetId: 'kashan', orderId: 'nope', qty: 1 }), o('carpet_reserve', { carpetId: 'ghost', orderId: 'ord-1', qty: 1 })])), ['unknown_order', 'unknown_carpet']);
  // AC5: deliver 2 from the reservation; 3 more exceeds the pending 2.
  assert.deepEqual(reasons(await push([o('delivery', { orderId: 'ord-1', qty: 2, carpetId: 'kashan' })])), []);
  assert.deepEqual(reasons(await push([o('delivery', { orderId: 'ord-1', qty: 3, carpetId: 'kashan' })])), ['exceeds_order']);
  assert.deepEqual(reasons(await push([o('delivery', { orderId: 'ord-1', qty: 1, carpetId: 'kashan', finishedItemId: 'item-x' })])), ['invalid_delivery']);
  // Now: in stock 2, reserved 1. AC13: note required; not more than in stock; the reserved one cannot be sold.
  assert.deepEqual(reasons(await push([o('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'sold', note: ' ' })])), ['note_required']);
  assert.deepEqual(reasons(await push([o('carpet_out', { carpetId: 'kashan', qty: 3, kind: 'sold', note: 'x' })])), ['insufficient_stock']);
  assert.deepEqual(reasons(await push([o('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'gift', note: 'x' })])), ['invalid_kind']);
  // AC11: sold directly 1, back-dated to yesterday, no order. AC12: written off 1. Then the reserved one is refused.
  const sale = o('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'sold', note: 'दुकान पर बेचा' }, istToday(-1));
  assert.deepEqual(reasons(await push([sale, o('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'written_off', note: 'पानी से ख़राब' }), o('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'written_off', note: 'x' })])), ['insufficient_stock']);
  // AC14: reversing the sale puts one back in stock → it can be written off now.
  assert.deepEqual(reasons(await push([o('reversal', { targetId: sale.id, reason: 'ग़लती से दर्ज' }), o('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'written_off', note: 'x' })])), []);
  // AC10: release the reservation (reversal with a reason) → the 1 reserved carpet is back in stock and can be sold.
  assert.deepEqual(reasons(await push([o('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'sold', note: 'x' })])), ['insufficient_stock']);
  assert.deepEqual(reasons(await push([o('reversal', { targetId: res3.id, reason: '' })])), ['reason_required']);
  assert.deepEqual(reasons(await push([o('reversal', { targetId: res3.id, reason: 'ऑर्डर बदला' }), o('carpet_out', { carpetId: 'kashan', qty: 1, kind: 'sold', note: 'x' })])), []);
  // Taking back the added carpets would leave the catalogue below zero.
  const added = (await push([])).records.find((r) => r.type === 'carpet_in' && r.payload.carpetId === 'kashan');
  assert.deepEqual(reasons(await push([o('reversal', { targetId: added.id, reason: 'x' })])), ['insufficient_stock']);
});

test('AC2 + AC3: at most 4 photos, valid sizes, unique piece tags, a piece is added once', async () => {
  const bad = [carpet({ entityId: 'c5', photoIds: ['a', 'b', 'c', 'd', 'e'] }), carpet({ entityId: 'c6', widthMilli: 0 }), carpet({ entityId: 'c7', sizeUnit: 'inch' }), carpet({ entityId: 'c8', pricePaise: -1 }), carpet({ entityId: 'c9', mode: 'piece' })];
  assert.deepEqual(reasons(await push(bad.map((c) => o('carpet', c)))), ['too_many_photos', 'invalid_size', 'invalid_size', 'invalid_price', 'tag_required']);
  assert.deepEqual(reasons(await push([o('carpet', carpet({ entityId: 'c4', photoIds: ['a', 'b', 'c', 'd'] }))])), []);
  // Tags: unique among active carpets (case and spaces ignored), also inside one push.
  assert.deepEqual(reasons(await push([o('carpet', carpet({ entityId: 'p42', mode: 'piece', tag: 'BH-0042' })), o('carpet', carpet({ entityId: 'p42b', mode: 'piece', tag: ' bh-0042' }))])), ['duplicate_tag']);
  assert.deepEqual(reasons(await push([op('carpet', carpet({ entityId: 'p42c', mode: 'piece', tag: 'BH-0042', costPaise: undefined, pricePaise: undefined }))], staff.staffToken)), ['duplicate_tag']);
  assert.deepEqual(reasons(await push([o('carpet', carpet({ entityId: 'p42', mode: 'piece', tag: 'BH-0042', notes: 'edit keeps its own tag' }))])), []);
  // A piece is added once, qty 1.
  assert.deepEqual(reasons(await push([o('carpet_in', { carpetId: 'p42', qty: 2 })])), ['piece_added']);
  assert.deepEqual(reasons(await push([o('carpet_in', { carpetId: 'p42', qty: 1 }), o('carpet_in', { carpetId: 'p42', qty: 1 })])), ['piece_added']);
  // A carpet's mode cannot change once carpets were added.
  assert.deepEqual(reasons(await push([o('carpet', carpet({ entityId: 'p42', mode: 'quantity', tag: undefined }))])), ['invalid_carpet']);
});

test('locked months refuse catalogue movements dated inside them, and their reversals', async () => {
  assert.deepEqual(reasons(await push([o('carpet', carpet({ entityId: 'lk', design: 'Lock test' })), o('carpet_in', { carpetId: 'lk', qty: 3 }, '2025-03-10'), o('order', order({ entityId: 'ord-lk', orderNo: 'ORD-LK' }))])), []);
  const res = o('carpet_reserve', { carpetId: 'lk', orderId: 'ord-lk', qty: 1 }, '2025-03-11');
  assert.deepEqual(reasons(await push([res, o('period_lock', { month: '2025-03' }, '2025-04-01')])), []);
  assert.deepEqual(reasons(await push([
    o('carpet_out', { carpetId: 'lk', qty: 1, kind: 'sold', note: 'x' }, '2025-03-20'),
    o('carpet_in', { carpetId: 'lk', qty: 1 }, '2025-03-20'),
    o('reversal', { targetId: res.id, reason: 'x' }),
  ])), ['period_locked', 'period_locked', 'period_locked']);
  assert.deepEqual(reasons(await push([o('carpet_out', { carpetId: 'lk', qty: 1, kind: 'sold', note: 'x' }, istToday())])), [], 'today is not locked');
});

/** Raw /api/sync response text as an operator receives it. */
async function rawSync(tok, records = []) {
  const res = await fetch(`${srv.base}/api/sync`, { method: 'POST', headers: authHeaders(unitId, UNIT_KEY, tok), body: JSON.stringify({ records, since: 0 }) });
  assert.equal(res.status, 200);
  return res.text();
}
const PRICE_RE = /"(pricePaise|costPaise)"/;

test('criterion 5 / SPEC-M13 AC5 / M15 AC8: with "see prices" off no price field of a carpet or order reaches an operator; the owner sees them', async () => {
  assert.deepEqual(reasons(await push([o('carpet', carpet({ entityId: 'pr', design: 'Price test', pricePaise: 7_700_000, costPaise: 5_500_000 })), o('order', order({ entityId: 'ord-pr', orderNo: 'ORD-PR', pricePaise: 990_000 }))])), []);
  // On (default): the operator's raw response carries prices.
  assert.match(await rawSync(staff.staffToken), PRICE_RE);
  assert.deepEqual(reasons(await push([o('setting', { ...baseSetting, operatorPerms: { addEntries: true, seePrices: false } })])), []);

  // Off: a full pull, as raw text. Carpets and orders are there, no price field anywhere in the body.
  const pull = await rawSync(staff.staffToken);
  const body = JSON.parse(pull);
  assert.equal(body.view.seePrices, false);
  assert.ok(body.records.some((r) => r.type === 'carpet') && body.records.some((r) => r.type === 'order'), 'carpets and orders are sent');
  assert.doesNotMatch(pull, PRICE_RE, 'operator pull has no pricePaise / costPaise');
  assert.ok(!pull.includes('7700000') && !pull.includes('5500000') && !pull.includes('990000'), 'not even the amounts');

  // The echo of the operator's own push: a carpet edit without prices and a new carpet. The stored prices are kept for the owner.
  const edit = op('carpet', { ...carpet({ entityId: 'pr', design: 'Price test', notes: 'operator edit' }), costPaise: undefined, pricePaise: undefined });
  delete edit.payload.costPaise; delete edit.payload.pricePaise;
  const fresh = op('carpet', { entityId: 'op-new', design: 'Operator carpet', lengthMilli: 5000, widthMilli: 8000, sizeUnit: 'ft', mode: 'quantity', photoIds: [], active: true });
  const echo = await rawSync(staff.staffToken, [edit, fresh, op('carpet_in', { carpetId: 'op-new', qty: 2 })]);
  assert.deepEqual(JSON.parse(echo).rejected, []);
  assert.doesNotMatch(echo, PRICE_RE, 'push echo has no price fields');
  // An operator record carrying a price is refused (and not echoed).
  const priced = await rawSync(staff.staffToken, [op('carpet', { ...carpet({ entityId: 'op-p', design: 'x' }) })]);
  assert.deepEqual(JSON.parse(priced).rejected.map((x) => x.reason), ['forbidden_price']);
  assert.doesNotMatch(priced, PRICE_RE);
  // The other APIs an operator token can reach: the token-less bootstrap pull and the worker page of a worker.
  const boot = await fetch(`${srv.base}/api/sync`, { method: 'POST', headers: authHeaders(unitId, UNIT_KEY), body: JSON.stringify({ records: [], since: 0 }) });
  assert.doesNotMatch(await boot.text(), PRICE_RE);
  assert.deepEqual(reasons(await push([o('worker', { entityId: 'w-pr', name: 'Rafiq', jobTitle: 'weaver', payType: 'monthly', salaryPaise: 1_200_000, otRatePaise: 0, joinedOn: istToday(), active: true, accessCode: '1234' })])), []);
  const link = await fetch(`${srv.base}/api/worker-links`, { method: 'POST', headers: authHeaders(unitId, UNIT_KEY, staff.staffToken), body: JSON.stringify({ workerId: 'w-pr' }) });
  const wtok = (await link.json()).token;
  const page = await fetch(`${srv.base}/api/w/${wtok}`);
  assert.equal(page.status, 200);
  assert.doesNotMatch(await page.text(), PRICE_RE);

  // The owner still sees every price, including the stored one kept on the operator's edit.
  const owner = await rawSync(token);
  assert.equal(JSON.parse(owner).view.seePrices, true);
  const latest = JSON.parse(owner).records.filter((r) => r.type === 'carpet' && r.payload.entityId === 'pr').at(-1).payload;
  assert.deepEqual([latest.notes, latest.pricePaise, latest.costPaise], ['operator edit', 7_700_000, 5_500_000]);
  assert.match(owner, /"pricePaise":990000/);

  // On again → the operator receives prices again.
  assert.deepEqual(reasons(await push([o('setting', { ...baseSetting, operatorPerms: { addEntries: true, seePrices: true } })])), []);
  assert.match(await rawSync(staff.staffToken), /"pricePaise":7700000/);
});
