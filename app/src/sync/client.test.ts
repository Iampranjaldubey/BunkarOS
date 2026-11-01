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
