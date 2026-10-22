import { test, expect } from '@playwright/test';
import { setupAndLogin } from './fixtures';

test('desktop: side rail visible, bottom bar hidden, no horizontal scroll', async ({ page }) => {
  await setupAndLogin(page);
  await expect(page.getByTestId('side-nav')).toBeVisible();
  await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
  for (const path of ['/', '/settings', '/log', '/more']) {
    await page.goto(path);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(over, `horizontal overflow on ${path}`).toBe(false);
  }
});
