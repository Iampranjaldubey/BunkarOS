import { test, expect } from '@playwright/test';
import { setupAndLogin, loginAs } from './fixtures';

test('setup → owner login → add staff → log shows entries → staff login → sync', async ({ page }) => {
  await setupAndLogin(page);
  await expect(page.getByTestId('bottom-nav')).toBeVisible();

  // Settings: add a staff login.
  await page.goto('/settings');
  await page.getByRole('button', { name: /स्टाफ़ जोड़ें/ }).click();
  await page.getByLabel(/^नाम/).fill('Munshi Ji');
  await page.getByLabel(/4 अंक का पिन/).fill('2222');
  await page.getByRole('dialog').getByRole('button', { name: /सेव करें/ }).click();
  await expect(page.getByText('Munshi Ji')).toBeVisible();

  // Entry log shows the user record with author + type label.
  await page.goto('/log');
  await expect(page.getByText(/Munshi Ji · स्टाफ़/)).toBeVisible();

  // Sync reaches the server: badge goes to synced.
  await expect(page.getByText('सिंक हो गया')).toBeVisible({ timeout: 20_000 });

  // Logout → staff login works (PIN 2222) and bottom nav is there.
  await page.goto('/more');
  await page.getByRole('button', { name: /लॉग आउट/ }).click();
  await expect(page).toHaveURL(/\/login/);
  await loginAs(page, 'Munshi Ji', '2222');
  await expect(page.getByTestId('bottom-nav')).toBeVisible();
});

test('three languages: Hinglish and English apply instantly and persist', async ({ page }) => {
  await page.goto('/setup');
  await page.getByRole('radio', { name: 'Hinglish' }).click();
  await expect(page.getByRole('heading', { name: 'Nayi unit banaayein' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nayi unit banaayein' })).toBeVisible();
  await page.getByRole('radio', { name: 'EN' }).click();
  await expect(page.getByRole('heading', { name: 'Create a new unit' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
