// Bunkar OS — E2E 10: two-device join + bootstrap login (round-2 BLOCKER 1).
// Owner creates a unit, adds a munshi login user, seeds the demo, and syncs up.
// A SECOND browser context joins with the unit code + key — its local IndexedDB
// is empty — opens /login, and must bootstrap-pull the unit's `user` records so
// it can pick the munshi, enter the PIN, log in, and then see the synced data
// (EX-118 order). Proves the server bootstrap pull + client bootstrapUsers wiring.
import { test, expect, type Page } from '@playwright/test';
import {
  APP,
  createUnitAndLogin,
  loginAs,
  loadDemo,
  addRecordInPage,
  hashPinInPage,
  resetLocal,
} from './fixtures';

/** Read the active unit meta (unitId + unitKey) from IndexedDB on device 1. */
async function readUnitMeta(page: Page): Promise<{ unitId: string; unitKey: string }> {
  return page.evaluate(async () => {
    const dbMod = (await import('/src/db/db.ts')) as {
      getMeta: <T>(k: string) => Promise<T | undefined>;
    };
    const m = await dbMod.getMeta<{ unitId: string; unitKey: string }>('bunkar.unit');
    return { unitId: m?.unitId ?? '', unitKey: m?.unitKey ?? '' };
  });
}

test.describe('10 two-device join', () => {
  test('a joined second device bootstraps users, logs in, and sees synced data', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    // --- Device 1: owner creates a unit, adds a munshi, seeds + syncs up. ---
    const ctx1 = await browser.newContext();
    const d1 = await ctx1.newPage();
    await createUnitAndLogin(d1, { name: 'Join Carpets', owner: 'Owner Sahab', pin: '1234' });

    const { pinHash, pinSalt } = await hashPinInPage(d1, '1111');
    await addRecordInPage(d1, 'user', {
      entityId: 'munshi-join',
      name: 'Munshi Join',
      phone: '',
      role: 'munshi',
      pinHash,
      pinSalt,
      active: true,
    });

    await loadDemo(d1);

    // Push everything (owner + munshi + demo records) to the server, then VERIFY
    // the munshi user actually landed server-side (via a token-less bootstrap
    // pull of user records) before continuing. Re-requests the token if auth
    // drifts (syncNow is single-flight and the auto-sync loop can hold it).
    const meta = await readUnitMeta(d1);
    expect(meta.unitId).not.toBe('');
    expect(meta.unitKey).not.toBe('');

    const serverMunshi = await d1.evaluate(async ({ unitId, unitKey }) => {
      const sync = (await import('/src/sync/client.ts')) as {
        syncNow: () => Promise<void>;
        getSyncState: () => { authState: string };
        requestToken: (u: string, uid: string, pin: string) => Promise<boolean>;
      };
      const dbMod = (await import('/src/db/db.ts')) as {
        db: { records: { where: (k: string) => { equals: (v: string) => { count: () => Promise<number>; toArray: () => Promise<Array<{ type: string; payload: { role?: string; entityId?: string } }>> } } } };
      };
      const recs = await dbMod.db.records.where('unitId').equals(unitId).toArray();
      const owner = recs.find((r) => r.type === 'user' && r.payload.role === 'owner');
      const ownerId = owner?.payload.entityId ?? '';
      const pending = () => dbMod.db.records.where('sync').equals('pending').count();
      // Query the server (token-less bootstrap pull) for this unit's user ids.
      const serverUsers = async (): Promise<string[]> => {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'x-unit-id': unitId, 'x-unit-key': unitKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ records: [], since: 0 }),
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { records: Array<{ payload: { entityId?: string } }> };
        return data.records.map((r) => r.payload.entityId ?? '');
      };
      for (let i = 0; i < 40; i++) {
        if (sync.getSyncState().authState !== 'ok' && ownerId) {
          await sync.requestToken(unitId, ownerId, '1234');
        }
        await sync.syncNow();
        const ids = await serverUsers();
        if ((await pending()) === 0 && ids.includes('munshi-join')) return ids;
        await new Promise((r) => setTimeout(r, 300));
      }
      return serverUsers();
    }, meta);
    expect(serverMunshi, 'munshi user reached the server').toContain('munshi-join');

    // --- Device 2: fresh context, JOIN with the unit code + key only. ---
    const ctx2 = await browser.newContext();
    const d2 = await ctx2.newPage();
    await d2.goto(`${APP}/setup`);
    // Store the unit meta via the app's own joinUnit (what the join form does).
    await d2.evaluate(async ({ unitId, unitKey }) => {
      const sess = (await import('/src/app/session.tsx')) as {
        joinUnit: (u: string, k: string) => Promise<void>;
      };
      await sess.joinUnit(unitId, unitKey);
    }, meta);

    // Before bootstrap: device 2's local IndexedDB has ZERO user records.
    const beforeUsers = await d2.evaluate(async ({ unitId }) => {
      const dbMod = (await import('/src/db/db.ts')) as {
        db: { records: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ type: string }>> } } } };
      };
      const recs = await dbMod.db.records.where('unitId').equals(unitId).toArray();
      return recs.filter((r) => r.type === 'user').length;
    }, meta);
    expect(beforeUsers).toBe(0);

    // Open /login — the mount effect calls bootstrapUsers() when local is empty.
    await d2.goto(`${APP}/login`);
    // The picker must now render BOTH login users pulled from the server.
    await expect(d2.getByRole('button', { name: /Owner Sahab/ })).toBeVisible({ timeout: 15_000 });
    await expect(d2.getByRole('button', { name: /Munshi Join/ })).toBeVisible();

    // Log in as the munshi (the join device never had the PIN hash locally).
    await loginAs(d2, 'Munshi Join', '1111');
    await expect(d2).toHaveURL(/localhost:5173\/$/);

    // After login a full sync pulls the rest; the seeded EX-118 order is visible.
    const pieceCount = await d2.evaluate(async () => {
      const sync = (await import('/src/sync/client.ts')) as { syncNow: () => Promise<void> };
      const proj = await import('/src/domain/projections.ts');
      const dbMod = await import('/src/db/db.ts');
      const raw0 =
        localStorage.getItem('bunkar.session') ??
        sessionStorage.getItem('bunkar.session') ??
        'null';
      const s = JSON.parse(raw0) as { unitId: string } | null;
      const unitId = s?.unitId ?? '';
      const pieceTotal = async () => {
        const recs = unitId
          ? await dbMod.db.records.where('unitId').equals(unitId).toArray()
          : [];
        return proj.listPieces(recs).filter((p: { orderNo: string }) => p.orderNo === 'EX-118').length;
      };
      // Drain the full pull (auto-sync may hold the lock); bounded poll.
      for (let i = 0; i < 30; i++) {
        await sync.syncNow();
        if ((await pieceTotal()) >= 12) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      const recs = unitId
        ? await dbMod.db.records.where('unitId').equals(unitId).toArray()
        : [];
      const orders = proj.listOrders(recs);
      const pieces = proj.listPieces(recs);
      return {
        hasEx118: orders.some((o: { orderNo: string }) => o.orderNo === 'EX-118'),
        pieces: pieces.filter((p: { orderNo: string }) => p.orderNo === 'EX-118').length,
      };
    });
    expect(pieceCount.hasEx118).toBe(true);
    expect(pieceCount.pieces).toBe(12);

    // The header shows the unit's name from the synced settings right away — a joined
    // phone must not stay on the generic "बुनकर OS" title until a reload.
    await expect(d2.locator('header').first()).toContainText('Ansari Carpets', { timeout: 15_000 });

    await resetLocal(d2);
    await resetLocal(d1);
    await ctx1.close();
    await ctx2.close();
  });
});
