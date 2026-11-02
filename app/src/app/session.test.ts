// SPEC-M11 AC3 + AC4: PIN hashes leave the phone once the server has them; login uses the server
// online and only this phone's own verifier offline.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../db/db';
import type { Rec, UserP } from '../db/types';
import { syncNow, scrubPinHashes } from '../sync/client';
import { loginWithPin, storePinVerifier } from './session';
import { hashPin } from '../lib/pin';

function memStorage(): Storage {
  const m = new Map<string, string>();
  return { get length() { return m.size; }, clear: () => m.clear(), getItem: (k) => m.get(k) ?? null, key: (i) => [...m.keys()][i] ?? null, removeItem: (k) => { m.delete(k); }, setItem: (k, v) => { m.set(k, String(v)); } };
}
vi.stubGlobal('localStorage', memStorage());
vi.stubGlobal('sessionStorage', memStorage());

const UNIT = 'u1';
const userRec = (id: string, p: Partial<UserP>, sync: Rec['sync']): Rec<UserP> => ({
  id, type: 'user', unitId: UNIT, by: 'owner', role: 'owner', device: 'd', at: '2026-11-01T10:00:00Z', day: '2026-11-01', sync,
  payload: { entityId: p.entityId ?? id, name: 'N', phone: '', role: 'staff', active: true, ...p },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const setOnline = (onLine: boolean) => vi.stubGlobal('navigator', { onLine });

beforeEach(async () => {
  await db.records.clear(); await db.meta.clear(); await db.photos.clear();
  await db.meta.put({ key: 'bunkar.unit', value: { unitId: UNIT, unitKey: 'k'.repeat(43), unitName: 'U' } });
  await db.meta.put({ key: 'unitRegistered', value: true });
  localStorage.clear(); sessionStorage.clear();
});

describe('AC3: PIN hashes are removed from the phone', () => {
  it('after the server accepts a user record, the local copy has no hash', async () => {
    const { pinHash, pinSalt } = await hashPin('1234');
    await db.records.put(userRec('r1', { pinHash, pinSalt }, 'pending'));
    globalThis.fetch = vi.fn(async (_u: unknown, init?: RequestInit) => {
      const ids = ((JSON.parse(String(init?.body ?? '{}')) as { records?: Rec[] }).records ?? []).map((r) => r.id);
      return json({ accepted: ids, rejected: [], records: [], cursor: 0 });
    }) as unknown as typeof fetch;
    await syncNow();
    const r = await db.records.get('r1');
    expect(r?.sync).toBe('synced');
    expect((r?.payload as UserP).pinHash).toBeUndefined();
    expect((r?.payload as UserP).pinSalt).toBeUndefined();
    expect((r?.payload as UserP).name).toBe('N');
  });

  it('the start-up scrub strips synced user records, keeps pending ones, and runs once', async () => {
    const { pinHash, pinSalt } = await hashPin('1234');
    await db.records.bulkPut([userRec('s1', { pinHash, pinSalt }, 'synced'), userRec('p1', { entityId: 'e2', pinHash, pinSalt }, 'pending')]);
    expect(await scrubPinHashes()).toBe(1);
    expect((await db.records.get('s1'))?.payload).not.toHaveProperty('pinHash');
    expect((await db.records.get('p1'))?.payload).toHaveProperty('pinHash', pinHash);
    // Second run is a no-op even if a synced record with a hash appears later (pulls never carry one).
    await db.records.put(userRec('s2', { entityId: 'e3', pinHash, pinSalt }, 'synced'));
    expect(await scrubPinHashes()).toBe(0);
  });
});

describe('AC4: login', () => {
  const user: UserP = { entityId: 'staff1', name: 'Munshi', phone: '', role: 'staff', active: true };

  it('online: the server decides; 401 → wrong_pin, 200 → ok and a device verifier is stored', async () => {
    setOnline(true);
    let pinOk = false;
    globalThis.fetch = vi.fn(async (url: unknown) => {
      if (String(url).includes('/api/auth/token')) return pinOk ? json({ ok: true, token: 't', exp: Date.now() + 60_000 }) : json({ ok: false, error: 'unauthorized' }, 401);
      return json({ accepted: [], rejected: [], records: [], cursor: 0 });
    }) as unknown as typeof fetch;
    expect(await loginWithPin(user, '0000', UNIT)).toEqual({ ok: false, reason: 'wrong_pin' });
    pinOk = true;
    expect(await loginWithPin(user, '1234', UNIT)).toEqual({ ok: true });
    expect(await db.meta.get('bunkar.pin.staff1')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('bunkar.session')!)).toMatchObject({ userId: 'staff1', role: 'staff' });
  });

  it('online: 429 → rate_limited (no lockout count)', async () => {
    setOnline(true);
    globalThis.fetch = vi.fn(async (url: unknown) => (String(url).includes('/api/auth/token') ? json({ ok: false }, 429) : json({ accepted: [], rejected: [], records: [], cursor: 0 }))) as unknown as typeof fetch;
    expect(await loginWithPin(user, '1234', UNIT)).toEqual({ ok: false, reason: 'rate_limited' });
  });

  it('offline with no verifier on this phone → needs_internet', async () => {
    setOnline(false);
    globalThis.fetch = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await loginWithPin({ ...user, entityId: 'never-here' }, '1234', UNIT)).toEqual({ ok: false, reason: 'needs_internet' });
  });

  it('offline with a verifier → ok for the right PIN, wrong_pin otherwise', async () => {
    setOnline(false);
    globalThis.fetch = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    await storePinVerifier('staff2', '4321');
    const u2 = { ...user, entityId: 'staff2' };
    expect(await loginWithPin(u2, '1111', UNIT)).toEqual({ ok: false, reason: 'wrong_pin' });
    expect(await loginWithPin(u2, '4321', UNIT)).toEqual({ ok: true });
  });

  it('network failure while "online" falls back to the device verifier', async () => {
    setOnline(true);
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    await storePinVerifier('staff3', '2468');
    expect(await loginWithPin({ ...user, entityId: 'staff3' }, '2468', UNIT)).toEqual({ ok: true });
  });

  it('online, server does not know a login created on this phone yet → its pending hash lets it in; a wrong PIN does not', async () => {
    setOnline(true);
    globalThis.fetch = vi.fn(async (url: unknown) => (String(url).includes('/api/auth/token') ? json({ ok: false }, 401) : json({ accepted: [], rejected: [], records: [], cursor: 0 }))) as unknown as typeof fetch;
    const { pinHash, pinSalt } = await hashPin('2222');
    const fresh = { ...user, entityId: 'staff-new', pinHash, pinSalt };
    expect(await loginWithPin(fresh, '1111', UNIT)).toEqual({ ok: false, reason: 'wrong_pin' });
    expect(await loginWithPin(fresh, '2222', UNIT)).toEqual({ ok: true });
  });

  it('five wrong PINs lock the user out', async () => {
    setOnline(false);
    globalThis.fetch = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    await storePinVerifier('staff4', '1357');
    const u4 = { ...user, entityId: 'staff4' };
    for (let i = 0; i < 4; i++) expect((await loginWithPin(u4, '0000', UNIT)).reason).toBe('wrong_pin');
    expect((await loginWithPin(u4, '0000', UNIT)).reason).toBe('locked');
    expect((await loginWithPin(u4, '1357', UNIT)).reason).toBe('locked');
  });
});
