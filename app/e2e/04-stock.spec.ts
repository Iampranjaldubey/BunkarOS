import { test, expect } from '@playwright/test';
import { setupAndLogin } from './fixtures';

/** SPEC-M03 AC1..AC3: in 25.000, out 12.500, adjust −0.250 → 12.250; low-stock flag; over-issue blocked. */
test('item → stock in/out/adjust → ledger → low stock → over-issue blocked', async ({ page }) => {
  await setupAndLogin(page);
  await page.goto('/stock/new');
  await page.getByLabel(/^नाम/).fill('Wool red');
  await page.getByLabel(/कम स्टॉक की चेतावनी/).fill('15');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/stock$/);
  await expect(page.getByText('Wool red')).toBeVisible();

  await page.goto('/stock/move/in');
  await page.getByLabel(/^आइटम/).selectOption({ label: 'Wool red (किलो)' });
  await page.getByLabel(/^मात्रा/).fill('25');
  await page.getByLabel(/भाव/).fill('400');
  await expect(page.getByText(/कुल कीमत: ₹10,000/)).toBeVisible();
  // ₹10,000 > ₹2,000 → photo required
  await page.locator('input[type=file]').setInputFiles('e2e/photo.png');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page.getByTestId('item-balance')).toContainText('25.000');

  await page.goto('/stock/move/out');
  await page.getByLabel(/^आइटम/).selectOption({ label: 'Wool red (किलो)' });
  await page.getByLabel(/^मात्रा/).fill('12.5');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page.getByTestId('item-balance')).toContainText('12.500');
  await expect(page.getByText('कम है').first()).toBeVisible(); // 12.5 ≤ 15

  await page.goto('/stock/move/adjust');
  await page.getByLabel(/^आइटम/).selectOption({ label: 'Wool red (किलो)' });
  await page.getByLabel(/कितना बदला/).fill('-0.250');
  await page.getByLabel(/^नोट/).fill('monsoon');
  await page.locator('input[type=file]').setInputFiles('e2e/photo.png'); // wastage always needs a photo
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page.getByTestId('item-balance')).toContainText('12.250');
  await expect(page.getByText(/आखिर में/)).toBeVisible();

  // Over-issue: 20 kg when 12.250 held. SPEC-M16 AC4: the owner may go below zero only with a reason.
  await page.goto('/stock/move/out');
  await page.getByLabel(/^आइटम/).selectOption({ label: 'Wool red (किलो)' });
  await page.getByLabel(/^मात्रा/).fill('20');
  await expect(page.getByText(/इसके बाद बाकी: -7.750/)).toBeVisible();
  await expect(page.getByTestId('override-reason')).toBeVisible();
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/stock\/move\/out/); // refused: no reason given
  await expect(page.getByText('यह ज़रूरी है')).toBeVisible();
  await page.getByTestId('override-reason').fill('गिनती बाद में होगी');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page.getByTestId('item-balance')).toContainText('-7.750');
  // The server accepted it (the badge reaches "synced", nothing rejected) and the log keeps the entry.
  await expect(page.getByText('सिंक हो गया')).toBeVisible({ timeout: 20_000 });
  await page.goto('/log');
  await expect(page.getByText(/Wool red −20\.000/)).toBeVisible();
  await expect(page.getByText('सर्वर ने नहीं माना')).toHaveCount(0);

  // Dashboard-side signal: the stock page shows the low-stock count.
  await page.goto('/stock');
  await expect(page.getByText(/1 आइटम कम हैं/)).toBeVisible();
});
