// Bunkar OS — E2E 13: SPEC-014 one device per login + remote sign-out.
// Each Playwright browser context has its own localStorage, so its own
// `bunkar.device` id — i.e. a separate "phone". We drive the real setup/login
// flows and the owner's Settings → फ़ोन section across two contexts.
//
// Coverage (SPEC-014 AC1..AC5):
//  AC1 munshi logged in on phone A, then phone B online → notice, no session.
//  AC2 owner signs the munshi's phone out → phone B logs in; phone A's next sync
//      shows the signed-out notice and logs out (its unsynced records remain).
//  AC3 owner logs in on a new phone → takeover; old phone signed out.
//  AC4 munshi token → device list / sign-out API → 403.
//  AC5 owner, munshi, thekedar on ONE shared office phone → all log in + sync.
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import {
  APP,
  createUnitAndLogin,
  loginAs,
  addRecordInPage,
  hashPinInPage,
  resetLocal,
} from './fixtures';

/** Read {unitId, unitKey} from device 1's IndexedDB meta. */
async function readUnitMeta(page: Page): Promise<{ unitId: string; unitKey: string }> {
  return page.evaluate(async () => {
    const dbMod = (await import('/src/db/db.ts')) as {
      getMeta: <T>(k: string) => Promise<T | undefined>;
    };
    const m = await dbMod.getMeta<{ unitId: string; unitKey: string }>('bunkar.unit');
    return { unitId: m?.unitId ?? '', unitKey: m?.unitKey ?? '' };
  });
}

/** Store unit meta on a fresh device (what the join form does) + bootstrap users. */
async function joinUnitOnDevice(page: Page, meta: { unitId: string; unitKey: string }): Promise<void> {
  await page.goto(`${APP}/setup`);
  await page.evaluate(async ({ unitId, unitKey }) => {
    const sess = (await import('/src/app/session.tsx')) as {
      joinUnit: (u: string, k: string) => Promise<void>;
    };
    await sess.joinUnit(unitId, unitKey);
  }, meta);
  await page.goto(`${APP}/login`);
}

/** Add a munshi login user on device 1 (authored by the owner session). */
async function addMunshi(page: Page, over: { entityId: string; name: string; pin: string; role?: string; thekedarId?: string }): Promise<void> {
  const { pinHash, pinSalt } = await hashPinInPage(page, over.pin);
  await addRecordInPage(page, 'user', {
    entityId: over.entityId,
    name: over.name,
    phone: '',
    role: over.role ?? 'munshi',
    pinHash,
    pinSalt,
    active: true,
    ...(over.thekedarId ? { thekedarId: over.thekedarId } : {}),
  });
}

/** Force device 1 to push everything to the server (bounded poll). */
async function pushAll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const sync = (await import('/src/sync/client.ts')) as {
      syncNow: () => Promise<void>;
      getSyncState: () => { authState: string };
    };
    const dbMod = (await import('/src/db/db.ts')) as {
      db: { records: { where: (k: string) => { equals: (v: string) => { count: () => Promise<number> } } } };
    };
    for (let i = 0; i < 30; i++) {
      await sync.syncNow();
      const pending = await dbMod.db.records.where('sync').equals('pending').count();
      if (pending === 0) break;
      await new Promise((r) => setTimeout(r, 200));
    }
  });
}

/** The device id localStorage key for a context's page. */
async function deviceId(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('bunkar.device') ?? '');
}

test.describe('13 one device per login + remote sign-out (SPEC-014)', () => {
  test('AC1/AC2: munshi bound to phone A is refused on phone B; owner sign-out frees it', async ({ browser }) => {
    test.setTimeout(120_000);
    // --- Phone A: owner creates a unit + adds a munshi, syncs up. ---
    const ctxA = await browser.newContext();
    const a = await ctxA.newPage();
    await createUnitAndLogin(a, { name: 'Device Carpets', owner: 'Malik Ji', pin: '1234' });
    await addMunshi(a, { entityId: 'u-munshi', name: 'Munshi Ram', pin: '1111' });
    await pushAll(a);
    const meta = await readUnitMeta(a);
    expect(meta.unitId).not.toBe('');

    // Munshi logs in on phone A (binds the munshi to phone A).
    await a.goto(`${APP}/login`);
    await loginAs(a, 'Munshi Ram', '1111');
    await expect(a).toHaveURL(/localhost:5173\/$/);

    // --- Phone B: a DIFFERENT context (different device id) joins + tries munshi. ---
    const ctxB = await browser.newContext();
    const b = await ctxB.newPage();
    expect(await deviceId(a)).not.toBe('');
    await joinUnitOnDevice(b, meta);
    await expect(b.getByRole('button', { name: /Munshi Ram/ })).toBeVisible({ timeout: 15_000 });

    // AC1: munshi login on phone B is refused with the Hindi notice; no session.
    await b.getByRole('button', { name: /Munshi Ram/ }).first().click();
    for (const d of '1111') await b.getByRole('button', { name: d, exact: true }).click();
    await expect(b.getByRole('alert')).toContainText('दूसरे फ़ोन पर चालू है', { timeout: 15_000 });
    await expect(b).toHaveURL(/\/login/);

    // --- AC2: owner (phone A) signs the munshi's phone out from Settings. ---
    // Switch phone A back to the owner so Settings → फ़ोन is available.
    await a.evaluate(() => { localStorage.removeItem('bunkar.session'); sessionStorage.removeItem('bunkar.session'); });
    await a.goto(`${APP}/login`);
    await loginAs(a, 'Malik Ji', '1234');
    await a.goto(`${APP}/settings`);
    await expect(a.getByText('फ़ोन', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    // The munshi's active phone card shows a sign-out button.
    const signoutBtn = a.getByRole('button', { name: /इस फ़ोन से साइन आउट करें/ }).first();
    await expect(signoutBtn).toBeVisible({ timeout: 15_000 });
    await signoutBtn.click();
    // ConfirmSheet → confirm.
    await a.getByRole('button', { name: /इस फ़ोन से साइन आउट करें/ }).last().click();
    await expect(a.getByText('फ़ोन से साइन आउट कर दिया')).toBeVisible({ timeout: 15_000 });

    // Now phone B can log in as the munshi (binding was freed).
    await b.goto(`${APP}/login`);
    await loginAs(b, 'Munshi Ram', '1111');
    await expect(b).toHaveURL(/localhost:5173\/$/);

    await resetLocal(a); await resetLocal(b);
    await ctxA.close(); await ctxB.close();
  });

  test('AC3: owner logging in on a new phone takes over; old phone is signed out', async ({ browser }) => {
    test.setTimeout(120_000);
    const ctxA = await browser.newContext();
    const a = await ctxA.newPage();
    await createUnitAndLogin(a, { name: 'Takeover Carpets', owner: 'Owner Sahab', pin: '4321' });
    await pushAll(a);
    const meta = await readUnitMeta(a);

    // --- Phone B: owner logs in on a new phone → takeover (succeeds). ---
    const ctxB = await browser.newContext();
    const b = await ctxB.newPage();
    await joinUnitOnDevice(b, meta);
    await expect(b.getByRole('button', { name: /Owner Sahab/ })).toBeVisible({ timeout: 15_000 });
    await loginAs(b, 'Owner Sahab', '4321');
    await expect(b).toHaveURL(/localhost:5173\/$/);

    // Phone A's next sync returns 401 device_revoked → it logs out and the login
    // screen shows the Hindi "owner signed you out" notice.
    await a.evaluate(async () => {
      const sync = (await import('/src/sync/client.ts')) as { syncNow: () => Promise<void>; getSyncState: () => { authState: string } };
      for (let i = 0; i < 30; i++) {
        await sync.syncNow();
        if (sync.getSyncState().authState === 'device_revoked') break;
        await new Promise((r) => setTimeout(r, 200));
      }
    });
    await expect(a).toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(a.getByRole('alert')).toContainText('मालिक ने इस फ़ोन से आपको साइन आउट किया है', { timeout: 15_000 });

    await resetLocal(a); await resetLocal(b);
    await ctxA.close(); await ctxB.close();
  });

  test('AC4: a munshi token cannot list or sign out devices → 403', async ({ browser }) => {
    test.setTimeout(90_000);
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await createUnitAndLogin(p, { name: 'Perm Carpets', owner: 'Owner X', pin: '1234' });
    await addMunshi(p, { entityId: 'u-m', name: 'Munshi Perm', pin: '1111' });
    await pushAll(p);
    // Log in as the munshi so the stored token is the munshi's.
    await p.evaluate(() => { localStorage.removeItem('bunkar.session'); sessionStorage.removeItem('bunkar.session'); });
    await p.goto(`${APP}/login`);
    await loginAs(p, 'Munshi Perm', '1111');
    await expect(p).toHaveURL(/localhost:5173\/$/);

    const statuses = await p.evaluate(async () => {
      const sync = (await import('/src/sync/client.ts')) as { authedFetch: (path: string, init?: RequestInit) => Promise<Response> };
      const list = await sync.authedFetch('/api/devices', { method: 'GET' });
      const so = await sync.authedFetch('/api/devices/u-m/signout', { method: 'POST' });
      return { list: list.status, signout: so.status };
    });
    expect(statuses.list).toBe(403);
    expect(statuses.signout).toBe(403);

    await resetLocal(p);
    await ctx.close();
  });

  test('AC5: owner, munshi and thekedar on ONE shared phone all log in and sync', async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx: BrowserContext = await browser.newContext();
    const p = await ctx.newPage();
    await createUnitAndLogin(p, { name: 'Shared Carpets', owner: 'Owner Shared', pin: '1234' });
    // Seed a thekedar entity + a thekedar login + a munshi login.
    const thekedarId = await p.evaluate(async () => {
      const repo = (await import('/src/db/repo.ts')) as { addRecord: (t: string, p: unknown) => Promise<{ id: string }> };
      const ids = (await import('/src/domain/ids.ts')) as { uuid: () => string };
      const id = ids.uuid();
      await repo.addRecord('thekedar', { entityId: id, name: 'Thekedar Ji', phone: '', village: 'X', active: true });
      return id;
    });
    await addMunshi(p, { entityId: 'u-m2', name: 'Munshi Share', pin: '1111' });
    await addMunshi(p, { entityId: 'u-t2', name: 'Thekedar Share', pin: '2222', role: 'thekedar', thekedarId });
    await pushAll(p);

    // All three log in from the SAME phone (same device id) and sync cleanly.
    for (const [name, pin] of [['Munshi Share', '1111'], ['Thekedar Share', '2222'], ['Owner Shared', '1234']] as const) {
      await p.evaluate(() => { localStorage.removeItem('bunkar.session'); sessionStorage.removeItem('bunkar.session'); });
      await p.goto(`${APP}/login`);
      await loginAs(p, name, pin);
      await expect(p, `${name} logs in on the shared phone`).toHaveURL(/localhost:5173\/$/);
      const authState = await p.evaluate(async () => {
        const sync = (await import('/src/sync/client.ts')) as { syncNow: () => Promise<void>; getSyncState: () => { authState: string } };
        await sync.syncNow();
        return sync.getSyncState().authState;
      });
      expect(authState, `${name} syncs without a device conflict`).toBe('ok');
    }

    await resetLocal(p);
    await ctx.close();
  });
});
