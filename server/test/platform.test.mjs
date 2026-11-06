// SPEC-M18 server acceptance: isolation (AC1), modules (AC2, AC3), paused (AC4), invites (AC5), changes log (AC6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, bootstrapUnit, createOrg, claim, founderToken, adminHeaders, makeRec, sync, UNIT_KEY } from './helpers.mjs';
import { withUnit, withAdmin } from '../db.mjs';

let srv;
test.before(async () => { srv = await startTestServer(); });
test.after(async () => { await srv.stop(); });

const setOrg = async (tok, unitId, body) => {
  const r = await fetch(`${srv.base}/api/admin/units/${unitId}/org`, { method: 'POST', headers: adminHeaders(tok), body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
const worker = (unitId, by) => makeRec('worker', { entityId: 'w-' + Math.random().toString(36).slice(2, 8), name: 'Rafiq', jobTitle: 'weaver', payType: 'monthly', salaryPaise: 1200000, otRatePaise: 0, joinedOn: '2026-01-01', active: true }, { unitId, by });

test('AC1: a unit-scoped query without a unit filter sees only its own rows (row-level security)', async () => {
  const db = srv.instance.db;
  assert.equal(db.rlsMode, 'role', 'requests run as the limited app role');
  const a = await bootstrapUnit(srv.base); const b = await bootstrapUnit(srv.base);
  await sync(srv.base, b.unitId, UNIT_KEY, [worker(b.unitId, b.ownerId)], 0, b.token);
  const units = await withUnit(db, a.unitId, async (u) => (await u.pool.query('SELECT DISTINCT unit_id FROM records')).rows.map((r) => r.unit_id));
  assert.deepEqual(units, [a.unitId]);
  // Writing another unit's row inside A's scope is refused by the database itself.
  await assert.rejects(withUnit(db, a.unitId, (u) => u.pool.query("INSERT INTO records (id, unit_id, type, json, at) VALUES ('x-forged-1', $1, 'advance', '{}', 'now')", [b.unitId])), /row-level security/);
  // Outside any scope nothing is visible.
  assert.equal((await db.pool.query('SELECT COUNT(*)::int AS n FROM records')).rows[0].n, 0);
  // The founders' read path sees every unit but can never write a record.
  const all = await withAdmin(db, async (u) => (await u.pool.query('SELECT COUNT(DISTINCT unit_id)::int AS n FROM records')).rows[0].n);
  assert.ok(all >= 2);
  await assert.rejects(withAdmin(db, (u) => u.pool.query("INSERT INTO records (id, unit_id, type, json, at) VALUES ('x-forged-2', $1, 'advance', '{}', 'now')", [a.unitId])), /row-level security/);
});

test('AC2 + AC3: a module that is off refuses its records and their reversals; on again → accepted; attendance off turns wages off', async () => {
  const u = await bootstrapUnit(srv.base);
  const w = worker(u.unitId, u.ownerId);
  const adv = makeRec('advance', { workerId: w.payload.entityId, amountPaise: 50000, mode: 'cash' }, { unitId: u.unitId, by: u.ownerId });
  let r = await sync(srv.base, u.unitId, UNIT_KEY, [w, adv], 0, u.token);
  assert.deepEqual(r.body.rejected, []);
  assert.deepEqual(r.body.org.modules, { attendance: true, wages: true, advances: true, stock: true, orders: true, catalogue: true });
  const off = await setOrg(u.adminToken, u.unitId, { modules: { advances: false }, reason: 'partner does not give advances' });
  assert.equal(off.status, 200); assert.equal(off.body.org.modules.advances, false);
  const adv2 = makeRec('advance', { workerId: w.payload.entityId, amountPaise: 1000, mode: 'cash' }, { unitId: u.unitId, by: u.ownerId });
  const rev = makeRec('reversal', { targetId: adv.id, reason: 'mistake' }, { unitId: u.unitId, by: u.ownerId });
  r = await sync(srv.base, u.unitId, UNIT_KEY, [adv2, rev], 0, u.token);
  assert.deepEqual(r.body.rejected.map((x) => x.reason), ['module_off', 'module_off']);
  assert.equal(r.body.org.modules.advances, false);
  assert.ok(r.body.records.some((x) => x.id === adv.id), 'data stays and still syncs');
  await setOrg(u.adminToken, u.unitId, { modules: { advances: true }, reason: 'back on' });
  r = await sync(srv.base, u.unitId, UNIT_KEY, [adv2, rev], 0, u.token);
  assert.deepEqual(r.body.rejected, []);
  const att = await setOrg(u.adminToken, u.unitId, { modules: { attendance: false }, reason: 'test' });
  assert.equal(att.body.org.modules.wages, false, 'wages needs attendance');
  // Turning wages on while attendance stays off is not possible.
  const w2 = await setOrg(u.adminToken, u.unitId, { modules: { wages: true }, reason: 'test' });
  assert.equal(w2.body.org.modules.wages, false);
});

test('AC4: paused → pushes refused (org_paused), pull and login work; active again → the same entries are accepted', async () => {
  const u = await bootstrapUnit(srv.base);
  assert.equal((await setOrg(u.adminToken, u.unitId, { status: 'paused', reason: 'unpaid' })).status, 200);
  const w = worker(u.unitId, u.ownerId);
  let r = await sync(srv.base, u.unitId, UNIT_KEY, [w], 0, u.token);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.rejected.map((x) => x.reason), ['org_paused']);
  assert.equal(r.body.org.status, 'paused');
  assert.ok(r.body.records.length > 0, 'pull still works');
  const tok = await fetch(`${srv.base}/api/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitId: u.unitId, unitKey: UNIT_KEY, userId: u.ownerId, pin: '1234' }) });
  assert.equal(tok.status, 200, 'login works');
  await setOrg(u.adminToken, u.unitId, { status: 'active', reason: 'paid' });
  r = await sync(srv.base, u.unitId, UNIT_KEY, [w], 0, u.token);
  assert.deepEqual(r.body.rejected, []);
  assert.equal((await setOrg(u.adminToken, u.unitId, { status: 'invited', reason: 'x' })).status, 400);
});

test('AC5: no unit without an invite; an invite works once; expired, cancelled or replaced invites are refused', async () => {
  const res = await fetch(`${srv.base}/api/units`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitId: 'unit-open-' + Date.now(), unitKey: UNIT_KEY, name: 'Open' }) });
  assert.equal(res.status, 403); assert.equal((await res.json()).error, 'invite_required');
  const { unitId, invite, adminToken } = await createOrg(srv.base, { name: 'Kanpur Bags', industry: 'bags', ownerName: 'Imran', ownerPhone: '9811100000' });
  assert.match(invite.code, /^[A-Z2-9]{8}$/);
  // Lookup by the typed code (grouped, any case) and by the link token.
  const look = await fetch(`${srv.base}/api/invites/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: `${invite.code.slice(0, 4).toLowerCase()}-${invite.code.slice(4)}` }) });
  const lb = await look.json();
  assert.equal(look.status, 200); assert.equal(lb.unitName, 'Kanpur Bags'); assert.equal(lb.industry, 'bags'); assert.equal(lb.ownerName, 'Imran');
  // Before the claim the unit cannot sync (no key yet) and its shop code is not public.
  assert.equal((await sync(srv.base, unitId, UNIT_KEY, [], 0)).status, 401);
  // Resend replaces the invite: the old one stops working.
  const re = await fetch(`${srv.base}/api/admin/units/${unitId}/invite`, { method: 'POST', headers: adminHeaders(adminToken), body: JSON.stringify({ action: 'resend' }) });
  const fresh = (await re.json()).invite;
  assert.equal((await claim(srv.base, invite)).status, 410);
  const ok = await claim(srv.base, fresh);
  assert.equal(ok.status, 200); assert.equal(ok.body.unitId, unitId); assert.equal(ok.body.org.industry, 'bags'); assert.equal(ok.body.org.status, 'active');
  assert.equal((await claim(srv.base, fresh, 'z'.repeat(43))).status, 410, 'used once');
  assert.equal((await sync(srv.base, unitId, UNIT_KEY, [], 0)).status, 200, 'the claiming phone can sync');
  // Cancelled invites are refused.
  const second = await createOrg(srv.base, { name: 'Second' });
  await fetch(`${srv.base}/api/admin/units/${second.unitId}/invite`, { method: 'POST', headers: adminHeaders(second.adminToken), body: JSON.stringify({ action: 'cancel' }) });
  assert.equal((await claim(srv.base, second.invite)).status, 410);
  // Expired invites are refused.
  const third = await createOrg(srv.base, { name: 'Third' });
  await srv.instance.db.pool.query("UPDATE invites SET expires_at = '2000-01-01T00:00:00.000Z' WHERE unit_id = $1", [third.unitId]);
  const exp = await claim(srv.base, third.invite);
  assert.equal(exp.status, 410); assert.equal(exp.body.error, 'invite_expired');
  // Unknown invites.
  assert.equal((await claim(srv.base, { token: 'nope-nope-nope-nope-nope' })).status, 404);
});

test('AC6: every founder action is logged with before and after; a change without a reason is refused', async () => {
  const { unitId, invite, adminToken } = await createOrg(srv.base, { name: 'Logged' });
  await claim(srv.base, invite);
  assert.equal((await setOrg(adminToken, unitId, { modules: { catalogue: false } })).status, 400, 'reason required');
  await setOrg(adminToken, unitId, { modules: { catalogue: false }, reason: 'no finished stock' });
  await setOrg(adminToken, unitId, { status: 'paused', reason: 'trial ended' });
  const ev = await (await fetch(`${srv.base}/api/admin/units/${unitId}/events`, { headers: adminHeaders(adminToken) })).json();
  assert.deepEqual(ev.events.map((e) => e.action), ['status', 'modules', 'joined', 'create']);
  const mod = ev.events.find((e) => e.action === 'modules');
  assert.equal(mod.before.modules.catalogue, true); assert.equal(mod.after.modules.catalogue, false);
  assert.equal(mod.reason, 'no finished stock'); assert.equal(mod.actor, 'tester');
  // The app role cannot change or delete the log.
  await assert.rejects(srv.instance.db.pool.query('DELETE FROM platform_events'), /permission denied/);
  // Founders' unit page: usage, no records.
  const det = await (await fetch(`${srv.base}/api/admin/units/${unitId}`, { headers: adminHeaders(adminToken) })).json();
  assert.equal(det.records, undefined); assert.equal(det.org.modules.catalogue, false);
  // Industries list.
  const ind = await (await fetch(`${srv.base}/api/admin/industries`, { headers: adminHeaders(await founderToken(srv.base)) })).json();
  assert.deepEqual(ind.industries.map((i) => i.id), ['carpet', 'bags']);
});
