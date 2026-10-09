// Bunkar OS — ids & date helpers (pure, no DOM/React/Dexie).
// uuid: crypto.randomUUID. slipToken: 128-bit base64url (22 chars).
// istDay: YYYY-MM-DD in Asia/Kolkata. daysBetween: whole-day diff of two day strings.

/** RFC4122 v4 uuid, client generated. */
export function uuid(): string {
  return crypto.randomUUID();
}

/**
 * 128-bit random token encoded as base64url without padding (22 chars).
 * Used as the public slip link key.
 */
export function slipToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa is available in browser + Node 18+ global scope.
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert an ISO timestamp or Date to a YYYY-MM-DD calendar day in Asia/Kolkata.
 * IST is UTC+5:30 (no DST), so we can compute the shifted date deterministically.
 */
export function istDay(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) throw new RangeError('istDay: invalid date');
  // Shift the UTC instant by +5:30 then read the UTC calendar fields.
  const shifted = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Whole days between two YYYY-MM-DD day strings (dayB - dayA).
 * Positive when dayB is after dayA. Uses UTC midnight to avoid TZ drift.
 */
export function daysBetween(dayA: string, dayB: string): number {
  const a = Date.parse(`${dayA}T00:00:00Z`);
  const b = Date.parse(`${dayB}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) throw new RangeError('daysBetween: invalid day');
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}
