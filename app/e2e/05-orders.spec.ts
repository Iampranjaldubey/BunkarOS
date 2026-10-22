import { test, expect } from '@playwright/test';
import { setupAndLogin } from './fixtures';

/** SPEC-M04 AC1/AC2: 20 pcs, deliver 12 → pending 8; deliver 8 → delivered; overdue order flagged first. */
test('buyer → order → start → deliver 12 then 8 → delivered; overdue listed first', async ({ page }) => {
  await setupAndLogin(page);
  await page.goto('/orders/new');
  await page.getByRole('button', { name: /नया खरीदार/ }).click();
  await page.getByRole('dialog').getByLabel(/नाम \/ फर्म/).fill('Sharma Exports');
  await page.getByRole('dialog').getByLabel(/^फ़ोन/).fill('9811111111');
  await page.getByRole('dialog').getByRole('button', { name: /सेव करें/ }).click();
  await expect(page.getByLabel(/^खरीदार/)).toHaveValue(/.+/);
  await expect(page.getByLabel(/ऑर्डर नंबर/)).toHaveValue('ORD-001');
  await page.getByLabel(/डिज़ाइन/).fill('Kashan');
  await page.getByLabel(/साइज़/).fill('8x10');
  await page.getByLabel(/कितने कालीन/).fill('20');
  await page.getByLabel(/भाव/).fill('5000');
  await expect(page.getByText(/कुल: ₹1,00,000/)).toBeVisible();
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/(?!new)[^/]+$/);
  await expect(page.getByTestId('order-pending')).toContainText('20');

  await page.getByRole('button', { name: /काम शुरू/ }).click();
  await expect(page.getByText('बन रहा है').first()).toBeVisible();
  await page.getByRole('button', { name: /डिलीवर करें/ }).first().click();
  await page.getByRole('dialog').getByLabel(/कितने दिए/).fill('25');
  await page.getByRole('dialog').getByRole('button', { name: /डिलीवर करें/ }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('20');
  await page.getByRole('dialog').getByLabel(/कितने दिए/).fill('12');
  await page.getByRole('dialog').getByRole('button', { name: /डिलीवर करें/ }).click();
  await expect(page.getByTestId('order-delivered')).toContainText('12/20');
  await expect(page.getByTestId('order-pending')).toContainText('8');
  await expect(page.getByText('बन रहा है').first()).toBeVisible();
  await expect(page.getByText('₹40,000')).toBeVisible(); // 8 × ₹5,000 pending

  await page.getByRole('button', { name: /डिलीवर करें/ }).first().click();
  await page.getByRole('dialog').getByLabel(/कितने दिए/).fill('8');
  await page.getByRole('dialog').getByRole('button', { name: /डिलीवर करें/ }).click();
  await expect(page.getByTestId('order-pending')).toContainText('0');
  await expect(page.getByText('डिलीवर', { exact: true }).first()).toBeVisible();

  // Second order, overdue (due yesterday) → shows first in the open list with the overdue label.
  await page.goto('/orders/new');
  await page.getByLabel(/^खरीदार/).selectOption({ index: 1 });
  await page.getByLabel(/डिज़ाइन/).fill('Bokhara');
  await page.getByLabel(/कितने कालीन/).fill('5');
  const y = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel(/कब तक देना है/).fill(y);
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/(?!new)[^/]+$/);
  await page.goto('/orders');
  await expect(page.getByText(/समय निकल गया · \d+ दिन लेट/)).toBeVisible();
  await expect(page.getByText(/1 चालू · 1 लेट/)).toBeVisible();
  await page.getByRole('radio', { name: 'सभी' }).click();
  await expect(page.getByText('ORD-001').first()).toBeVisible();
});
