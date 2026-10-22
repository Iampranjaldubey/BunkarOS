import { test, expect } from '@playwright/test';
import { setupAndLogin } from './fixtures';

test('dashboard tiles reflect records; monthly report shows sheets; Excel export downloads', async ({ page }) => {
  await setupAndLogin(page);
  // One worker, one low-stock item, one overdue order → tiles turn red; every tile links somewhere.
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Rafiq'); await page.getByLabel(/महीने की तनख्वाह/).fill('9000');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click(); await expect(page).toHaveURL(/\/workers$/);
  await page.goto('/stock/new');
  await page.getByLabel(/^नाम/).fill('Dye'); await page.getByLabel(/कम स्टॉक की चेतावनी/).fill('5');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click(); await expect(page).toHaveURL(/\/stock$/);
  await page.goto('/orders/new');
  await page.getByRole('button', { name: /नया खरीदार/ }).click();
  await page.getByRole('dialog').getByLabel(/नाम \/ फर्म/).fill('B1');
  await page.getByRole('dialog').getByRole('button', { name: /सेव करें/ }).click();
  await expect(page.getByLabel(/^खरीदार/)).toHaveValue(/.+/);
  await page.getByLabel(/डिज़ाइन/).fill('K'); await page.getByLabel(/कितने कालीन/).fill('3');
  await page.getByLabel(/कब तक देना है/).fill('2020-01-01');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click(); await expect(page).toHaveURL(/\/orders\/(?!new)[^/]+$/);

  await page.goto('/');
  await expect(page.getByTestId('tile-attendance')).toContainText('0 हाज़िर / 1');
  await expect(page.getByTestId('tile-attendance')).toContainText('1 की हाज़िरी बाकी');
  await expect(page.getByTestId('tile-stock')).toContainText('Dye');
  await expect(page.getByTestId('tile-orders')).toContainText('1');
  await expect(page.getByTestId('tile-wages')).toContainText('₹9,000');
  await expect(page.getByTestId('entries-today')).toContainText('Shubham');
  await page.getByTestId('tile-orders').click();
  await expect(page).toHaveURL(/\/orders$/);

  // Monthly report: sheets render and the Excel file downloads.
  await page.goto('/month');
  await expect(page.getByTestId('attendance-sheet')).toContainText('Rafiq');
  await expect(page.getByTestId('wage-sheet')).toContainText('₹9,000');
  await expect(page.getByTestId('stock-sheet')).toContainText('Dye');
  await expect(page.getByTestId('usage')).toContainText('Shubham');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-xlsx').click()]);
  expect(download.suggestedFilename()).toMatch(/^Bunkar_Ideal_Carpet_\d{4}-\d{2}\.xlsx$/);
  const path = await download.path();
  expect(path).toBeTruthy();
});
