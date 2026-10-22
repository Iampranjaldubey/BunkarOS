// Language choice before login: the हिंदी / EN switch is on the setup and
// login screens, applies at once, carries into the app and survives a reload.
import { test, expect } from '@playwright/test';
import { enterPin, resetLocal } from './fixtures';

test.afterEach(async ({ page }) => {
  await resetLocal(page);
});

test('setup + login offer हिंदी and English; the choice applies everywhere', async ({ page }) => {
  await page.goto('/setup');
  const langGroup = page.getByRole('radiogroup', { name: /भाषा चुनें|Choose language/ });
  await expect(langGroup).toBeVisible();

  // Default is Hindi.
  await expect(page.getByRole('radio', { name: 'हिंदी' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('heading', { name: 'बुनकर OS' })).toBeVisible();

  // Switch to English on setup → applies immediately, no reload.
  await page.getByRole('radio', { name: 'EN' }).click();
  await expect(page.getByRole('heading', { name: 'Bunkar OS' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'New unit' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // Create the unit in English → login screen is English too.
  const inputs = page.locator('form input');
  for (const [i, v] of ['Ansari Carpets', 'Salim Ansari', '9876543210', '1234', '1234'].entries()) {
    await inputs.nth(i).fill(v);
  }
  await page.locator('form button[type=submit]').click();
  await page.waitForURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Pick your name' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'EN' })).toHaveAttribute('aria-checked', 'true');

  // Change back to Hindi on the login screen → applies immediately.
  await page.getByRole('radio', { name: 'हिंदी' }).click();
  await expect(page.getByRole('heading', { name: 'अपना नाम चुनें' })).toBeVisible();

  // Survives a reload before login.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'अपना नाम चुनें' })).toBeVisible();

  // Pick English again, log in → the app opens in English.
  await page.getByRole('radio', { name: 'EN' }).click();
  await page.getByRole('button', { name: /Salim Ansari/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Enter PIN' })).toBeVisible();
  await enterPin(page, '1234');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Orders' }).first()).toBeVisible();
  await expect(page.getByRole('banner').getByRole('radio', { name: 'EN' })).toHaveAttribute('aria-checked', 'true');

  // Owner sets the language in Settings → the app switches at once (no reload).
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Save settings' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'हिंदी' }).click();
  await sheet.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'ऑर्डर' }).first()).toBeVisible();
  await expect(page.getByRole('banner').getByRole('radio', { name: 'हिंदी' })).toHaveAttribute('aria-checked', 'true');
});
