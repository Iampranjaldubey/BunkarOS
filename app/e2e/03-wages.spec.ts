import { test, expect, type Page } from '@playwright/test';
import { setupAndLogin, istPrevMonth, attRow, attList, markRadio, setSalary, setOvertime } from './fixtures';

/**
 * SPEC-M02 AC1 on the real screens: ₹12,000, 2 absent, 1 half, 3h OT @ ₹58, ₹1,000 advance → paid ₹10,020.
 * Runs in the previous IST month so the four marked days are always in the past (works on the 1st of a month too).
 */
test('advance → attendance → wage sheet → pay → slip → lock month', async ({ page }) => {
  const { d } = istPrevMonth();
  const goPrevMonth = async (p: Page) => p.getByTestId('month-picker').getByRole('button', { name: 'वापस' }).click();

  await setupAndLogin(page);
  await setOvertime(page, true); // AC1 has overtime; D-001 default is off
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Rafiq');
  await page.getByLabel(/^फ़ोन/).fill('9876501234');
  await page.getByLabel(/महीने की तनख्वाह/).fill('12000');
  await page.getByLabel(/ओवरटाइम रेट/).fill('58');
  await page.getByLabel(/कब से काम पर/).fill(d(1));
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/workers$/);

  // Advance ₹1,000 cash, dated in that month.
  await page.goto('/advances/new');
  await page.getByLabel(/किसको/).selectOption({ label: 'Rafiq' });
  await page.getByLabel(/रकम/).fill('1000');
  await page.getByLabel('तारीख').fill(d(1));
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page.getByTestId('worker-balance')).toContainText('₹1,000');

  // Attendance: 2 absent days, 1 half day, 1 present with 3h OT — on four different dates.
  const marks: [string, 'P' | 'H' | 'A', number][] = [[d(1), 'A', 0], [d(2), 'A', 0], [d(3), 'H', 0], [d(4), 'P', 3]];
  for (const [day, st, ot] of marks) {
    await page.goto('/attendance');
    await page.getByLabel('तारीख').fill(day);
    const row = attRow(page, 'Rafiq');
    await markRadio(row, st).click();
    await expect(markRadio(row, st)).toHaveAttribute('aria-checked', 'true');
    for (let i = 0; i < ot * 2; i++) await row.getByRole('button', { name: '+0.5h' }).click();
    if (ot) await expect(row.getByText(`OT ${ot}h`)).toBeVisible();
  }

  // SPEC-M02 AC5 / D-001: with overtime off the recorded 3 h stay but pay nothing for this unpaid month → ₹9,846.
  const openPay = async () => {
    await page.goto('/wages');
    await goPrevMonth(page);
    await page.getByText('Rafiq').first().click();
    await expect(page).toHaveURL(/\/wages\/\d{4}-\d{2}\//);
  };
  await setOvertime(page, false);
  await openPay();
  await expect(page.getByTestId('wage-paid')).toHaveText('₹9,846');
  await expect(page.getByTestId('wage-counts')).not.toContainText('OT');
  await expect(page.getByTestId('wage-lines')).not.toContainText('ओवरटाइम');
  // Overtime on again → AC1: the same hours are paid, ₹10,020.
  await setOvertime(page, true);
  await openPay();
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
  const slipBefore = (await page.getByRole('dialog').textContent())!;
  await page.keyboard.press('Escape');
  const linesBefore = (await page.getByTestId('wage-lines').textContent())!;
  expect(linesBefore).toContain('₹12,000');
  expect(linesBefore).toMatch(/ग़ैरहाज़िरी \(2 दिन\).*−₹923\.08/);

  // SPEC-M16 AC1: the owner raises the salary afterwards → the paid month still shows what was paid.
  await setSalary(page, 'Rafiq', 15000);
  await page.goto('/wages');
  await goPrevMonth(page);
  await page.getByText('Rafiq').first().click();
  await expect(page.getByTestId('wage-paid')).toHaveText('₹10,020');
  await expect(page.getByTestId('wage-lines')).toHaveText(linesBefore);
  await expect(page.getByTestId('wage-lines')).not.toContainText('₹15,000');
  await expect(page.getByTestId('wage-counts')).toContainText('P 1 · H 1 · A 2 · OT 3h');
  await page.getByRole('button', { name: /पर्ची/ }).first().click();
  await expect(page.getByRole('dialog')).toHaveText(slipBefore);
  await page.keyboard.press('Escape');

  // Second payment impossible (page now shows paid state); balance is 0.
  await page.goto('/workers'); await page.getByText('Rafiq').first().click();
  await expect(page.getByTestId('worker-balance')).toContainText('₹0');

  // Lock the month → attendance for a day in that month refuses.
  await page.goto('/wages');
  await goPrevMonth(page);
  await expect(page.getByTestId('wages-paid')).toContainText('₹10,020');
  await page.getByRole('button', { name: /महीना लॉक करें/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /पक्का करें/ }).click();
  await expect(page.getByText(/महीना लॉक है/).first()).toBeVisible();
  await page.goto('/attendance');
  await page.getByLabel('तारीख').fill(d(5));
  await expect(page.getByRole('alert')).toContainText('लॉक');
  await expect(attList(page).getByRole('radio').first()).toBeDisabled();

  // SPEC-M16 AC2: the owner cannot undo the locked month's entries from the log either — only a lock mark shows.
  await page.goto('/log');
  await page.getByLabel('एंट्री की तरह').selectOption({ label: 'हाज़िरी' });
  await expect(page.getByTestId('log-locked')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'एंट्री वापस लें' })).toHaveCount(0);
  await page.getByLabel('एंट्री की तरह').selectOption({ label: 'पगार भुगतान' });
  await expect(page.getByTestId('log-locked')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'एंट्री वापस लें' })).toHaveCount(0);
});
