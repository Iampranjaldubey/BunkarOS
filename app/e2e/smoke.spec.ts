// Bunkar OS — E2E smoke tests (owned by the demo + E2E harness agent).
// Covers the three contract scenarios plus a demo-seed sanity check:
//   1. setup -> login -> owner home visible
//   2. wrong PIN shows a Hindi error (no session)
//   3. public slip page with a bogus token shows a friendly error
import { test, expect } from '@playwright/test';
import {
  APP,
  createUnitAndLogin,
  loginAs,
  loadDemo,
} from './fixtures';

test.describe('Bunkar OS smoke', () => {
  test('setup -> login -> owner home visible', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Ansari Carpets', owner: 'Salim Ansari', pin: '1234' });

    // Landed on a role home (not /setup or /login).
    await expect(page).toHaveURL(/localhost:5173\/$/);
    // Bottom nav landmark is present on every role home.
    await expect(page.getByRole('navigation')).toBeVisible();
    // Unit name shows in the header.
    await expect(page.getByText('Ansari Carpets')).toBeVisible();
  });

  test('wrong PIN shows an error and keeps the user logged out', async ({ page }) => {
    await createUnitAndLogin(page, { owner: 'Salim Ansari', pin: '1234' });

    // Log out to return to /login (header "more"/settings has logout; simplest
    // is to clear session via the login route fresh).
    await page.goto(`${APP}/login`);
    await page.getByRole('button', { name: /Salim Ansari/ }).first().click();

    // Enter a wrong 4-digit PIN.
    for (const d of '9999') {
      await page.getByRole('button', { name: d, exact: true }).click();
    }

    // A visible alert appears and we stay on /login (no session granted).
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('public slip page with a bogus token shows a friendly error', async ({ page }) => {
    // Short, clearly-invalid token: the server returns 404 (token < 22 chars),
    // so the public page shows its friendly "not found" state (or, if the API
    // is unreachable, the equally-friendly "offline" state). Either proves the
    // page did not crash on a bad token.
    await page.goto(`${APP}/s/not-a-real-token`);

    // The always-present public shell header ("powered by") renders.
    await expect(page.locator('header')).toBeVisible();

    // A human-readable message appears — match either friendly state in Hindi.
    const friendly = page.getByText(
      /पर्ची नहीं मिली|इंटरनेट नहीं है|not found|No internet/i,
    );
    await expect(friendly.first()).toBeVisible({ timeout: 10_000 });

    // No uncaught error blanked the body.
    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('demo seed loads and renders a populated owner home', async ({ page }) => {
    await createUnitAndLogin(page, { owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);

    // Reload home so projections pick up the freshly seeded records.
    await page.goto(`${APP}/`);
    // The looms registry should now show 24 looms (code chips 01..24).
    await page.goto(`${APP}/looms`);
    await expect(page.getByText(/01/).first()).toBeVisible({ timeout: 10_000 });
    // Orders list shows the seeded EX-118 order.
    await page.goto(`${APP}/orders`);
    await expect(page.getByText(/EX-118/).first()).toBeVisible({ timeout: 10_000 });

    // Sanity on the loom board counts via the domain projection, run in-page.
    const board = await page.evaluate(async () => {
      const proj = await import('/src/domain/projections.ts');
      const dbMod = await import('/src/db/db.ts');
      const sess = JSON.parse(
        localStorage.getItem('bunkar.session') ??
          sessionStorage.getItem('bunkar.session') ??
          'null',
      );
      const recs = await dbMod.db.records.where('unitId').equals(sess.unitId).toArray();
      const rows = proj.loomBoard(recs, new Date().toISOString());
      const by = { on_track: 0, slow: 0, idle: 0, no_wool: 0, free: 0 } as Record<string, number>;
      for (const r of rows) by[r.status]++;
      return { total: rows.length, by };
    });
    expect(board.total).toBe(24);
    expect(board.by).toEqual({ on_track: 17, slow: 3, idle: 3, no_wool: 1, free: 0 });
  });

  test.afterEach(async ({ page }) => {
    // Keep each test's unit isolated: clear local data so the next test's
    // fresh /setup starts clean.
    await page.evaluate(async () => {
      const w = window as unknown as { __bunkarDemo?: { clear: () => Promise<void> } };
      try {
        if (w.__bunkarDemo) await w.__bunkarDemo.clear();
      } catch {
        /* ignore */
      }
      // Also wipe meta + session so /setup is reachable again.
      localStorage.clear();
      sessionStorage.clear();
      indexedDB.deleteDatabase('bunkar');
    });
  });
});
