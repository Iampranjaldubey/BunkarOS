// Seed a demo unit through the public API (same path the app uses). Prints the login.
// Usage: BASE=http://localhost:8791 node seed-demo.mjs   (defaults to localhost:8791)
import { randomUUID, randomBytes, pbkdf2Sync } from 'node:crypto';

const BASE = process.env.BASE || 'http://localhost:8791';
const PIN = process.env.DEMO_PIN || '1234';
const unitId = process.env.DEMO_UNIT_ID || 'demo-' + randomBytes(3).toString('hex');
const unitKey = randomBytes(32).toString('base64url');
const IST = 5.5 * 3600 * 1000;
const day = (offset = 0) => new Date(Date.now() + IST - offset * 86_400_000).toISOString().slice(0, 10);
const month = day().slice(0, 7);
const hash = (pin) => { const salt = randomBytes(16); return { pinHash: pbkdf2Sync(pin, salt, 100_000, 32, 'sha256').toString('base64'), pinSalt: salt.toString('base64') }; };

const ownerId = randomUUID(); const staffId = randomUUID();
const rec = (type, payload, by = ownerId, role = 'owner', d = day()) => ({ id: randomUUID(), type, unitId, payload, by, role, device: 'seed', at: new Date().toISOString(), day: d, sync: 'pending' });
const post = async (path, body, headers = {}) => { const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };

const u = await post('/api/units', { unitId, unitKey, name: 'Ideal Carpet (Demo)' });
if (u.status >= 300) throw new Error('unit: ' + JSON.stringify(u.body));
const auth = { 'x-unit-id': unitId, 'x-unit-key': unitKey };
const boot = await post('/api/sync', { records: [
  rec('setting', { entityId: 'unit', unitName: 'Ideal Carpet (Demo)', ownerPhone: '9999999999', lang: 'hi', workingDaysPerMonth: 26, photoRequiredAbovePaise: 200000, holidays: [] }),
  rec('user', { entityId: ownerId, name: 'Ramesh (Owner)', phone: '9999999999', role: 'owner', ...hash(PIN), active: true }),
], since: 0 }, auth);
if (boot.body.rejected?.length) throw new Error('bootstrap rejected ' + JSON.stringify(boot.body.rejected));
const tok = await post('/api/auth/token', { unitId, unitKey, userId: ownerId, pin: PIN });
const bearer = { ...auth, Authorization: 'Bearer ' + tok.body.token };

const workers = [['Rafiq', 'weaver', 'monthly', 1200000], ['Salim', 'weaver', 'monthly', 1100000], ['Guddu', 'helper', 'daily', 40000], ['Meena', 'finisher', 'piece', 1500]].map(([name, jobTitle, payType, rate]) => ({
  entityId: randomUUID(), name, jobTitle, payType, salaryPaise: payType === 'monthly' ? rate : undefined, dailyRatePaise: payType === 'daily' ? rate : undefined, pieceRatePaise: payType === 'piece' ? rate : undefined,
  otRatePaise: payType === 'monthly' ? Math.round(rate / 26 / 8) : payType === 'daily' ? Math.round(rate / 8) : 0, joinedOn: '2026-01-01', active: true }));
const items = [['Wool red', 'raw', 'kg', 10000], ['Wool beige', 'raw', 'kg', 10000], ['Cotton yarn', 'raw', 'kg', 5000], ['Dye navy', 'raw', 'litre', 2000], ['Kashan 8x10', 'finished', 'pcs', 0]].map(([name, kind, unit, low]) => ({ entityId: randomUUID(), name, kind, unit, lowStockQty: low, active: true }));
const buyer = { entityId: randomUUID(), name: 'Sharma Exports', phone: '9811111111', city: 'Bhadohi', active: true };
const orders = [[`ORD-001`, 'Kashan', '8x10', 20, day(-10), 500000], [`ORD-002`, 'Bokhara', '6x9', 12, day(3), 350000], [`ORD-003`, 'Gabbeh', '5x8', 8, day(-2), 280000]].map(([orderNo, design, size, qty, dueDate, pricePaise]) => ({ entityId: randomUUID(), buyerId: buyer.entityId, orderNo, design, size, qty, dueDate, pricePaise, receivedOn: day(20) }));

const records = [
  rec('user', { entityId: staffId, name: 'Munshi Ji', phone: '', role: 'staff', ...hash(PIN), active: true }),
  ...workers.map((w) => rec('worker', w)), ...items.map((i) => rec('item', i)), rec('buyer', buyer), ...orders.map((o) => rec('order', o)),
  rec('stock_in', { itemId: items[0].entityId, qty: 25000, ratePaise: 40000, supplier: 'Mirzapur Wool' }, staffId, 'staff', day(12)),
  rec('stock_in', { itemId: items[1].entityId, qty: 18000, ratePaise: 38000, supplier: 'Mirzapur Wool' }, staffId, 'staff', day(12)),
  rec('stock_in', { itemId: items[2].entityId, qty: 6000 }, staffId, 'staff', day(9)),
  rec('stock_in', { itemId: items[3].entityId, qty: 1500 }, staffId, 'staff', day(9)),
  rec('stock_out', { itemId: items[0].entityId, qty: 17500, purpose: 'production', orderId: orders[0].entityId }, staffId, 'staff', day(5)),
  rec('stock_adjust', { itemId: items[1].entityId, qtyDelta: -250, reason: 'wastage', note: 'monsoon moisture' }, staffId, 'staff', day(4)),
  rec('finished_in', { itemId: items[4].entityId, qty: 14000, orderId: orders[0].entityId }, staffId, 'staff', day(3)),
  rec('order_status', { orderId: orders[0].entityId, status: 'in_production' }, staffId, 'staff', day(15)),
  rec('order_status', { orderId: orders[1].entityId, status: 'in_production' }, staffId, 'staff', day(8)),
  rec('delivery', { orderId: orders[0].entityId, qty: 12, finishedItemId: items[4].entityId }, staffId, 'staff', day(1)),
  rec('order_note', { orderId: orders[1].entityId, text: 'Buyer asked for darker border' }, ownerId, 'owner', day(2)),
  rec('advance', { workerId: workers[0].entityId, amountPaise: 100000, mode: 'cash' }, staffId, 'staff', day(14)),
  rec('advance', { workerId: workers[1].entityId, amountPaise: 200000, mode: 'upi' }, staffId, 'staff', day(7)),
];
// Attendance for the month so far (skip Sundays): mostly present, a few absences / half days / OT.
for (let d = 1; d <= Number(day().slice(8)); d++) {
  const dd = `${month}-${String(d).padStart(2, '0')}`;
  if (new Date(dd + 'T00:00:00Z').getUTCDay() === 0) continue;
  workers.forEach((w, i) => {
    if (w.payType === 'piece') { if (d % 3 === 0) records.push(rec('piece_entry', { workerId: w.entityId, count: 10 + i, pieceRatePaise: 1500 }, staffId, 'staff', dd)); return; }
    const status = (d + i) % 9 === 0 ? 'absent' : (d + i) % 7 === 0 ? 'half' : 'present';
    records.push(rec('attendance', { workerId: w.entityId, status, otHours: status === 'present' && (d + i) % 5 === 0 ? 2 : 0 }, staffId, 'staff', dd));
  });
}
// The server refuses records whose author differs from the token holder, so push each author's
// records with that author's own token (owner first: it carries the staff user record).
const ownerRecs = records.filter((x) => x.by === ownerId);
const staffRecs = records.filter((x) => x.by === staffId);
const r1 = await post('/api/sync', { records: ownerRecs, since: 0 }, bearer);
const stok = await post('/api/auth/token', { unitId, unitKey, userId: staffId, pin: PIN });
const r2 = await post('/api/sync', { records: staffRecs, since: 0 }, { ...auth, Authorization: 'Bearer ' + stok.body.token });
const rejected = [...(r1.body.rejected ?? []), ...(r2.body.rejected ?? [])];
if (rejected.length) console.error('rejected:', rejected);
console.log(JSON.stringify({ unitId, unitKey, owner: 'Ramesh (Owner)', staff: 'Munshi Ji', pin: PIN, accepted: (r1.body.accepted?.length ?? 0) + (r2.body.accepted?.length ?? 0), rejected: rejected.length }, null, 2));
console.log(`\nDemo login: open the app → "मौजूदा यूनिट से जुड़ें" → unit code ${unitId} + key above → pick a name → PIN ${PIN}`);
