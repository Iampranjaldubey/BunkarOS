import { test, expect } from '@playwright/test';
import { setupAndLogin } from './fixtures';

/** SPEC-M02 AC1 on the real screens: ₹12,000, 2 absent, 1 half, 3h OT @ ₹58, ₹1,000 advance → paid ₹10,020. */
test('advance → attendance → wage sheet → pay → slip → lock month', async ({ page }) => {
  await setupAndLogin(page);
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Rafiq');
  await page.getByLabel(/^फ़ोन/).fill('9876501234');
  await page.getByLabel(/महीने की तनख्वाह/).fill('12000');
  await page.getByLabel(/ओवरटाइम रेट/).fill('58');
  const today = new Date(); const y = today.getFullYear(); const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = (n: number) => `${y}-${m}-${String(n).padStart(2, '0')}`;
  await page.getByLabel(/कब से काम पर/).fill(d(1));
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/workers$/);

  // Advance ₹1,000 cash.
  await page.goto('/advances/new');
  await page.getByLabel(/किसको/).selectOption({ label: 'Rafiq' });
  await page.getByLabel(/रकम/).fill('1000');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page.getByTestId('worker-balance')).toContainText('₹1,000');

  // Attendance: 2 absent days, 1 half day, 1 present with 3h OT — on four different dates this month.
  const marks: [string, 'P' | 'H' | 'A', number][] = [[d(1), 'A', 0], [d(2), 'A', 0], [d(3), 'H', 0], [d(4), 'P', 3]];
  for (const [day, st, ot] of marks) {
    if (day > today.toISOString().slice(0, 10)) continue;
    await page.goto('/attendance');
    await page.getByLabel('तारीख').fill(day);
    const row = page.getByTestId('attendance-list').locator('li').filter({ hasText: 'Rafiq' });
    await row.getByRole('radio', { name: new RegExp(`^${st}$`) }).click();
    await expect(row.getByRole('radio', { name: new RegExp(`^${st}$`) })).toHaveAttribute('aria-checked', 'true');
    for (let i = 0; i < ot * 2; i++) await row.getByRole('button', { name: '+0.5h' }).click();
    if (ot) await expect(row.getByText(`OT ${ot}h`)).toBeVisible();
  }

  // Wage sheet shows the computed amount; pay page breakdown matches AC1.
  await page.goto('/wages');
  await page.getByText('Rafiq').first().click();
  await expect(page).toHaveURL(/\/wages\/\d{4}-\d{2}\//);
  await expect(page.getByTestId('wage-paid')).toHaveText('₹10,020');
  await expect(page.getByText(/ग़ैरहाज़िरी \(2 दिन\)/).first()).toBeVisible();
  // > ₹2,000 → photo required (D8): attach one, then confirm.
  await page.locator('input[type=file]').setInputFiles('e2e/photo.png');
  await expect(page.getByRole('button', { name: /दोबारा लें/ })).toBeVisible();
  await page.getByRole('button', { name: /भुगतान पक्का करें/ }).click();
  await expect(page.getByText(/को दिया/)).toBeVisible();
  await expect(page.getByTestId('wage-paid')).toHaveText('₹10,020');

  // Slip preview text lists the lines; share goes through preview-and-confirm.
  await page.getByRole('button', { name: /पर्ची/ }).first().click();
  await expect(page.getByRole('dialog')).toContainText('दिया: ₹10,020');
  await page.keyboard.press('Escape');

  // Second payment impossible (page now shows paid state); balance is 0.
  await page.goto('/workers'); await page.getByText('Rafiq').first().click();
  await expect(page.getByTestId('worker-balance')).toContainText('₹0');

  // Lock the month → attendance refuses.
  await page.goto('/wages');
  await expect(page.getByTestId('wages-paid')).toContainText('₹10,020');
  await page.getByRole('button', { name: /महीना लॉक करें/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /पक्का करें/ }).click();
  await expect(page.getByText(/महीना लॉक है/).first()).toBeVisible();
  await page.goto('/attendance');
  await expect(page.getByRole('alert')).toContainText('लॉक');
  await expect(page.getByTestId('attendance-list').getByRole('radio').first()).toBeDisabled();
});
