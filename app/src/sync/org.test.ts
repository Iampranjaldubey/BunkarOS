// SPEC-M18 §1, scorecard metric 8: the organisation from the last sync is kept on the phone and used offline.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../db/db';
import { applyOrg, getSyncState, loadOrg, syncNow } from './client';
import type { OrgInfo } from './types';

const bags: OrgInfo = { industry: 'bags', modules: { attendance: true, wages: true, advances: true, stock: true, orders: true, catalogue: false }, status: 'paused' };

describe('organisation on the phone (SPEC-M18)', () => {
  beforeEach(async () => {
    await db.records.clear(); await db.meta.clear(); await db.photos.clear();
    await db.meta.put({ key: 'bunkar.unit', value: { unitId: 'u1', unitKey: 'k'.repeat(43), unitName: 'U' } });
    await db.meta.put({ key: 'unitRegistered', value: true });
  });

  it('a sync response carries the org; it is stored and becomes the sync state', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ accepted: [], rejected: [], records: [], cursor: 0, org: bags }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
    await syncNow();
    expect(getSyncState().org).toEqual(bags);
    expect((await db.meta.get('bunkar.org'))?.value).toEqual(bags);
  });

  it('offline: the stored org is loaded at start without any network', async () => {
    await db.meta.put({ key: 'bunkar.org', value: bags });
    globalThis.fetch = vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
    await applyOrg(undefined); // nothing from the server
    await loadOrg();
    expect(getSyncState().org?.industry).toBe('bags');
    expect(getSyncState().org?.modules.catalogue).toBe(false);
    expect(getSyncState().org?.status).toBe('paused');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
