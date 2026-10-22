import { test, expect } from '@playwright/test';
import { setupAndLogin, loginAs } from './fixtures';

test('add worker → mark attendance with OT → re-mark logs an edit → detail grid counts', async ({ page }) => {
  await setupAndLogin(page);
  // New monthly worker ₹12,000
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Rafiq');
  await page.getByLabel(/महीने की तनख्वाह/).fill('12000');
  await expect(page.getByText(/एक दिन = ₹461/)).toBeVisible(); // 12000/26 = 461.54
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/workers$/);
  await expect(page.getByText('Rafiq')).toBeVisible();

  // Attendance: present + 2h OT, then change to half.
  await page.goto('/attendance');
  const row = page.getByTestId('attendance-list').locator('li').filter({ hasText: 'Rafiq' });
  await row.getByRole('radio', { name: /^P$|हाज़िर/ }).first().click();
  await expect(row.getByRole('radio', { name: /^P$|हाज़िर/ }).first()).toHaveAttribute('aria-checked', 'true');
  await row.getByRole('button', { name: '+0.5h' }).click();
  await row.getByRole('button', { name: '+0.5h' }).click();
  await row.getByRole('button', { name: '+0.5h' }).click();
  await row.getByRole('button', { name: '+0.5h' }).click();
  await expect(row.getByText('OT 2h')).toBeVisible();
  await expect(page.getByText(/1\/1 लगी/)).toBeVisible();
  await row.getByRole('radio', { name: /^H$|आधा दिन/ }).first().click();
  await expect(row.getByRole('radio', { name: /^H$|आधा दिन/ }).first()).toHaveAttribute('aria-checked', 'true');

  // Log: newest attendance is marked "edited", the old one reversed.
  await page.goto('/log');
  await expect(page.getByText('बदला गया').first()).toBeVisible();
  await expect(page.getByText('वापस लिया').first()).toBeVisible();
  await expect(page.getByText(/Rafiq · आधा दिन · OT 2h/)).toBeVisible();

  // Detail grid: 1 half, OT 2h.
  await page.goto('/workers');
  await page.getByText('Rafiq').first().click();
  await expect(page).toHaveURL(/\/workers\//);
  const half = page.locator('p', { hasText: /^1$/ }).first();
  await expect(half).toBeVisible();
  await expect(page.getByText('2h').first()).toBeVisible();
});

test('staff cannot edit pay figures (fields disabled, note shown)', async ({ page }) => {
  await setupAndLogin(page);
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Salim');
  await page.getByLabel(/महीने की तनख्वाह/).fill('10000');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/workers$/);
  await page.goto('/settings');
  await page.getByRole('button', { name: /स्टाफ़ जोड़ें/ }).click();
  await page.getByRole('dialog').getByLabel(/^नाम/).fill('Munshi');
  await page.getByRole('dialog').getByLabel(/4 अंक का पिन/).fill('2222');
  await page.getByRole('dialog').getByRole('button', { name: /सेव करें/ }).click();
  await expect(page.getByText('Munshi', { exact: true })).toBeVisible();
  await page.goto('/more'); await page.getByRole('button', { name: /लॉग आउट/ }).click();
  await loginAs(page, 'Munshi', '2222');
  await page.goto('/workers'); await page.getByText('Salim').first().click();
  await page.getByRole('button', { name: /बदलें/ }).click();
  await expect(page.getByLabel(/महीने की तनख्वाह/)).toBeDisabled();
  await expect(page.getByText(/सिर्फ़ मालिक बदल सकता है/)).toBeVisible();
});
