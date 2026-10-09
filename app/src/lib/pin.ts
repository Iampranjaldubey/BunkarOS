// PIN hashing via WebCrypto PBKDF2-SHA256 (100k iterations, random salt).
// Stored as base64 strings; no secret is ever hardcoded.
const ITERATIONS = 100_000;
const KEY_LEN = 32; // bytes

function toB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_LEN * 8,
  );
  return new Uint8Array(bits);
}

/** Hash a PIN, returning { pinHash, pinSalt } as base64 strings. */
export async function hashPin(pin: string): Promise<{ pinHash: string; pinSalt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt);
  return { pinHash: toB64(hash), pinSalt: toB64(salt) };
}

/** Constant-time verify of a PIN against a stored hash + salt. */
export async function verifyPin(pin: string, pinHash: string, pinSalt: string): Promise<boolean> {
  const salt = fromB64(pinSalt);
  const expected = fromB64(pinHash);
  const actual = await derive(pin, salt);
  // Constant-time compare that does not branch on length (L1): fold any length
  // mismatch into the diff accumulator and always scan the full expected hash.
  let diff = actual.length ^ expected.length;
  const n = Math.max(actual.length, expected.length);
  for (let i = 0; i < n; i++) {
    const a = i < actual.length ? actual[i] : 0;
    const e = i < expected.length ? expected[i] : 0;
    diff |= a ^ e;
  }
  return diff === 0;
}

/** Generate a 32-byte unit key, base64url (no padding). */
export function generateUnitKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
