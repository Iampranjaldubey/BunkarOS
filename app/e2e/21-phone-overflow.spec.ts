import { test, expect } from '@playwright/test';
import { setupAndLogin } from './fixtures';

const ROUTES = ['/', '/attendance', '/workers', '/workers/new', '/advances/new', '/wages', '/stock', '/stock/new', '/stock/move/in', '/stock/move/adjust', '/orders', '/orders/new', '/buyers', '/month', '/log', '/settings', '/more'];

test('phone + tablet: no horizontal overflow and no page errors on any route at 390 and 768; all three languages', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await setupAndLogin(page);
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1024 });
    for (const lang of ['हिंदी', 'Hinglish', 'EN']) {
      await page.getByRole('banner').getByRole('radio', { name: lang }).click();
      for (const path of ROUTES) {
        await page.goto(path);
        await expect(page.locator('main')).toBeVisible();
        const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(over, `horizontal overflow on ${path} at ${width} (${lang})`).toBe(false);
      }
    }
  }
  await expect(page.getByTestId('bottom-nav')).toBeVisible();
  expect(errors, 'page errors').toEqual([]);
});
