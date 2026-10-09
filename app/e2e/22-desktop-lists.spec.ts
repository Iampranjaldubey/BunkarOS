// Bunkar OS — E2E 22 (desktop project, 1440×900): list screens become real tables.
// SPEC-019 AC3/AC6: header cells, row click opens details, wide weaver grid, no sideways scroll.
import { test, expect, type Page } from '@playwright/test';
import { APP, createUnitAndLogin, loadDemo, forceEnglish, resetLocal } from './fixtures';

async function noHorizontalScroll(page: Page): Promise<void> {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.scrollingElement!.scrollWidth, iw: window.innerWidth }));
  expect(sw, 'page must not scroll sideways').toBeLessThanOrEqual(iw);
}

async function expectTable(page: Page, testid: string, minRows = 1): Promise<void> {
  const table = page.getByTestId(testid).first();
  await expect(table).toBeVisible({ timeout: 20_000 });
  expect(await table.evaluate((el) => el.tagName)).toBe('TABLE');
  expect(await table.locator('thead th').count()).toBeGreaterThanOrEqual(2);
  expect(await table.locator('tbody tr').count()).toBeGreaterThanOrEqual(minRows);
  // The header must not cover the first row (regression: a sticky header inside the
  // table's scroll box sat 64 px low and swallowed clicks on row 1).
  const firstRowHit = await table.locator('tbody tr').first().evaluate((tr) => {
    const b = tr.getBoundingClientRect();
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return Boolean(hit && tr.contains(hit));
  });
  expect(firstRowHit, 'first table row is visible and clickable').toBe(true);
  await noHorizontalScroll(page);
}

test.describe('22 desktop lists', () => {
  test.beforeEach(async ({ page }) => {
    await createUnitAndLogin(page);
    await loadDemo(page);
    await forceEnglish(page);
  });
  test.afterEach(async ({ page }) => { await resetLocal(page); });

  test('orders table → row opens the order → pieces table', async ({ page }) => {
    await page.goto(`${APP}/orders`);
    await expectTable(page, 'orders-table', 3);
    // Only the table is built on desktop (no hidden phone cards with the same rows).
    await expect(page.getByText('EX-118', { exact: true })).toHaveCount(1);
    await page.getByTestId('orders-table').locator('tbody tr').filter({ hasText: 'EX-118' }).first().click();
    await expect(page).toHaveURL(/\/orders\/[^/]+$/);
    await expectTable(page, 'pieces-table', 12);
  });

  test('looms table → row opens the loom', async ({ page }) => {
    await page.goto(`${APP}/looms`);
    await expectTable(page, 'looms-table', 24);
    await page.getByTestId('looms-table').locator('tbody tr').first().click();
    await expect(page).toHaveURL(/\/looms\/[^/]+$/);
  });

  test('thekedars, yarn, roker, audit and rates render as tables', async ({ page }) => {
    await page.goto(`${APP}/thekedars`);
    await expectTable(page, 'thekedars-table', 2);
    await page.goto(`${APP}/yarn`);
    await expectTable(page, 'yarn-table', 1);
    await page.goto(`${APP}/roker`);
    await expectTable(page, 'roker-table', 1);
    await expect(page.getByTestId('roker-closing')).toBeVisible();
    await page.goto(`${APP}/audit`);
    await expectTable(page, 'audit-table', 10);
    await page.getByTestId('audit-table').locator('tbody tr').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto(`${APP}/rates`);
    await expectTable(page, 'weaving-rates-table', 1);
    await expectTable(page, 'job-rates-table', 1);
  });

  test('weavers: photo grid with ≥ 4 cards per row', async ({ page }) => {
    await page.goto(`${APP}/weavers`);
    const tiles = page.getByTestId('weaver-tile');
    await expect(tiles.first()).toBeVisible({ timeout: 20_000 });
    const ys = await tiles.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(ys.filter((y) => y === ys[0]).length).toBeGreaterThanOrEqual(4);
    await noHorizontalScroll(page);
  });
});
