// Bunkar OS — E2E 05b: offline app-shell reload (M3/M5), preview build (:4173).
// The dev server disables the service worker, so this scenario runs against the
// production preview build where vite-plugin-pwa registers an auto-update SW
// that precaches the app shell. After one online load, going offline and doing
// a FULL reload still serves the shell (bottom nav visible) — proving the PWA
// works offline. Pure UI: no /src module imports (those exist only in dev).
import { test, expect } from '@playwright/test';
import { createUnitAndLogin, resetLocal } from './fixtures';

test.describe('05b offline app-shell (preview build)', () => {
  test.afterEach(async ({ page, context }) => {
    await context.setOffline(false);
    try {
      await page.evaluate(async () => {
        localStorage.clear();
        sessionStorage.clear();
        const regs = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
        await Promise.all(regs.map((r) => r.unregister()));
        await new Promise<void>((res) => {
          const q = indexedDB.deleteDatabase('bunkar');
          q.onsuccess = q.onerror = q.onblocked = () => res();
        });
      });
    } catch {
      /* page may be closed */
    }
  });

  test('full reload while offline still serves the app shell', async ({ page, context }) => {
    await createUnitAndLogin(page, { name: 'Shell Carpets', owner: 'Salim Ansari', pin: '1234' });

    // Wait for a controlling service worker (precache complete).
    await page.waitForFunction(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg && reg.active);
    }, undefined, { timeout: 30_000 });

    // Owner home is visible online (bottom nav present).
    await expect(page.getByRole('navigation')).toBeVisible();

    // --- Go offline and FULL-reload: the SW serves the cached shell. ---
    await context.setOffline(true);
    await page.reload();
    // The app shell renders offline: the role bottom nav comes back.
    await expect(page.getByRole('navigation')).toBeVisible({ timeout: 20_000 });
    // And we are still on an app route (not a browser error page).
    await expect(page).toHaveURL(/localhost:4173\//);

    await resetLocal(page);
  });
});
