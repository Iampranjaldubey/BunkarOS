import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../db/db';
import type { Rec } from '../db/types';
import { syncNow } from './client';

const rec = (id: string, by: string): Rec => ({ id, type: 'attendance', unitId: 'u1', payload: { workerId: 'w', status: 'present', otHours: 0 }, by, role: 'staff', device: 'd', at: '2026-10-23T10:00:00Z', day: '2026-10-23', sync: 'pending' });

describe('sync client — shared phone', () => {
  beforeEach(async () => {
    await db.records.clear(); await db.meta.clear(); await db.photos.clear();
    await db.meta.put({ key: 'bunkar.unit', value: { unitId: 'u1', unitKey: 'k'.repeat(43), unitName: 'U' } });
    await db.meta.put({ key: 'unitRegistered', value: true });
  });

  it('pushes only the token holder\'s pending records; another user\'s stay pending (never rejected)', async () => {
    await db.records.bulkPut([rec('a1', 'userA'), rec('b1', 'userB')]);
    await db.meta.put({ key: 'bunkar.auth', value: { token: 't', exp: Date.now() + 60_000, userId: 'userB' } });
    const sent: string[][] = [];
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { records?: Rec[] };
      const ids = (body.records ?? []).map((r) => r.id);
      sent.push(ids);
      return new Response(JSON.stringify({ accepted: ids, rejected: [], records: [], cursor: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    await syncNow();
    expect(sent.flat()).toEqual(['b1']);
    expect((await db.records.get('b1'))?.sync).toBe('synced');
    expect((await db.records.get('a1'))?.sync).toBe('pending');
  });

  it('without a token (bootstrap) every pending record is pushed', async () => {
    await db.records.bulkPut([rec('a1', 'userA'), rec('b1', 'userB')]);
    const sent: string[][] = [];
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { records?: Rec[] };
      const ids = (body.records ?? []).map((r) => r.id); sent.push(ids);
      return new Response(JSON.stringify({ accepted: ids, rejected: [], records: [], cursor: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    await syncNow();
    expect(sent.flat().sort()).toEqual(['a1', 'b1']);
  });
});

describe('sync client — photos (SPEC-M16 §6)', () => {
  beforeEach(async () => {
    await db.records.clear(); await db.meta.clear(); await db.photos.clear();
    await db.meta.put({ key: 'bunkar.unit', value: { unitId: 'u1', unitKey: 'k'.repeat(43), unitName: 'U' } });
    await db.meta.put({ key: 'unitRegistered', value: true });
    await db.meta.put({ key: 'bunkar.auth', value: { token: 't', exp: Date.now() + 60_000, userId: 'userB' } });
  });

  it('a photo refused with 409 is marked rejected and not sent again; a 200 one is synced', async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 1])], { type: 'image/jpeg' });
    await db.photos.bulkPut([
      { id: 'taken', unitId: 'u1', blob, mime: 'image/jpeg', w: 1, h: 1, at: '2026-11-02T00:00:00Z', sync: 'pending' },
      { id: 'fine', unitId: 'u1', blob, mime: 'image/jpeg', w: 1, h: 1, at: '2026-11-02T00:00:00Z', sync: 'pending' },
    ]);
    const puts: string[] = [];
    globalThis.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.startsWith('/api/photos/')) {
        puts.push(u);
        if (u.endsWith('/taken')) return new Response(JSON.stringify({ ok: false, error: 'photo_id_taken' }), { status: 409 });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      const ids = ((JSON.parse(String(init?.body ?? '{}')) as { records?: Rec[] }).records ?? []).map((r) => r.id);
      return new Response(JSON.stringify({ accepted: ids, rejected: [], records: [], cursor: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    await syncNow();
    expect((await db.photos.get('taken'))?.sync).toBe('rejected');
    expect((await db.photos.get('fine'))?.sync).toBe('synced');
    puts.length = 0;
    await syncNow();
    expect(puts).toEqual([]); // nothing pending any more: the refused photo is not retried
  });
});

describe('sync client — forced resync when the server view changes (SPEC-M13 AC7)', () => {
  beforeEach(async () => {
    await db.records.clear(); await db.meta.clear(); await db.photos.clear();
    await db.meta.put({ key: 'bunkar.unit', value: { unitId: 'u1', unitKey: 'k'.repeat(43), unitName: 'U' } });
    await db.meta.put({ key: 'unitRegistered', value: true });
    await db.meta.put({ key: 'bunkar.auth', value: { token: 't', exp: Date.now() + 60_000, userId: 'op' } });
  });

  const order = (price?: number): Rec => ({ id: 'o1', type: 'order', unitId: 'u1', payload: { entityId: 'ord', orderNo: 'ORD-1', qty: 2, ...(price !== undefined ? { pricePaise: price } : {}) }, by: 'owner', role: 'owner', device: 'd', at: '2026-11-01T10:00:00Z', day: '2026-11-01', sync: 'synced', serverSeq: 7 });

  it('prices hidden → synced records cleared, cursor reset, everything pulled again without prices; pending entry still pushed', async () => {
    await db.records.bulkPut([order(500_000), { ...rec('p1', 'op'), sync: 'pending' }]);
    await db.meta.put({ key: 'cursor', value: 7 });
    const calls: { since: number; pushed: string[] }[] = [];
    let seePrices = false;
    const server: Rec[] = []; // what the server holds besides the order (accepted pushes)
    globalThis.fetch = vi.fn(async (_u: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { records?: Rec[]; since: number };
      const ids = (body.records ?? []).map((r) => r.id);
      calls.push({ since: body.since, pushed: ids });
      for (const r of body.records ?? []) server.push({ ...r, sync: 'synced', serverSeq: 8 });
      const records = body.since === 0 ? [order(seePrices ? 500_000 : undefined), ...server] : [];
      return new Response(JSON.stringify({ accepted: ids, rejected: [], records, cursor: 7, view: { seePrices } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    await syncNow();
    expect(calls[0].pushed).toEqual(['p1']); // the pending entry was pushed first
    expect(calls.some((c) => c.since === 0)).toBe(true); // then a pull from the start
    expect((await db.records.get('o1'))?.payload).not.toHaveProperty('pricePaise');
    expect((await db.records.get('p1'))?.sync).toBe('synced');
    expect((await db.meta.get('sync.view'))?.value).toEqual({ seePrices: false });

    // Owner shows prices again → the next sync brings them back.
    seePrices = true; calls.length = 0;
    await syncNow();
    expect(calls.some((c) => c.since === 0)).toBe(true);
    expect((await db.records.get('o1'))?.payload).toHaveProperty('pricePaise', 500_000);
  });

  it('the same view does not clear anything', async () => {
    await db.records.put(order(500_000));
    await db.meta.put({ key: 'sync.view', value: { seePrices: true } });
    await db.meta.put({ key: 'cursor', value: 7 });
    const since: number[] = [];
    globalThis.fetch = vi.fn(async (_u: unknown, init?: RequestInit) => {
      since.push((JSON.parse(String(init?.body ?? '{}')) as { since: number }).since);
      return new Response(JSON.stringify({ accepted: [], rejected: [], records: [], cursor: 7, view: { seePrices: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    await syncNow();
    expect(since.every((s) => s === 7)).toBe(true);
    expect((await db.records.get('o1'))?.payload).toHaveProperty('pricePaise', 500_000);
  });
});

describe('sync client — push order', () => {
  beforeEach(async () => { await db.records.clear(); await db.meta.clear(); vi.restoreAllMocks(); });
  it('pushes pending records in the order they were written, not by id (unlock → reverse payment → pay again)', async () => {
    const r = (id: string, at: string, type: Rec['type']): Rec => ({ ...rec(id, 'u'), type, at });
    await db.records.bulkAdd([r('zzz', '2026-11-02T10:00:01.000Z', 'reversal'), r('mmm', '2026-11-02T10:00:02.000Z', 'reversal'), r('aaa', '2026-11-02T10:00:03.000Z', 'wage_payment')]);
    await db.meta.put({ key: 'bunkar.unit', value: { unitId: 'u1', unitKey: 'k'.repeat(43), unitName: 'U' } });
    await db.meta.put({ key: 'unitRegistered', value: true });
    let sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { records?: Rec[] };
      if (body.records?.length) sent = body.records.map((x) => x.id);
      return new Response(JSON.stringify({ accepted: body.records?.map((x) => x.id) ?? [], rejected: [], records: [], cursor: 0, hasMore: false }), { status: 200 });
    }));
    await syncNow();
    expect(sent).toEqual(['zzz', 'mmm', 'aaa']);
  });
});
