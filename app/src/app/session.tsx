import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Lang, Role, SettingP, UserP } from '../db/types';
import { db, setMeta, getMeta } from '../db/db';
import { addRecord } from '../db/repo';
import { uuid } from '../domain/ids';
import { hashPin, verifyPin, generateUnitKey } from '../lib/pin';
import {
  clearStoredSession,
  getStoredSession,
  setStoredSession,
  type StoredSession,
} from '../lib/session-store';
import { getLang, setLang as persistLang } from '../i18n';
import { setUnitName } from './unit-name';
import { requestToken, clearAuthToken, syncNow, onDeviceRevoked } from '../sync';

interface UnitMeta {
  unitId: string;
  unitKey: string;
  unitName: string;
}

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

/** Result of a login attempt (SPEC-014 adds the device_bound outcome). */
export interface LoginResult {
  ok: boolean;
  /** Online munshi/thekedar whose login is bound to another phone. */
  deviceBound?: boolean;
  boundAt?: string;
}

// SPEC-014: a one-shot reason the LoginPage shows after an involuntary logout
// (owner remote sign-out). Stored in sessionStorage so it survives the redirect
// to /login but is cleared once shown.
const LOGOUT_REASON_KEY = 'bunkar.logoutReason';

/** Record why the user was logged out (e.g. 'device_revoked'). */
export function setLogoutReason(reason: string): void {
  try { sessionStorage.setItem(LOGOUT_REASON_KEY, reason); } catch { /* ignore */ }
}

/** Read + clear the one-shot logout reason, or null. */
export function takeLogoutReason(): string | null {
  try {
    const r = sessionStorage.getItem(LOGOUT_REASON_KEY);
    if (r) sessionStorage.removeItem(LOGOUT_REASON_KEY);
    return r;
  } catch {
    return null;
  }
}

interface SessionContextValue {
  user: SessionUser | null;
  role: Role | null;
  unitId: string | null;
  lang: Lang;
  hasUnit: boolean;
  ready: boolean;
  logout: () => void;
  refreshUnit: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// ---------- unit meta helpers ----------

export async function getUnitMeta(): Promise<UnitMeta | null> {
  const m = await getMeta<UnitMeta>('bunkar.unit');
  return m ?? null;
}

/**
 * Create a brand-new unit: generate unitId + unitKey, store unit meta, write
 * the first `setting` record (D4/D1/D9 defaults) and the owner `user` record
 * with a PBKDF2-hashed PIN. Returns the created session (not yet logged in).
 */
export async function createUnit(input: {
  unitName: string;
  ownerName: string;
  ownerPhone: string;
  pin: string;
}): Promise<{ unitId: string; unitKey: string; userId: string }> {
  const unitId = uuid();
  const unitKey = generateUnitKey();
  const userId = uuid();

  await setMeta('bunkar.unit', { unitId, unitKey, unitName: input.unitName } satisfies UnitMeta);
  setUnitName(input.unitName);

  const { pinHash, pinSalt } = await hashPin(input.pin);
  const author = { by: userId, role: 'owner' as const, unitId };

  const setting: SettingP = {
    entityId: 'unit',
    unitName: input.unitName,
    ownerPhone: input.ownerPhone,
    lang: 'hi',
    photoRequiredAbovePaise: 200_000, // D4
    wastagePct: 3, // D1
    idleYellowDays: 4, // D9
    idleRedDays: 7, // D9
    openingCashPaise: 0,
    openingCashDay: new Date().toISOString().slice(0, 10),
  };
  await addRecord<SettingP>('setting', setting, { as: author });

  const owner: UserP = {
    entityId: userId,
    name: input.ownerName,
    phone: input.ownerPhone,
    role: 'owner',
    pinHash,
    pinSalt,
    active: true,
  };
  await addRecord<UserP>('user', owner, { as: author });

  return { unitId, unitKey, userId };
}

/**
 * Join an existing unit by its code + key. Stores the unit meta so the sync
 * client (server agent) can authenticate and pull records.
 */
export async function joinUnit(unitId: string, unitKey: string): Promise<void> {
  await setMeta('bunkar.unit', { unitId, unitKey, unitName: '' } satisfies UnitMeta);
}

/** Latest `user` record per entityId that is still active. */
export async function listLoginUsers(unitId: string): Promise<UserP[]> {
  const recs = await db.records.where('unitId').equals(unitId).toArray();
  const latest = new Map<string, { at: string; p: UserP }>();
  for (const r of recs) {
    if (r.type !== 'user') continue;
    const p = r.payload as UserP;
    const prev = latest.get(p.entityId);
    if (!prev || r.at > prev.at) latest.set(p.entityId, { at: r.at, p });
  }
  return [...latest.values()].map((v) => v.p).filter((u) => u.active);
}

// ---------- lockout (M1): per-user, persisted in IndexedDB meta, escalating ----------
// Rationale: the old global localStorage lock (a) locked every user on a shared
// device after one user's wrong tries and (b) was trivially reset via DevTools
// localStorage.clear(). We key lockout per userId and persist it in IndexedDB
// `meta` (harder to clear casually), with an escalating delay per lockout round.
const MAX_ATTEMPTS = 5; // wrong PINs before a lockout kicks in
// Escalating cool-off per lockout round (capped). Round 1 = 60 s, then grows.
const LOCKOUT_LADDER_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

interface UserLock {
  attempts: number; // consecutive wrong attempts in the current round
  until: number; // epoch ms the user is locked until (0 = not locked)
  rounds: number; // how many lockouts have fired (drives the ladder)
}

const LOCK_META_PREFIX = 'bunkar.lock.';

// In-memory mirror so the synchronous lockoutSecondsLeft() (called by LoginPage
// right after loginWithPin resolves) can report the remaining time without an
// async IndexedDB read. Hydrated on each loginWithPin for the attempted user.
const lockMirror = new Map<string, UserLock>();
let lastAttemptUserId: string | null = null;

function emptyLock(): UserLock {
  return { attempts: 0, until: 0, rounds: 0 };
}

async function readUserLock(userId: string): Promise<UserLock> {
  const stored = await getMeta<UserLock>(LOCK_META_PREFIX + userId);
  const lock = stored && typeof stored.attempts === 'number' ? stored : emptyLock();
  lockMirror.set(userId, lock);
  return lock;
}

async function writeUserLock(userId: string, lock: UserLock): Promise<void> {
  lockMirror.set(userId, lock);
  await setMeta(LOCK_META_PREFIX + userId, lock);
}

/**
 * Seconds remaining in the lockout for the most recently attempted user, or 0.
 * Synchronous (reads the in-memory mirror) to keep LoginPage's contract.
 */
export function lockoutSecondsLeft(): number {
  if (!lastAttemptUserId) return 0;
  const lock = lockMirror.get(lastAttemptUserId);
  if (!lock) return 0;
  const left = Math.ceil((lock.until - Date.now()) / 1000);
  return left > 0 ? left : 0;
}

/**
 * Verify a PIN for a user. On success, resets that user's lockout, then:
 *  - ONLINE: requests a server token (binding this device per SPEC-014). If the
 *    server says 409 device_bound (munshi/thekedar already bound to another
 *    phone) the login is REFUSED — no session is persisted — and {deviceBound}
 *    is returned so LoginPage can show the Hindi notice. Otherwise the session
 *    is persisted and sync proceeds.
 *  - OFFLINE: the session is persisted locally (offline login unchanged); sync
 *    reports needs_login until the next successful online token request.
 */
export async function loginWithPin(user: UserP, pin: string, unitId: string): Promise<LoginResult> {
  lastAttemptUserId = user.entityId;
  const lock = await readUserLock(user.entityId);

  // Already locked out → refuse without consuming an attempt.
  if (lock.until > Date.now()) return { ok: false };

  const ok = await verifyPin(pin, user.pinHash, user.pinSalt);
  if (!ok) {
    // Wrong PIN: escalate per-user.
    const attempts = lock.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      const rounds = lock.rounds + 1;
      const idx = Math.min(rounds - 1, LOCKOUT_LADDER_MS.length - 1);
      await writeUserLock(user.entityId, {
        attempts: 0,
        until: Date.now() + LOCKOUT_LADDER_MS[idx],
        rounds,
      });
    } else {
      await writeUserLock(user.entityId, { attempts, until: 0, rounds: lock.rounds });
    }
    return { ok: false };
  }

  await writeUserLock(user.entityId, emptyLock());
  const online = typeof navigator === 'undefined' || navigator.onLine;

  if (online) {
    // ONLINE: establish the device binding BEFORE starting a session so a
    // device_bound conflict never leaves a half-logged-in munshi. syncNow() is
    // single-flight; retry a few times so the bootstrap owner `user` + `setting`
    // reach the server and the token request can resolve this user.
    let result: Awaited<ReturnType<typeof requestToken>> = { ok: false, reason: 'needs_login' };
    for (let attempt = 0; attempt < 3 && !result.ok; attempt++) {
      try {
        await syncNow();
      } catch {
        /* best-effort; sync never throws anyway */
      }
      result = await requestToken(unitId, user.entityId, pin);
      // A device_bound conflict is terminal — never retry it as needs_login.
      if (result.reason === 'device_bound') break;
      if (!result.ok && attempt < 2) await new Promise((r) => setTimeout(r, 150));
    }

    if (result.reason === 'device_bound') {
      // Refuse the login entirely; do not persist a session (AC1).
      return { ok: false, deviceBound: true, boundAt: result.boundAt };
    }

    // Token obtained (or a transient needs_login that offline-style login still
    // tolerates). Persist the session and let sync continue.
    const session: StoredSession = { userId: user.entityId, role: user.role, unitId };
    setStoredSession(session);
    return { ok: true };
  }

  // OFFLINE: local login only; clear any stale token so sync flags needs_login.
  const session: StoredSession = { userId: user.entityId, role: user.role, unitId };
  setStoredSession(session);
  await clearAuthToken();
  return { ok: true };
}

// ---------- provider ----------

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [hasUnit, setHasUnit] = useState(false);
  const [ready, setReady] = useState(false);
  const [lang] = useState<Lang>(() => getLang());

  const loadFromStorage = useCallback(async () => {
    const meta = await getUnitMeta();
    setHasUnit(Boolean(meta));
    // Keep the header's unit name fresh from meta or the latest setting record.
    if (meta?.unitName) setUnitName(meta.unitName);
    if (meta?.unitId) {
      const recs = await db.records.where('unitId').equals(meta.unitId).toArray();
      let latestAt = '';
      for (const r of recs) {
        if (r.type === 'setting' && r.at > latestAt) {
          latestAt = r.at;
          setUnitName((r.payload as SettingP).unitName);
        }
      }
    }
    const stored = getStoredSession();
    if (stored) {
      const users = await listLoginUsers(stored.unitId);
      const u = users.find((x) => x.entityId === stored.userId);
      setUser(u ? { id: u.entityId, name: u.name, role: u.role } : null);
      setUnitId(stored.unitId);
    } else {
      setUser(null);
      setUnitId(meta?.unitId ?? null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void loadFromStorage();
    // Re-check when another tab logs in/out.
    const onStorage = () => void loadFromStorage();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadFromStorage]);

  const logout = useCallback(() => {
    clearStoredSession();
    void clearAuthToken();
    setUser(null);
    void loadFromStorage();
  }, [loadFromStorage]);

  // SPEC-014: when the owner signs this phone out, the sync client flips to
  // 'device_revoked'. Log the user out and store a one-shot reason so LoginPage
  // shows the Hindi notice. Pending records stay in IndexedDB (never cleared).
  useEffect(() => {
    const unsubscribe = onDeviceRevoked(() => {
      setLogoutReason('device_revoked');
      clearStoredSession();
      void clearAuthToken();
      setUser(null);
      void loadFromStorage();
    });
    return unsubscribe;
  }, [loadFromStorage]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      unitId,
      lang,
      hasUnit,
      ready,
      logout,
      refreshUnit: loadFromStorage,
    }),
    [user, unitId, lang, hasUnit, ready, logout, loadFromStorage],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Access the active session. {user, role, unitId, lang, logout}. */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within <SessionProvider>');
  }
  return ctx;
}

export { persistLang };
