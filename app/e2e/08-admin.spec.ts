import { test, expect } from '@playwright/test';
import { setupAndLogin } from './fixtures';

/** SPEC-M09: founders' admin sees every unit, its logins, workers, wage sheet and entries. Read-only. */
test('admin login → units table → unit page with workers, wage sheet and entries; wrong key refused', async ({ page, browser }) => {
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
  await expect(a.getByRole('heading', { name: 'All units' })).toBeVisible();
  const row = a.getByTestId('admin-units').locator('tr').filter({ hasText: 'Ideal Carpet' }).first();
  await expect(row).toContainText('Shubham');
  await row.getByRole('link', { name: 'Ideal Carpet' }).click();
  await expect(a.getByRole('heading', { name: 'Ideal Carpet' })).toBeVisible();
  await expect(a.getByTestId('admin-workers')).toContainText('1');
  await expect(a.getByTestId('admin-workers-table')).toContainText('Rafiq');
  await expect(a.getByTestId('admin-wages')).toContainText('₹12,000');
  await expect(a.getByTestId('admin-log')).toContainText('Rafiq');
  await expect(a.getByTestId('admin-usage')).toContainText('Shubham');
  // Reload keeps the admin signed in; log out returns to the login form.
  await a.reload();
  await expect(a.getByRole('heading', { name: 'Ideal Carpet' })).toBeVisible();
  await a.getByRole('button', { name: 'Log out' }).click();
  await expect(a.getByLabel('Admin key')).toBeVisible();
  await admin.close();
});
