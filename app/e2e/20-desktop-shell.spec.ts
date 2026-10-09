// SPEC-019 — Desktop & tablet shell (desktop project, 1440x900, DPR 1).
// Owner logs in + loads demo, then we verify the side nav, hidden bottom nav,
// wide main, side-nav navigation, a centered sheet, and no horizontal scroll
// across several widths. The phone layout is covered by the mobile project.
import { test, expect } from '@playwright/test';
import { createUnitAndLogin, loadDemo, resetLocal } from './fixtures';

test.afterEach(async ({ page }) => {
  await resetLocal(page);
});

test('owner desktop shell: side nav, hidden bottom nav, wide main, navigation', async ({ page }) => {
  await createUnitAndLogin(page);
  await loadDemo(page);
  await page.goto('/');

  // Side nav visible, bottom nav hidden at lg+.
  const sideNav = page.getByTestId('side-nav');
  await expect(sideNav).toBeVisible();
  await expect(page.getByTestId('bottom-nav')).toBeHidden();

  // Main content is wide (≥ 900 px).
  const mainWidth = await page.locator('#main').evaluate((el) => el.getBoundingClientRect().width);
  expect(mainWidth).toBeGreaterThanOrEqual(900);

  // Navigate via the side nav to Orders, Roker, Settings.
  await sideNav.getByRole('link', { name: /ऑर्डर|Orders/ }).first().click();
  await expect(page).toHaveURL(/\/orders$/);

  await sideNav.getByRole('link', { name: /रोकड़|Roker/ }).first().click();
  await expect(page).toHaveURL(/\/roker$/);

  await sideNav.getByRole('link', { name: /सेटिंग|Settings/ }).first().click();
  await expect(page).toHaveURL(/\/settings$/);

  // Active route highlighted via aria-current (NavLink sets aria-current="page"
  // on the matching link). At least one link is marked current.
  await expect(sideNav.locator('[aria-current="page"]').first()).toBeVisible();
});

test('a Sheet opens as a centered dialog at lg (Settings > Add a user)', async ({ page }) => {
  await createUnitAndLogin(page);
  await loadDemo(page);
  await page.goto('/settings');

  // Open the "Add a user" sheet (owner-only user management).
  await page.getByRole('button', { name: /यूज़र जोड़ें|Add a user|Add user/i }).first().click();

  const dialog = page.locator('dialog[open]');
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  const vp = page.viewportSize()!;
  expect(box).not.toBeNull();
  if (box) {
    // Horizontally centered within 25% of the viewport centre.
    const dialogCenter = box.x + box.width / 2;
    const vpCenter = vp.width / 2;
    expect(Math.abs(dialogCenter - vpCenter)).toBeLessThan(vp.width * 0.25);
    // Not pinned to the bottom edge (centered dialog, not a bottom sheet).
    expect(box.y + box.height).toBeLessThan(vp.height - 20);
    expect(box.y).toBeGreaterThan(10);
  }
});

for (const width of [1024, 1280, 1440, 1920]) {
  test(`no horizontal scroll at ${width}px on key pages`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await createUnitAndLogin(page);
    await loadDemo(page);

    for (const path of ['/', '/orders', '/roker', '/settings']) {
      await page.goto(path);
      await page.waitForTimeout(200);
      const noOverflow = await page.evaluate(
        () => document.scrollingElement!.scrollWidth <= window.innerWidth,
      );
      expect(noOverflow, `${path} @ ${width}px should not scroll horizontally`).toBe(true);
    }
  });
}
