import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang, Role, SettingP, UserP } from '../db/types';
import { db, setMeta, getMeta } from '../db/db';
import { addRecord } from '../db/repo';
import { uuid } from '../domain/ids';
import { hashPin, verifyPin, generateUnitKey } from '../lib/pin';
import { clearStoredSession, getStoredSession, setStoredSession, type StoredSession } from '../lib/session-store';
import { getLang } from '../i18n';
import { setUnitName } from './unit-name';
import { requestToken, clearAuthToken, syncNow } from '../sync';

export interface UnitMeta { unitId: string; unitKey: string; unitName: string; }
export interface SessionUser { id: string; name: string; role: Role; }

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

export async function getUnitMeta(): Promise<UnitMeta | null> {
  return (await getMeta<UnitMeta>('bunkar.unit')) ?? null;
}

export const DEFAULT_SETTINGS: Omit<SettingP, 'unitName' | 'ownerPhone' | 'lang'> = {
  entityId: 'unit',
  workingDaysPerMonth: 26,
  photoRequiredAbovePaise: 200_000,
  holidays: [],
};

/** Create a unit: unit meta + first `setting` + owner `user` (hashed PIN). */
export async function createUnit(input: { unitName: string; ownerName: string; ownerPhone: string; pin: string }) {
  const unitId = uuid();
  const unitKey = generateUnitKey();
  const userId = uuid();
  await setMeta('bunkar.unit', { unitId, unitKey, unitName: input.unitName } satisfies UnitMeta);
  setUnitName(input.unitName);
  const { pinHash, pinSalt } = await hashPin(input.pin);
  const author = { by: userId, role: 'owner' as const, unitId };
  const setting: SettingP = { ...DEFAULT_SETTINGS, unitName: input.unitName, ownerPhone: input.ownerPhone, lang: getLang() };
  await addRecord<SettingP>('setting', setting, { as: author });
  const owner: UserP = { entityId: userId, name: input.ownerName, phone: input.ownerPhone, role: 'owner', pinHash, pinSalt, active: true };
  await addRecord<UserP>('user', owner, { as: author });
  return { unitId, unitKey, userId };
}

export async function joinUnit(unitId: string, unitKey: string): Promise<void> {
  await setMeta('bunkar.unit', { unitId, unitKey, unitName: '' } satisfies UnitMeta);
}

/** Latest active `user` per entityId. */
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

// ---------- per-user lockout (escalating, persisted in IndexedDB meta) ----------
const MAX_ATTEMPTS = 5;
const LADDER_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
interface UserLock { attempts: number; until: number; rounds: number; }
const lockMirror = new Map<string, UserLock>();
let lastAttemptUserId: string | null = null;
const emptyLock = (): UserLock => ({ attempts: 0, until: 0, rounds: 0 });
async function readUserLock(userId: string): Promise<UserLock> {
  const stored = await getMeta<UserLock>('bunkar.lock.' + userId);
  const lock = stored && typeof stored.attempts === 'number' ? stored : emptyLock();
  lockMirror.set(userId, lock);
  return lock;
}
async function writeUserLock(userId: string, lock: UserLock): Promise<void> {
  lockMirror.set(userId, lock);
  await setMeta('bunkar.lock.' + userId, lock);
}
export function lockoutSecondsLeft(): number {
  if (!lastAttemptUserId) return 0;
  const lock = lockMirror.get(lastAttemptUserId);
  if (!lock) return 0;
  const left = Math.ceil((lock.until - Date.now()) / 1000);
  return left > 0 ? left : 0;
}

/** Verify a PIN locally; online, also fetch a server token. Offline login is allowed. */
export async function loginWithPin(user: UserP, pin: string, unitId: string): Promise<{ ok: boolean }> {
  lastAttemptUserId = user.entityId;
  const lock = await readUserLock(user.entityId);
  if (lock.until > Date.now()) return { ok: false };
  const ok = await verifyPin(pin, user.pinHash, user.pinSalt);
  if (!ok) {
    const attempts = lock.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      const rounds = lock.rounds + 1;
      await writeUserLock(user.entityId, { attempts: 0, until: Date.now() + LADDER_MS[Math.min(rounds - 1, LADDER_MS.length - 1)], rounds });
    } else {
      await writeUserLock(user.entityId, { attempts, until: 0, rounds: lock.rounds });
    }
    return { ok: false };
  }
  await writeUserLock(user.entityId, emptyLock());
  const session: StoredSession = { userId: user.entityId, role: user.role, unitId };
  setStoredSession(session);
  const online = typeof navigator === 'undefined' || navigator.onLine;
  if (online) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await syncNow(); } catch { /* never throws */ }
      const result = await requestToken(unitId, user.entityId, pin);
      if (result.ok) { try { await syncNow(); } catch { /* never throws */ } break; } // pull the unit's data now, not on the 30 s timer
      if (attempt < 2) await new Promise((r) => setTimeout(r, 150));
    }
  } else {
    await clearAuthToken();
  }
  return { ok: true };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [hasUnit, setHasUnit] = useState(false);
  const [ready, setReady] = useState(false);
  const [lang] = useState<Lang>(() => getLang());

  const loadFromStorage = useCallback(async () => {
    const meta = await getUnitMeta();
    setHasUnit(Boolean(meta));
    if (meta?.unitName) setUnitName(meta.unitName);
    if (meta?.unitId) {
      const recs = await db.records.where('unitId').equals(meta.unitId).toArray();
      let latestAt = '';
      for (const r of recs) if (r.type === 'setting' && r.at > latestAt) { latestAt = r.at; setUnitName((r.payload as SettingP).unitName); }
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

  const value = useMemo<SessionContextValue>(() => ({
    user, role: user?.role ?? null, unitId, lang, hasUnit, ready, logout, refreshUnit: loadFromStorage,
  }), [user, unitId, lang, hasUnit, ready, logout, loadFromStorage]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}
