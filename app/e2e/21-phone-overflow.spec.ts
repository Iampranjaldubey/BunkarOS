import { test, expect } from '@playwright/test';
import { setupAndLogin } from './fixtures';

const ROUTES = ['/', '/attendance', '/workers', '/workers/new', '/advances/new', '/wages', '/stock', '/stock/new', '/stock/move/in', '/stock/move/adjust', '/orders', '/orders/new', '/buyers', '/month', '/log', '/settings', '/more'];

test('phone: no horizontal overflow and no page errors on any route; all three languages', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await setupAndLogin(page);
  for (const lang of ['हिंदी', 'Hinglish', 'EN']) {
    await page.getByRole('radio', { name: lang }).click();
    for (const path of ROUTES) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(over, `horizontal overflow on ${path} (${lang})`).toBe(false);
    }
  }
  expect(errors, 'page errors').toEqual([]);
});
