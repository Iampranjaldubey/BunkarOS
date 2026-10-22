// Ephemeral server on a fresh Postgres schema per test file.
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
/** Create unit + owner user + setting; return {unitId, ownerId, token}. */
export async function bootstrapUnit(base, { pinHash, pinSalt } = {}) {
  const unitId = 'unit-' + randomBytes(4).toString('hex');
  await fetch(`${base}/api/units`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitId, unitKey: UNIT_KEY, name: 'Test Unit' }) });
  const ownerId = 'u-' + randomBytes(4).toString('hex');
  const setting = makeRec('setting', { entityId: 'unit', unitName: 'Test Unit', ownerPhone: '9999999999', lang: 'hi', workingDaysPerMonth: 26, photoRequiredAbovePaise: 200000, holidays: [] }, { unitId, by: ownerId });
  const user = makeRec('user', { entityId: ownerId, name: 'Owner', phone: '9999999999', role: 'owner', pinHash: pinHash || PIN.hash, pinSalt: pinSalt || PIN.salt, active: true }, { unitId, by: ownerId });
  const r = await sync(base, unitId, UNIT_KEY, [setting, user]);
  if (r.body.rejected.length) throw new Error('bootstrap rejected: ' + JSON.stringify(r.body.rejected));
  const tok = await fetch(`${base}/api/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitId, unitKey: UNIT_KEY, userId: ownerId, pin: '1234' }) });
  const tb = await tok.json();
  return { unitId, ownerId, token: tb.token };
}
// PIN 1234 hashed with PBKDF2-SHA256 100k / salt below (computed in pin.test).
import { pbkdf2Sync } from 'node:crypto';
const salt = Buffer.from('0123456789abcdef');
export const PIN = { salt: salt.toString('base64'), hash: pbkdf2Sync('1234', salt, 100_000, 32, 'sha256').toString('base64') };
