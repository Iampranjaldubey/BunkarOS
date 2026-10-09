// Bunkar OS — E2E 17: GPS capture for looms (B1) and check-ins (B2).
// With geolocation permission granted + a fixed Bhadohi-ish position, a loom
// created via the real UI persists lat/lng, and a check-in persists lat/lng.
// With permission denied, the loom still saves (graceful denial) without coords.
import { test, expect, type Browser } from '@playwright/test';
import {
  APP,
  createUnitAndLogin,
  forceEnglish,
  loadDemo,
  resetLocal,
  uploadPhoto,
  projection,
} from './fixtures';

const POS = { latitude: 25.39, longitude: 82.57 }; // Bhadohi

async function newGpsContext(browser: Browser, granted: boolean) {
  return browser.newContext({
    ...test.info().project.use,
    baseURL: 'http://localhost:5173',
    geolocation: POS,
    permissions: granted ? ['geolocation'] : [],
  });
}

/** All records of the active unit, read from IndexedDB (page-scoped helper). */
async function loomRecords(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const dbMod = (await import('/src/db/db.ts')) as {
      db: { records: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ type: string; payload: Record<string, unknown> }>> } } } };
    };
    const raw = localStorage.getItem('bunkar.session') ?? sessionStorage.getItem('bunkar.session') ?? 'null';
    const sess = JSON.parse(raw) as { unitId: string } | null;
    if (!sess) return [];
    const recs = await dbMod.db.records.where('unitId').equals(sess.unitId).toArray();
    return recs.filter((r) => r.type === 'loom').map((r) => r.payload);
  });
}

test.describe('17 GPS capture (B1/B2)', () => {
  test('loom saves lat/lng when permission granted', async ({ browser }) => {
    const ctx = await newGpsContext(browser, true);
    const page = await ctx.newPage();
    try {
      await createUnitAndLogin(page, { name: 'GPS Carpets', owner: 'Owner Sahab', pin: '1234' });
      await forceEnglish(page);

      await page.goto(`${APP}/looms/new`);
      await page.getByLabel(/^Loom code/).fill('G1');
      await page.getByLabel(/^Village/).fill('Bhadohi');
      await page.getByLabel('ft', { exact: true }).first().fill('9');

      // Capture GPS → the button flips to "Location captured".
      await page.getByRole('button', { name: /Capture location/ }).click();
      await expect(page.getByRole('button', { name: /Location captured/ })).toBeVisible({ timeout: 10_000 });

      await page.getByRole('button', { name: 'Save loom' }).click();
      await page.waitForURL(/\/looms$/);

      const looms = await loomRecords(page);
      expect(looms.length).toBe(1);
      const loom = looms[0] as { lat?: number; lng?: number };
      expect(typeof loom.lat).toBe('number');
      expect(typeof loom.lng).toBe('number');
      expect(loom.lat).toBeCloseTo(POS.latitude, 2);
      expect(loom.lng).toBeCloseTo(POS.longitude, 2);
    } finally {
      await resetLocal(page);
      await ctx.close();
    }
  });

  test('check-in saves lat/lng when permission granted', async ({ browser }) => {
    const ctx = await newGpsContext(browser, true);
    const page = await ctx.newPage();
    try {
      await createUnitAndLogin(page, { name: 'GPS Checkin Carpets', owner: 'Owner Sahab', pin: '1234' });
      await loadDemo(page);
      await forceEnglish(page);

      // A seeded on-loom piece exists; pick it on the check-in screen.
      const pieceId = await projection<string>(
        page,
        "(proj.listPieces(recs).find(p => p.loomId && p.status === 'on_loom') || {}).pieceId || ''",
      );
      expect(pieceId).toBeTruthy();

      await page.goto(`${APP}/checkin/new`);
      // Pick the piece (PiecePicker renders tappable rows with the pieceId text).
      await page.getByText(pieceId, { exact: false }).first().click();
      // Woven-since length: 4'0".
      await page.getByLabel('ft', { exact: true }).first().fill('4');
      await uploadPhoto(page);

      // Add GPS.
      await page.getByRole('button', { name: /Add location \(GPS\)/ }).click();
      await expect(page.getByRole('button', { name: /Location added/ })).toBeVisible({ timeout: 10_000 });

      await page.getByTestId('checkin-save').click();
      // Confirm sheet → save.
      await page.getByRole('button', { name: /Save check-in|Save checkin|Save/ }).last().click();
      await page.waitForURL((u) => !u.pathname.includes('/checkin'));

      const checkin = await page.evaluate(async () => {
        const dbMod = (await import('/src/db/db.ts')) as {
          db: { records: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ type: string; at: string; payload: Record<string, unknown> }>> } } } };
        };
        const raw = localStorage.getItem('bunkar.session') ?? sessionStorage.getItem('bunkar.session') ?? 'null';
        const sess = JSON.parse(raw) as { unitId: string };
        const recs = await dbMod.db.records.where('unitId').equals(sess.unitId).toArray();
        // The demo seeds several check-ins (no GPS). Pick the one WE just created:
        // the only check-in carrying lat/lng (and the newest by `at`).
        const checkins = recs
          .filter((r) => r.type === 'checkin')
          .map((r) => r.payload as { lat?: number; lng?: number })
          .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
        return checkins.length ? checkins[checkins.length - 1] : null;
      });
      expect(checkin).not.toBeNull();
      expect(typeof checkin!.lat).toBe('number');
      expect(typeof checkin!.lng).toBe('number');
      expect(checkin!.lat).toBeCloseTo(POS.latitude, 2);
      expect(checkin!.lng).toBeCloseTo(POS.longitude, 2);
    } finally {
      await resetLocal(page);
      await ctx.close();
    }
  });

  test('loom still saves (no coords) when permission denied', async ({ browser }) => {
    const ctx = await newGpsContext(browser, false);
    const page = await ctx.newPage();
    try {
      await createUnitAndLogin(page, { name: 'GPS Denied Carpets', owner: 'Owner Sahab', pin: '1234' });
      await forceEnglish(page);

      await page.goto(`${APP}/looms/new`);
      await page.getByLabel(/^Loom code/).fill('G2');
      await page.getByLabel(/^Village/).fill('Bhadohi');
      await page.getByLabel('ft', { exact: true }).first().fill('9');

      // Attempt GPS → denied; a Hindi/English notice appears, button stays "Capture".
      await page.getByRole('button', { name: /Capture location/ }).click();
      await expect(page.getByText(/permission denied|अनुमति/i).first()).toBeVisible({ timeout: 10_000 });

      // Can still save without coords.
      await page.getByRole('button', { name: 'Save loom' }).click();
      await page.waitForURL(/\/looms$/);

      const looms = await loomRecords(page);
      expect(looms.length).toBe(1);
      const loom = looms[0] as { lat?: number; lng?: number };
      expect(loom.lat).toBeUndefined();
      expect(loom.lng).toBeUndefined();
    } finally {
      await resetLocal(page);
      await ctx.close();
    }
  });
});
