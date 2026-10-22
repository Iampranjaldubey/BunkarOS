// Bunkar MVP — local-first sync client (copied from BunkarOS; device binding removed).
// Pushes pending records (+ their pending photos) and pulls server records on a
// 30 s timer / online event / explicit syncNow(). Never throws to the UI.
//
// Contracts:
//  - `db` from '../db/db' (Dexie): tables `records` (index `sync`, `day`, `at`),
//    `photos` (index `sync`), `meta` (keyed by `key`).
//  - unit credentials live in meta 'bunkar.unit' {unitId, unitKey}; pull cursor
//    in meta 'cursor'; unit registration flag in meta 'unitRegistered'.
//  - per-user auth token lives in meta 'bunkar.auth' {token, exp, userId}.
//  - server rules may reject a record → mark it sync:'rejected' + rejectReason.
//
// AUTH (C1/H1): once a unit has user records, /api/sync requires a valid Bearer
// token derived from a server-side PIN verification. The client requests a token
// at login when online (requestToken). Offline login works locally; sync then
// reports authState 'needs_login' until the next online login. A 401 'needs_login'
// from the server also flips authState to 'needs_login' and drops the stale token.
import { useSyncExternalStore } from 'react';
import { db } from '../db/db';
import type { Rec, PhotoRow } from '../db/types';
import type { SyncResponse, SyncStateView } from './types';
import { getDeviceId } from '../lib/session-store';

const PUSH_BATCH = 200;
const PULL_LIMIT = 500; // == server PULL_LIMIT (routes.mjs)
const INTERVAL_MS = 30_000;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 5 * 60_000;

const AUTH_META_KEY = 'bunkar.auth';

const isBrowser = typeof window !== 'undefined';

interface AuthMeta {
  token: string;
  exp: number;
  userId: string;
}

/** Result of a token request. `reason` disambiguates a failure for the UI. */
export interface TokenResult {
  ok: boolean;
  reason?: 'needs_login';
}

/**
 * Resolve this device's stable id. In the browser it comes from the localStorage
 * key `bunkar.device` (via session-store). In non-DOM contexts (tests, SSR)
 * localStorage is absent, so fall back to a per-process stable id so a device id
 * is always sent (the server requires 8..80 chars).
 */
let fallbackDeviceId: string | null = null;
function resolveDeviceId(): string {
  try {
    return getDeviceId();
  } catch {
    if (!fallbackDeviceId) {
      fallbackDeviceId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    }
    return fallbackDeviceId;
  }
}

// ---------------- observable state ----------------
let state: SyncStateView = {
  pending: 0,
  lastSyncAt: null,
  online: isBrowser && typeof navigator !== 'undefined' ? navigator.onLine : true,
  error: null,
  syncing: false,
  authState: 'ok',
};
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncStateView>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSyncState(): SyncStateView {
  return state;
}

/** React hook: subscribe to sync state via useSyncExternalStore. */
export function useSyncState(): SyncStateView {
  return useSyncExternalStore(subscribe, getSyncState, getSyncState);
}

// ---------------- meta helpers ----------------
async function metaGet<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : undefined;
}

async function metaSet(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

async function metaDel(key: string): Promise<void> {
  await db.meta.delete(key);
}

async function credentials(): Promise<{ unitId: string; unitKey: string } | null> {
  // Foundation stores credentials as one object under 'bunkar.unit'; legacy flat keys are a fallback.
  const unit = await metaGet<{ unitId?: string; unitKey?: string; unitName?: string }>('bunkar.unit');
  const unitId = unit?.unitId ?? (await metaGet<string>('unitId'));
  const unitKey = unit?.unitKey ?? (await metaGet<string>('unitKey'));
  if (!unitId || !unitKey) return null;
  return { unitId, unitKey };
}

async function unitDisplayName(fallback: string): Promise<string> {
  const unit = await metaGet<{ unitName?: string }>('bunkar.unit');
  return unit?.unitName || (await metaGet<string>('unitName')) || fallback;
}

// ---------------- auth token ----------------
/** Read a non-expired stored token, or null. Expired/missing → null. */
async function storedToken(): Promise<AuthMeta | null> {
  const auth = await metaGet<AuthMeta>(AUTH_META_KEY);
  if (!auth || typeof auth.token !== 'string') return null;
  if (typeof auth.exp === 'number' && Date.now() >= auth.exp) return null;
  return auth;
}

async function clearToken(): Promise<void> {
  await metaDel(AUTH_META_KEY);
}

/**
 * Request a per-user Bearer token from the server (PIN verified server-side with
 * the same PBKDF2 params as app/src/lib/pin.ts). Sends this device's id so the
 * server can bind / takeover / refuse per SPEC-014. Called by the login flow
 * when online. On success stores {token, exp, userId} under meta 'bunkar.auth'
 * and sets authState 'ok'. On a 409 device_bound returns {ok:false,
 * reason:'device_bound', boundAt} WITHOUT starting a session or storing a token.
 * On any other failure returns {ok:false, reason:'needs_login'} and leaves
 * authState 'needs_login' (login still works locally and offline).
 */
export async function requestToken(unitId: string, userId: string, pin: string): Promise<TokenResult> {
  const creds = await credentials();
  const unitKey = creds?.unitKey;
  if (!unitKey) {
    setState({ authState: 'needs_login' });
    return { ok: false, reason: 'needs_login' };
  }
  const deviceId = resolveDeviceId();
  try {
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId, unitKey, userId, pin, deviceId }),
    });
    if (!res.ok) {
      setState({ authState: 'needs_login' });
      return { ok: false, reason: 'needs_login' };
    }
    const data = (await res.json()) as { token?: string; exp?: number };
    if (!data.token || typeof data.exp !== 'number') {
      setState({ authState: 'needs_login' });
      return { ok: false, reason: 'needs_login' };
    }
    await metaSet(AUTH_META_KEY, { token: data.token, exp: data.exp, userId } satisfies AuthMeta);
    setState({ authState: 'ok', error: null });
    return { ok: true };
  } catch {
    // Offline / network error: local login proceeds; sync flags needs_login.
    setState({ authState: 'needs_login' });
    return { ok: false, reason: 'needs_login' };
  }
}

/** Drop the stored token (e.g. on logout). Sync will report needs_login next cycle. */
export async function clearAuthToken(): Promise<void> {
  await clearToken();
  setState({ authState: 'needs_login' });
}

/**
 * Authenticated fetch for owner-only server APIs (e.g. /api/devices). Attaches
 * the unit headers + the current Bearer token. Returns the raw Response (callers
 * handle status). Throws if credentials or a token are missing (caller is online
 * + logged in). Owned by the sync module so feature code never re-implements auth.
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const creds = await credentials();
  if (!creds) throw new Error('no_credentials');
  const auth = await storedToken();
  const headers: Record<string, string> = {
    'x-unit-id': creds.unitId,
    'x-unit-key': creds.unitKey,
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (auth?.token) headers['Authorization'] = `Bearer ${auth.token}`;
  return fetch(path, { ...init, headers });
}

/**
 * Bootstrap the login screen on a freshly-joined device (two-device scenario).
 * A device that joined with the unit code + key holds no per-user token and its
 * local IndexedDB is empty, so `listLoginUsers` returns nothing and the user can
 * never pick an identity to log in with. This performs a unit-key-only,
 * token-less pull restricted to `user` records (the server permits exactly this
 * when the unit already has users — see server/routes.mjs handleSync bootstrap)
 * and stores any returned `user` records locally as `synced` so the login screen
 * can render. It does NOT advance the main pull `cursor` (the post-login full
 * sync re-pulls everything from `since:0`, idempotent by id). Never throws.
 *
 * @returns the number of `user` records now available locally for this unit.
 */
export async function bootstrapUsers(): Promise<number> {
  const creds = await credentials();
  if (!creds) return 0;
  if (isBrowser && typeof navigator !== 'undefined' && !navigator.onLine) return 0;
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: authHeaders(creds.unitId, creds.unitKey),
      body: JSON.stringify({ records: [], since: 0, limit: PULL_LIMIT }),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as SyncResponse;
    let count = 0;
    for (const incoming of data.records) {
      if (incoming.type !== 'user') continue;
      const local = await db.records.get(incoming.id);
      if (!local) await db.records.put({ ...incoming, sync: 'synced' });
      count += 1;
    }
    return count;
  } catch {
    // Offline / network error: login users simply remain whatever is local.
    return 0;
  }
}

function authHeaders(unitId: string, unitKey: string, token?: string): HeadersInit {
  const h: Record<string, string> = {
    'x-unit-id': unitId,
    'x-unit-key': unitKey,
    'Content-Type': 'application/json',
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// ---------------- pending count ----------------
async function refreshPending(): Promise<void> {
  try {
    const count = await db.records.where('sync').equals('pending').count();
    setState({ pending: count });
  } catch {
    /* ignore — db may not be ready */
  }
}

// ---------------- unit registration ----------------
/** Register the unit on the server once (idempotent). Safe to call repeatedly. */
export async function registerUnitIfNeeded(): Promise<void> {
  try {
    const already = await metaGet<boolean>('unitRegistered');
    if (already) return;
    const creds = await credentials();
    if (!creds) return;
    const name = await unitDisplayName(creds.unitId);
    const res = await fetch('/api/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId: creds.unitId, unitKey: creds.unitKey, name }),
    });
    if (res.ok) await metaSet('unitRegistered', true);
  } catch {
    /* offline — try again next cycle */
  }
}

// 401 from the server during a sync cycle.
class NeedsLoginError extends Error {
  constructor() {
    super('needs_login');
    this.name = 'NeedsLoginError';
  }
}

async function throwFor401(_res: Response): Promise<never> {
  throw new NeedsLoginError();
}

// ---------------- push ----------------
/**
 * Upload EVERY pending photo of this unit — not only the ones referenced by the batch
 * being pushed. A photo whose upload failed earlier (patchy network) or one referenced
 * only from a payload field (e.g. a weaver's avatar) must still reach the server on a
 * later sync; otherwise it stays 'pending' forever and other phones never see it.
 * Network errors propagate (syncNow backs off and retries); a photo the server can never
 * accept (413 too large / 415 wrong type) is marked 'rejected' instead of retried forever.
 */
async function pushPendingPhotos(creds: { unitId: string; unitKey: string }): Promise<void> {
  const pending: PhotoRow[] = await db.photos.where('sync').equals('pending').toArray();
  for (const photo of pending) {
    if (photo.unitId && photo.unitId !== creds.unitId) continue;
    const res = await fetch(`/api/photos/${encodeURIComponent(photo.id)}`, {
      method: 'PUT',
      headers: { 'x-unit-id': creds.unitId, 'x-unit-key': creds.unitKey, 'Content-Type': photo.mime },
      body: photo.blob,
    });
    if (res.ok) await db.photos.update(photo.id, { sync: 'synced' });
    else if (res.status === 413 || res.status === 415) await db.photos.update(photo.id, { sync: 'rejected' });
  }
}

async function pushPending(
  creds: { unitId: string; unitKey: string },
  token: string | undefined,
): Promise<SyncResponse | null> {
  const pending: Rec[] = await db.records
    .where('sync')
    .equals('pending')
    .limit(PUSH_BATCH)
    .toArray();

  const since = (await metaGet<number>('cursor')) ?? 0;
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: authHeaders(creds.unitId, creds.unitKey, token),
    body: JSON.stringify({ records: pending, since }),
  });
  if (res.status === 401) await throwFor401(res);
  if (!res.ok) throw new Error(`sync_http_${res.status}`);
  const data = (await res.json()) as SyncResponse;

  // Apply accepted: mark synced + serverSeq (from the returned records if present).
  const seqById = new Map<string, number>();
  for (const r of data.records) if (typeof r.serverSeq === 'number') seqById.set(r.id, r.serverSeq);
  for (const id of data.accepted) {
    await db.records.update(id, { sync: 'synced', serverSeq: seqById.get(id) });
  }
  // Apply rejected: mark rejected + reason.
  for (const { id, reason } of data.rejected) {
    await db.records.update(id, { sync: 'rejected', rejectReason: reason });
  }
  return data;
}

// ---------------- pull ----------------
async function applyPulled(data: SyncResponse): Promise<void> {
  for (const incoming of data.records) {
    const local = await db.records.get(incoming.id);
    if (!local) {
      // New-to-us record: store as synced.
      await db.records.put({ ...incoming, sync: 'synced' });
      continue;
    }
    // L3: a locally-rejected record must never be silently flipped back to
    // synced on pull — that would erase the "Rejected" UI state. Only update
    // bookkeeping for records that are not locally rejected.
    if (local.sync === 'rejected') continue;
    // Never overwrite a local record's payload; server wins only on sync bookkeeping.
    await db.records.update(incoming.id, {
      sync: 'synced',
      serverSeq: incoming.serverSeq,
      rejectReason: undefined,
    });
  }
  if (typeof data.cursor === 'number') await metaSet('cursor', data.cursor);
}

/**
 * Drain all pages of remote records since the cursor until a short page is
 * returned (H2). Independent of pending pushes, so a pull-only device converges
 * in a single cycle instead of one 500-row page per 30 s.
 */
async function drainPull(
  creds: { unitId: string; unitKey: string },
  token: string | undefined,
): Promise<void> {
  let more = true;
  let guard = 0;
  while (more && guard < 100) {
    guard += 1;
    const since = (await metaGet<number>('cursor')) ?? 0;
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: authHeaders(creds.unitId, creds.unitKey, token),
      body: JSON.stringify({ records: [], since, limit: PULL_LIMIT }),
    });
    if (res.status === 401) await throwFor401(res);
    if (!res.ok) break;
    const data = (await res.json()) as SyncResponse;
    await applyPulled(data);
    // Short page → caught up. Full page → there may be more.
    more = data.records.length >= PULL_LIMIT;
  }
}

// ---------------- orchestration ----------------
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let backoff = BACKOFF_BASE_MS;
let rerunRequested = false;
let current: Promise<void> | null = null;

/**
 * Run a full sync cycle. Never throws. If a cycle is already running, the caller
 * waits for it and then one more cycle runs, so an entry saved during a sync (and a
 * "Sync now" tap) is always pushed before this promise resolves — instead of the call
 * silently returning while that entry stays pending.
 */
export async function syncNow(): Promise<void> {
  if (running) {
    rerunRequested = true;
    while (running && current) await current;
    return;
  }
  current = (async () => {
    do {
      rerunRequested = false;
      await syncCycle();
    } while (rerunRequested);
  })();
  try { await current; } finally { current = null; }
}

/** One full sync cycle. Never throws. */
async function syncCycle(): Promise<void> {
  if (running) return;
  running = true;
  setState({ syncing: true });
  try {
    const creds = await credentials();
    if (!creds) {
      setState({ error: null, syncing: false });
      return;
    }
    if (isBrowser && typeof navigator !== 'undefined' && !navigator.onLine) {
      setState({ online: false, syncing: false });
      return;
    }

    await registerUnitIfNeeded();

    // Attach a per-user token if we hold a valid one. We do NOT refuse to sync
    // when it is absent: bootstrap (a unit with no server-side user records yet)
    // is accepted with the unit key alone, and the server returns 401
    // 'needs_login' for authenticated writes once the unit has users. That 401
    // is what flips authState → 'needs_login' (handled in catch below).
    const auth = await storedToken();
    const token = auth?.token;

    // Push (may be several batches if a lot is pending).
    let data = await pushPending(creds, token);
    if (data) await applyPulled(data);

    // If a full push batch went out, keep draining until < PUSH_BATCH pending.
    let guard = 0;
    while (data && (await db.records.where('sync').equals('pending').count()) > 0 && guard < 50) {
      guard += 1;
      data = await pushPending(creds, token);
      if (data) await applyPulled(data);
    }

    // H2: drain all remote pages until a short page (independent of pending pushes).
    await drainPull(creds, token);

    // Photos last: small, critical records (money, wool) never wait behind photo
    // uploads on a slow connection; every still-pending photo is (re)tried each cycle.
    await pushPendingPhotos(creds);

    backoff = BACKOFF_BASE_MS;
    setState({ online: true, authState: 'ok', error: null, lastSyncAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof NeedsLoginError) {
      // Stale/absent token: drop it and ask the user to log in again when online.
      await clearToken();
      setState({ online: true, authState: 'needs_login' });
    } else {
      const message = err instanceof Error ? err.message : 'sync_error';
      backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
      setState({ error: message });
    }
  } finally {
    await refreshPending();
    setState({ syncing: false });
    running = false;
  }
}

function scheduleNext(delayMs: number): void {
  if (!isBrowser) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    await syncNow();
    // Use backoff after errors, else the steady interval.
    scheduleNext(state.error ? backoff : INTERVAL_MS);
  }, delayMs);
}

let autoStarted = false;

/** Start automatic syncing: online events + a 30 s loop. Idempotent. */
export function startAutoSync(): () => void {
  if (!isBrowser || autoStarted) return () => undefined;
  autoStarted = true;

  const onOnline = () => {
    setState({ online: true });
    void syncNow();
  };
  const onOffline = () => setState({ online: false });

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  void refreshPending();
  void syncNow();
  scheduleNext(INTERVAL_MS);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    if (timer) clearTimeout(timer);
    timer = null;
    autoStarted = false;
  };
}
