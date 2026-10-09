import type { Role } from '../db/types';

// Low-level persistence for the active session + device id.
// Kept in lib/ (no React/Dexie) so both db/repo.ts and app/session.tsx can use
// it without a circular import.

export interface StoredSession {
  userId: string;
  role: Role;
  unitId: string;
}

const SESSION_KEY = 'bunkar.session';
const DEVICE_KEY = 'bunkar.device';

/** Stable per-device id (created once, persisted). */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** Read the active session, or null if logged out. Prefers sessionStorage. */
export function getStoredSession(): StoredSession | null {
  const raw =
    sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (parsed?.userId && parsed?.role && parsed?.unitId) return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Persist the active session (both storages so a tab reload keeps it). */
export function setStoredSession(session: StoredSession): void {
  const raw = JSON.stringify(session);
  sessionStorage.setItem(SESSION_KEY, raw);
  localStorage.setItem(SESSION_KEY, raw);
}

/** Clear the active session on logout. */
export function clearStoredSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}
