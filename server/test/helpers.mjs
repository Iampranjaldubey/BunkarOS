// Shared test helpers: ephemeral server on a temp db + record factory.
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID, pbkdf2Sync, randomBytes } from 'node:crypto';
import { createServer } from '../index.mjs';

/** Start a server on an ephemeral port with a fresh temp DB. */
export async function startTestServer() {
  const dir = mkdtempSync(join(tmpdir(), 'bunkar-test-'));
  const dbPath = join(dir, 'test.db');
  const instance = createServer({ dbPath, port: 0 });
  const port = await instance.listen();
  const base = `http://127.0.0.1:${port}`;
  return {
    base,
    instance,
    async stop() {
      await instance.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function authHeaders(unitId, unitKey, token) {
  const h = { 'x-unit-id': unitId, 'x-unit-key': unitKey, 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/** Build a well-formed Rec with sensible defaults; override via `over`. */
export function makeRec(type, payload, over = {}) {
  return {
    id: randomUUID(),
    type,
    unitId: over.unitId || 'unit-1',
    payload,
    by: over.by || 'u-owner',
    role: over.role || 'owner',
    device: over.device || 'dev-test',
    at: over.at || new Date().toISOString(),
    day: over.day || '2026-10-09',
    sync: 'pending',
    ...over,
  };
}

/** POST /api/sync convenience. Optional `token` adds a Bearer header. */
export async function sync(base, unitId, unitKey, records, since = 0, token) {
  const res = await fetch(`${base}/api/sync`, {
    method: 'POST',
    headers: authHeaders(unitId, unitKey, token),
    body: JSON.stringify({ records, since }),
  });
  return { status: res.status, body: await res.json() };
}

/** Hash a PIN with the SAME PBKDF2 params as app/src/lib/pin.ts (base64 out). */
export function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(pin, salt, 100_000, 32, 'sha256');
  return { pinHash: hash.toString('base64'), pinSalt: salt.toString('base64') };
}

/**
 * POST /api/auth/token → {status, body:{token, exp}}.
 * SPEC-014: a deviceId is required. Callers may override it; the default is a
 * valid 8..80-char id so the many existing token/sync tests keep passing.
 */
export async function getToken(base, unitId, unitKey, userId, pin, deviceId = 'dev-default-01') {
  const res = await fetch(`${base}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unitId, unitKey, userId, pin, deviceId }),
  });
  return { status: res.status, body: await res.json() };
}

/**
 * Full bootstrap: create a unit, push an owner `user` (bootstrap, unit-key only)
 * with a real PBKDF2 PIN hash, then obtain a Bearer token for that owner.
 * Returns { ownerId, pin, token }.
 */
export async function bootstrapOwner(base, unitId, unitKey, over = {}) {
  await createUnit(base, unitId, unitKey);
  const ownerId = over.ownerId || 'u-owner';
  const pin = over.pin || '1234';
  const { pinHash, pinSalt } = hashPin(pin);
  const owner = makeRec(
    'user',
    { entityId: ownerId, name: over.name || 'Malik', phone: '9000000000', role: 'owner', pinHash, pinSalt, active: true },
    { unitId, by: ownerId, role: 'owner' },
  );
  const r = await sync(base, unitId, unitKey, [owner]);
  const tok = await getToken(base, unitId, unitKey, ownerId, pin, over.deviceId);
  return { ownerId, pin, token: tok.body.token, exp: tok.body.exp, ownerRec: owner, syncResult: r };
}

/** Create a unit. */
export async function createUnit(base, unitId, unitKey, name = 'Test Unit') {
  const res = await fetch(`${base}/api/units`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unitId, unitKey, name }),
  });
  return { status: res.status, body: await res.json() };
}
