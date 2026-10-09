// Bunkar OS server — per-user auth tokens (HMAC-SHA256) + server-side PIN verify.
// Mirrors app/src/lib/pin.ts PBKDF2 params EXACTLY (PBKDF2-SHA256, 100k iters,
// 32-byte key) so a PIN hashed in the browser verifies here against the same
// salt. Tokens are compact `base64url(payloadJson).base64url(hmac)` strings.
import { pbkdf2Sync, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getMeta, setMeta } from './db.mjs';

const ITERATIONS = 100_000; // == app/src/lib/pin.ts ITERATIONS
const KEY_LEN = 32; // bytes       == app/src/lib/pin.ts KEY_LEN
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBuf(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/**
 * Verify a 4-digit (or any) PIN against a stored PBKDF2 hash + salt that were
 * produced by the browser's app/src/lib/pin.ts. Both are base64 strings.
 * Constant-time compare of the derived bits (fixed 32-byte length).
 */
export function verifyPinServer(pin, pinHashB64, pinSaltB64) {
  if (typeof pin !== 'string' || typeof pinHashB64 !== 'string' || typeof pinSaltB64 !== 'string') {
    return false;
  }
  let salt;
  let expected;
  try {
    salt = Buffer.from(pinSaltB64, 'base64');
    expected = Buffer.from(pinHashB64, 'base64');
  } catch {
    return false;
  }
  let actual;
  try {
    actual = pbkdf2Sync(pin, salt, ITERATIONS, KEY_LEN, 'sha256');
  } catch {
    return false;
  }
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Fetch (or lazily generate+persist) the server HMAC secret. */
export function getServerSecret(db) {
  const fromEnv = process.env.BUNKAR_SECRET;
  if (typeof fromEnv === 'string' && fromEnv.length >= 16) return fromEnv;
  let secret = getMeta(db, 'hmac_secret');
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    setMeta(db, 'hmac_secret', secret);
  }
  return secret;
}

/** Sign a token carrying {unitId, userId, deviceId?, exp}. exp in ms epoch. */
export function signToken(db, { unitId, userId, deviceId, exp }) {
  const secret = getServerSecret(db);
  const expMs = exp ?? Date.now() + TOKEN_TTL_MS;
  const payload = { unitId, userId, exp: expMs };
  if (typeof deviceId === 'string') payload.deviceId = deviceId;
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const mac = createHmac('sha256', secret).update(payloadB64).digest();
  const token = `${payloadB64}.${b64urlEncode(mac)}`;
  return { token, exp: expMs };
}

/**
 * Verify a bearer token. Returns the decoded {unitId, userId, deviceId?, exp} or
 * null if malformed, tampered, or expired.
 */
export function verifyToken(db, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const dot = token.indexOf('.');
  const payloadB64 = token.slice(0, dot);
  const macB64 = token.slice(dot + 1);
  if (!payloadB64 || !macB64) return null;
  const secret = getServerSecret(db);
  const expectedMac = createHmac('sha256', secret).update(payloadB64).digest();
  let gotMac;
  try {
    gotMac = b64urlToBuf(macB64);
  } catch {
    return null;
  }
  if (gotMac.length !== expectedMac.length) return null;
  if (!timingSafeEqual(gotMac, expectedMac)) return null;
  let payload;
  try {
    payload = JSON.parse(b64urlToBuf(payloadB64).toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== 'number' || Date.now() >= payload.exp) return null;
  if (typeof payload.unitId !== 'string' || typeof payload.userId !== 'string') return null;
  return payload;
}

export { TOKEN_TTL_MS };
