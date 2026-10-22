// Per-user auth tokens (HMAC-SHA256) + server-side PIN verify (PBKDF2 params == app/src/lib/pin.ts).
import { pbkdf2Sync, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getMeta, setMeta } from './db.mjs';

const ITERATIONS = 100_000;
const KEY_LEN = 32;
export const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // SPEC-M08: a year, PIN only after explicit logout

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + (s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''), 'base64');

export function verifyPinServer(pin, pinHashB64, pinSaltB64) {
  if (typeof pin !== 'string' || typeof pinHashB64 !== 'string' || typeof pinSaltB64 !== 'string') return false;
  let salt, expected, actual;
  try { salt = Buffer.from(pinSaltB64, 'base64'); expected = Buffer.from(pinHashB64, 'base64'); actual = pbkdf2Sync(pin, salt, ITERATIONS, KEY_LEN, 'sha256'); } catch { return false; }
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}

let cachedSecret = null;
export async function getServerSecret(db) {
  const fromEnv = process.env.BUNKAR_SECRET;
  if (typeof fromEnv === 'string' && fromEnv.length >= 16) return fromEnv;
  if (cachedSecret) return cachedSecret;
  let secret = await getMeta(db, 'hmac_secret');
  if (!secret) { secret = randomBytes(32).toString('hex'); await setMeta(db, 'hmac_secret', secret); }
  cachedSecret = secret;
  return secret;
}

export async function signToken(db, { unitId, userId, exp }) {
  const secret = await getServerSecret(db);
  const expMs = exp ?? Date.now() + TOKEN_TTL_MS;
  const payloadB64 = b64url(JSON.stringify({ unitId, userId, exp: expMs }));
  const mac = createHmac('sha256', secret).update(payloadB64).digest();
  return { token: `${payloadB64}.${b64url(mac)}`, exp: expMs };
}

export async function verifyToken(db, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const dot = token.indexOf('.');
  const payloadB64 = token.slice(0, dot); const macB64 = token.slice(dot + 1);
  if (!payloadB64 || !macB64) return null;
  const expectedMac = createHmac('sha256', await getServerSecret(db)).update(payloadB64).digest();
  let gotMac; try { gotMac = fromB64url(macB64); } catch { return null; }
  if (gotMac.length !== expectedMac.length || !timingSafeEqual(gotMac, expectedMac)) return null;
  let payload; try { payload = JSON.parse(fromB64url(payloadB64).toString('utf8')); } catch { return null; }
  if (!payload || typeof payload.exp !== 'number' || Date.now() >= payload.exp) return null;
  if (typeof payload.unitId !== 'string' || typeof payload.userId !== 'string') return null;
  return payload;
}

/** Platform admin token: {admin:name, exp}. Verified with the same HMAC secret; never carries a unitId. */
export async function signAdminToken(db, name) {
  const secret = await getServerSecret(db);
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payloadB64 = b64url(JSON.stringify({ admin: name, exp }));
  const mac = createHmac('sha256', secret).update(payloadB64).digest();
  return { token: `${payloadB64}.${b64url(mac)}`, exp };
}
export async function verifyAdminToken(db, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const dot = token.indexOf('.');
  const payloadB64 = token.slice(0, dot); const macB64 = token.slice(dot + 1);
  const expectedMac = createHmac('sha256', await getServerSecret(db)).update(payloadB64).digest();
  let gotMac; try { gotMac = fromB64url(macB64); } catch { return null; }
  if (gotMac.length !== expectedMac.length || !timingSafeEqual(gotMac, expectedMac)) return null;
  let payload; try { payload = JSON.parse(fromB64url(payloadB64).toString('utf8')); } catch { return null; }
  if (!payload || typeof payload.admin !== 'string' || typeof payload.exp !== 'number' || Date.now() >= payload.exp) return null;
  return payload;
}
