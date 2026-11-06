// Ephemeral server on a fresh Postgres schema per test file.
import './env.mjs';
import { randomUUID, randomBytes } from 'node:crypto';
import { createServer } from '../index.mjs';

export async function startTestServer() {
  const schema = 't_' + randomBytes(6).toString('hex');
  const instance = await createServer({ schema, port: 0, staticDir: null });
  const port = await instance.listen();
  return { base: `http://127.0.0.1:${port}`, instance, async stop() { await instance.db.dropSchema().catch(() => {}); await instance.close(); } };
}
export function authHeaders(unitId, unitKey, token) {
  const h = { 'x-unit-id': unitId, 'x-unit-key': unitKey, 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}
export function makeRec(type, payload, over = {}) {
  return { id: randomUUID(), type, unitId: over.unitId || 'unit-1', payload, by: over.by || 'u-owner', role: over.role || 'owner', device: 'dev-test', at: new Date().toISOString(), day: over.day || '2026-10-23', sync: 'pending', ...over };
}
export async function sync(base, unitId, unitKey, records, since = 0, token) {
  const res = await fetch(`${base}/api/sync`, { method: 'POST', headers: authHeaders(unitId, unitKey, token), body: JSON.stringify({ records, since }) });
  return { status: res.status, body: await res.json() };
}
export const UNIT_KEY = 'k'.repeat(43);
/** Business day in Asia/Kolkata, optionally shifted by whole days (−1 = yesterday). Same clock as the server. */
export function istToday(offsetDays = 0) {
  return new Date(Date.now() + 5.5 * 3600 * 1000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}
/** Add a staff login to a bootstrapped unit and return its token. */
export async function addStaff(base, unitId, ownerId, ownerToken, staffId = 'u-staff-' + randomBytes(3).toString('hex')) {
  const staff = makeRec('user', { entityId: staffId, name: 'Munshi', phone: '', role: 'staff', pinHash: PIN.hash, pinSalt: PIN.salt, active: true }, { unitId, by: ownerId });
  const r = await sync(base, unitId, UNIT_KEY, [staff], 0, ownerToken);
  if (r.body.rejected.length) throw new Error('staff rejected');
  const tok = await fetch(`${base}/api/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitId, unitKey: UNIT_KEY, userId: staffId, pin: '1234' }) });
  return { staffId, staffToken: (await tok.json()).token };
}
// SPEC-M18: units are created by a founder and claimed with an invite. Tests use a fixed founder key.
export const TEST_ADMIN = { name: 'tester', key: 'test-founder-key-0001' };
/** Founder token for tests; adds TEST_ADMIN to ADMIN_KEYS when it is missing. */
export async function founderToken(base) {
  const cur = process.env.ADMIN_KEYS || '';
  if (!cur.split(',').some((p) => p.startsWith(TEST_ADMIN.name + ':'))) process.env.ADMIN_KEYS = [cur, `${TEST_ADMIN.name}:${TEST_ADMIN.key}`].filter(Boolean).join(',');
  const r = await fetch(`${base}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(TEST_ADMIN) });
  return (await r.json()).token;
}
export const adminHeaders = (token) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
/** A founder creates an organisation; returns {unitId, invite}. */
export async function createOrg(base, body = {}) {
  const tok = await founderToken(base);
  const r = await fetch(`${base}/api/admin/orgs`, { method: 'POST', headers: adminHeaders(tok), body: JSON.stringify({ name: 'Test Unit', industry: 'carpet', lang: 'hi', ownerName: 'Owner', ownerPhone: '9999999999', ...body }) });
  const b = await r.json();
  if (r.status !== 201) throw new Error('create org failed: ' + JSON.stringify(b));
  return { unitId: b.unitId, invite: b.invite, adminToken: tok };
}
/** Claim an invite with a unit key; returns the claim response. */
export async function claim(base, invite, unitKey = UNIT_KEY) {
  const r = await fetch(`${base}/api/invites/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: invite.token, unitKey }) });
  return { status: r.status, body: await r.json() };
}
/** Create unit (founder + invite) + owner user + setting; return {unitId, ownerId, token, adminToken}. */
export async function bootstrapUnit(base, { pinHash, pinSalt, industry = 'carpet', modules } = {}) {
  const { unitId, invite, adminToken } = await createOrg(base, { industry, ...(modules ? { modules } : {}) });
  const c = await claim(base, invite);
  if (c.status !== 200) throw new Error('claim failed: ' + JSON.stringify(c.body));
  const ownerId = 'u-' + randomBytes(4).toString('hex');
  const setting = makeRec('setting', { entityId: 'unit', unitName: 'Test Unit', ownerPhone: '9999999999', lang: 'hi', workingDaysPerMonth: 26, photoRequiredAbovePaise: 200000, holidays: [] }, { unitId, by: ownerId });
  const user = makeRec('user', { entityId: ownerId, name: 'Owner', phone: '9999999999', role: 'owner', pinHash: pinHash || PIN.hash, pinSalt: pinSalt || PIN.salt, active: true }, { unitId, by: ownerId });
  const r = await sync(base, unitId, UNIT_KEY, [setting, user]);
  if (r.body.rejected.length) throw new Error('bootstrap rejected: ' + JSON.stringify(r.body.rejected));
  const tok = await fetch(`${base}/api/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitId, unitKey: UNIT_KEY, userId: ownerId, pin: '1234' }) });
  const tb = await tok.json();
  return { unitId, ownerId, token: tb.token, adminToken };
}
// PIN 1234 hashed with PBKDF2-SHA256 100k / salt below (computed in pin.test).
import { pbkdf2Sync } from 'node:crypto';
const salt = Buffer.from('0123456789abcdef');
export const PIN = { salt: salt.toString('base64'), hash: pbkdf2Sync('1234', salt, 100_000, 32, 'sha256').toString('base64') };
