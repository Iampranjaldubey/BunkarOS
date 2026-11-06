import { test, expect } from '@playwright/test';
import { setupAndLogin } from './fixtures';

/** SPEC-M09 + SPEC-M18: founders see every organisation and its usage, never its business data (owner 2026-11-06). */
test('admin login → organisations table → organisation page with usage only; wrong key refused', async ({ page, browser }) => {
  await setupAndLogin(page);
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Rafiq'); await page.getByLabel(/महीने की तनख्वाह/).fill('12000');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click(); await expect(page).toHaveURL(/\/workers$/);
  await expect(page.getByText('सिंक हो गया')).toBeVisible({ timeout: 20_000 });

  const admin = await browser.newContext({ baseURL: 'http://localhost:5174', viewport: { width: 1280, height: 800 } });
  const a = await admin.newPage();
  await a.goto('/admin');
  await a.getByLabel('Name').fill('shubham');
  await a.getByLabel('Admin key').fill('wrong-key');
  await a.getByRole('button', { name: 'Sign in' }).click();
  await expect(a.getByRole('alert')).toContainText('Wrong name or key');
  await a.getByLabel('Admin key').fill('e2e-admin-key-123');
  await a.getByRole('button', { name: 'Sign in' }).click();
  await expect(a.getByRole('heading', { name: 'Organisations' })).toBeVisible();
  const row = a.getByTestId('admin-units').locator('tr').filter({ hasText: 'Ideal Carpet' }).first();
  await expect(row).toContainText('Shubham');
  await expect(row).toContainText('Carpet');
  await expect(row).toContainText('Active');
  await row.click();
  await expect(a.getByRole('heading', { name: 'Ideal Carpet' })).toBeVisible();
  // The admin page loads once; the owner's phone pushes the worker ~1 s after saving. Reload until it is counted.
  await expect(async () => {
    await a.reload();
    await expect(a.getByTestId('admin-workers')).toContainText('1', { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await expect(a.getByTestId('admin-usage')).toContainText('Shubham');
  // Usage only: no worker names, wages or entries of the unit reach the founders.
  await expect(a.locator('main')).not.toContainText('Rafiq');
  await expect(a.locator('main')).not.toContainText('₹12,000');
  // Reload keeps the admin signed in; log out returns to the login form.
  await a.reload();
  await expect(a.getByRole('heading', { name: 'Ideal Carpet' })).toBeVisible();
  await a.getByRole('button', { name: 'Log out' }).click();
  await expect(a.getByLabel('Admin key')).toBeVisible();
  await admin.close();
});
