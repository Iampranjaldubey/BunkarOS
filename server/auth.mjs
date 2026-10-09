// Bunkar OS server — unit-key hashing & constant-time verification (node:crypto).
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const KEYLEN = 32;

/** Hash a unit key with a fresh random salt. Returns hex strings. */
export function hashUnitKey(unitKey) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(unitKey, salt, KEYLEN).toString('hex');
  return { salt, hash };
}

/** Constant-time verify a provided key against stored salt+hash. */
export function verifyUnitKey(unitKey, salt, expectedHashHex) {
  if (typeof unitKey !== 'string' || typeof salt !== 'string' || typeof expectedHashHex !== 'string') {
    return false;
  }
  let actual;
  try {
    actual = scryptSync(unitKey, salt, KEYLEN);
  } catch {
    return false;
  }
  let expected;
  try {
    expected = Buffer.from(expectedHashHex, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}
