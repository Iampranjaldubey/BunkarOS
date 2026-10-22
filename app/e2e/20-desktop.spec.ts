import { test, expect } from '@playwright/test';
import { setupAndLogin } from './fixtures';

const ROUTES = ['/', '/attendance', '/workers', '/workers/new', '/advances/new', '/wages', '/stock', '/stock/new', '/stock/move/in', '/stock/move/adjust', '/orders', '/orders/new', '/buyers', '/month', '/log', '/settings', '/more'];

test('desktop: side rail visible, bottom bar hidden, no horizontal scroll on any route, no page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await setupAndLogin(page);
  await expect(page.getByTestId('side-nav')).toBeVisible();
  await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
  for (const path of ROUTES) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(over, `horizontal overflow on ${path}`).toBe(false);
  }
  expect(errors, 'page errors').toEqual([]);
});

test('desktop: workers list renders as a table; wage sheet as a table', async ({ page }) => {
  await setupAndLogin(page);
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Rafiq'); await page.getByLabel(/महीने की तनख्वाह/).fill('12000');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click(); await expect(page).toHaveURL(/\/workers$/);
  await expect(page.getByTestId('data-table')).toBeVisible();
  await page.goto('/wages');
  await expect(page.getByTestId('data-table')).toContainText('Rafiq');
});
