// Bunkar OS — E2E 10: Round-2 UI/UX fixes (docs/reviews/round2-ui-ux.md).
// Covers the three blocking UI findings fixed in round 2:
//   R2-1  Exporter demo banner must use the accessible saffron-ink token
//         (white-on-#8a5a0a = 5.92:1) — not the failing bright saffron (2.94:1).
//   R2-2  Header sync-badge (the force-sync button when pending > 0) must meet
//         the project's 48px tap-target rule on every screen.
//   R2-3  Thekedar filter chips on the owner home must meet the 48px rule.
import { test, expect } from '@playwright/test';
import { APP, createUnitAndLogin, loadDemo, forceEnglish, resetLocal } from './fixtures';

// #8a5a0a → rgb(138, 90, 10). The failing bright saffron was #c98a1c.
const SAFFRON_INK_RGB = 'rgb(138, 90, 10)';

test.describe('10 round-2 UI fixes', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('R2-1: exporter demo banner uses the accessible saffron-ink fill', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Exporter Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await forceEnglish(page);

    await page.goto(`${APP}/o/EX-118`);
    const banner = page.getByText('Demo mock').first();
    await expect(banner).toBeVisible();

    // The banner background must be the accessible dark-amber token, so white
    // text clears WCAG AA (5.92:1) rather than the old 2.94:1 bright saffron.
    const bg = await banner.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe(SAFFRON_INK_RGB);
  });

  test('R2-2: pending sync badge is a >=48px tap target', async ({ page }) => {
    // Block the sync push so queued records stay pending while the browser is
    // still "online" — this is exactly the state in which SyncBadge renders its
    // force-sync <button> (online && pending > 0).
    await page.route('**/api/sync', (route) => route.abort());

    await createUnitAndLogin(page, { name: 'Ansari Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await forceEnglish(page);
    await page.goto(`${APP}/`);

    // The force-sync control is the only button whose aria-label counts pending.
    const syncBtn = page.getByRole('button', { name: /बाकी|pending/i }).first();
    await expect(syncBtn).toBeVisible({ timeout: 10_000 });
    const box = await syncBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(48);
    expect(box!.width).toBeGreaterThanOrEqual(48);
  });

  test('R2-3: owner-home thekedar filter chips are >=48px tap targets', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Ansari Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await forceEnglish(page);
    await page.goto(`${APP}/`);

    // The chips live in the loom-board filter group ("All thekedars" + each name).
    const group = page.getByRole('group', { name: /thekedar/i });
    await expect(group).toBeVisible();
    const chips = group.getByRole('button');
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await chips.nth(i).boundingBox();
      expect(box, `chip ${i} has a box`).not.toBeNull();
      expect(box!.height, `chip ${i} height >= 48`).toBeGreaterThanOrEqual(48);
    }
  });
});
