import { test, expect, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { setupAndLogin, istPrevMonth, attRow, markRadio, setOvertime, setPolicy, synced, type Mark } from './fixtures';

const inr = (rupees: number) => `₹${rupees.toLocaleString('en-IN')}`;
async function markDay(page: Page, name: string, day: string, st: Mark) {
  await page.goto('/attendance');
  await page.getByLabel('तारीख').fill(day);
  const row = attRow(page, name);
  await markRadio(row, st).click();
  await expect(markRadio(row, st)).toHaveAttribute('aria-checked', 'true');
}
async function addWorker(page: Page, name: string, pay: 'monthly' | 'daily', rupees: number, joined: string) {
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill(name);
  await page.getByLabel(/^फ़ोन/).fill('9876501234');
  if (pay === 'daily') await page.getByRole('radio', { name: 'रोज़ की दिहाड़ी' }).click();
  await page.getByLabel(pay === 'monthly' ? /महीने की तनख्वाह/ : /एक दिन की दिहाड़ी/).fill(String(rupees));
  await page.getByLabel(/कब से काम पर/).fill(joined);
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/workers$/);
}

/** SPEC-M13 AC1 + D-001: defaults; overtime hidden on all 8 screens while off, shown when on. */
test('unit rules: defaults, and overtime hidden on all 8 screens while off', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await setupAndLogin(page);
  // Defaults (SPEC-M13 AC1): overtime off, policy Sundays + holidays, 8 slip sections, operator toggles per D-005, no "see wages".
  await page.goto('/settings');
  await expect(page.getByTestId('overtime-switch')).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('input[name=offDayPolicy][value=sundays_and_holidays]')).toBeChecked();
  await expect(page.getByTestId('slip-sections').getByRole('checkbox', { checked: true })).toHaveCount(8);
  await expect(page.getByTestId('perm-addEntries')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('perm-editPast')).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('perm-seePrices')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('perm-export')).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('operators-card').getByRole('switch')).toHaveCount(4);
  await expect(page.getByTestId('perm-seeWages')).toHaveCount(0);

  // 1. Worker form: no overtime rate; the new worker gets otRatePaise 0 (SPEC-M02 AC5).
  await page.goto('/workers/new');
  await expect(page.getByLabel(/ओवरटाइम रेट/)).toHaveCount(0);
  const { d, month } = istPrevMonth();
  await addWorker(page, 'Rafiq', 'monthly', 12000, d(1));
  const stored = await page.evaluate(async () => {
    const req = indexedDB.open('bunkar-mvp');
    const db: IDBDatabase = await new Promise((res) => { req.onsuccess = () => res(req.result); });
    const all: { type: string; payload: { name?: string; otRatePaise?: number } }[] = await new Promise((res) => { const g = db.transaction('records').objectStore('records').getAll(); g.onsuccess = () => res(g.result); });
    return all.find((r) => r.type === 'worker' && r.payload.name === 'Rafiq')?.payload.otRatePaise;
  });
  expect(stored).toBe(0);

  // 2. Attendance: no overtime stepper, column or chip.
  await markDay(page, 'Rafiq', d(2), 'P');
  await expect(page.getByRole('button', { name: '+0.5h' })).toHaveCount(0);
  await expect(page.getByText('ओवरटाइम (घंटे)')).toHaveCount(0);

  // 3. Wage sheet: no overtime column. 4. Pay page: no OT in the counts or lines.
  await page.goto('/wages');
  await page.getByTestId('month-picker').getByRole('button', { name: 'वापस' }).click();
  await expect(page.getByRole('columnheader', { name: 'ओवरटाइम' })).toHaveCount(0);
  await expect(page.getByText(/· OT /)).toHaveCount(0);
  await page.getByText('Rafiq').first().click();
  await expect(page.getByTestId('wage-counts')).not.toContainText('OT');
  await expect(page.getByTestId('wage-lines')).not.toContainText('ओवरटाइम');
  // Pay it, then 5. the printed slip has no overtime row.
  await page.locator('input[type=file]').setInputFiles('e2e/photo.png');
  await page.getByRole('button', { name: /भुगतान पक्का करें/ }).click();
  await expect(page.getByText(/को दिया/)).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('slip-paper')).toBeVisible();
  await expect(page.getByTestId('slip-paper')).not.toContainText('ओवरटाइम');
  await page.emulateMedia({ media: 'screen' });

  // 6. Month report: no OT column in the attendance sheet. 7. Excel: no OT columns.
  await page.goto('/month');
  await page.getByTestId('month-picker').getByRole('button', { name: 'वापस' }).click();
  await expect(page.getByTestId('attendance-sheet')).toContainText('Rafiq');
  await expect(page.getByTestId('attendance-sheet').getByRole('columnheader', { name: 'OT', exact: true })).toHaveCount(0);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-xlsx').click()]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile((await download.path())!);
  const headers = (n: number) => ((wb.worksheets[n].getRow(1).values as unknown[]) ?? []).filter(Boolean).map(String);
  expect(headers(1)).not.toContain('OT');
  expect(headers(2)).not.toContain('OT');
  expect(headers(2)).not.toContain('ओवरटाइम');
  expect(wb.worksheets[2].name).toBeTruthy();

  // 8. Worker pages: the owner's worker page and the worker's own page show no overtime.
  await page.goto('/workers'); await page.getByText('Rafiq').first().click();
  await expect(page.getByText('ओवरटाइम', { exact: true })).toHaveCount(0);
  await synced(page);
  await page.getByTestId('send-link').click();
  const url = ((await page.getByRole('dialog').textContent()) ?? '').match(/https?:\/\/\S+\/w\/[A-Za-z0-9_-]+/)![0];
  await page.keyboard.press('Escape');
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const wp = await phone.newPage();
  await wp.goto(url);
  await expect(wp.getByRole('heading', { name: /नमस्ते, Rafiq/ })).toBeVisible();
  await expect(wp.getByText('ओवरटाइम')).toHaveCount(0);
  await phone.close();

  // Overtime on → the stepper, column, form field and month column come back (SPEC-M13 AC2).
  await setOvertime(page, true);
  await page.goto('/workers/new');
  await expect(page.getByLabel(/ओवरटाइम रेट/)).toBeVisible();
  await page.goto('/attendance');
  await page.getByLabel('तारीख').fill(d(2));
  await expect(page.getByRole('button', { name: '+0.5h' }).first()).toBeVisible();
  await page.goto('/month');
  await page.getByTestId('month-picker').getByRole('button', { name: 'वापस' }).click();
  await expect(page.getByTestId('attendance-sheet').getByRole('columnheader', { name: 'OT', exact: true })).toBeVisible();
  expect(month).toMatch(/^\d{4}-\d{2}$/);
});

/**
 * D-002 / SPEC-M02 AC8 on the real screens, in the previous month: a daily ₹400 worker, absent on the first Sunday,
 * present on the second Sunday (paid once), present on three weekdays, one listed holiday left unmarked.
 * The exact AC6/AC8 numbers (₹7,400 / ₹8,600 / ₹9,000) are in src/domain/rules.test.ts.
 */
test('off-day policy: none / Sundays / Sundays and holidays change the daily worker\'s pay', async ({ page }) => {
  test.setTimeout(120_000);
  await setupAndLogin(page);
  const { d, month } = istPrevMonth();
  const [y, m] = month.split('-').map(Number);
  const days = Array.from({ length: new Date(Date.UTC(y, m, 0)).getUTCDate() }, (_, i) => d(i + 1));
  const isSunday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay() === 0;
  const sundays = days.filter(isSunday);
  const weekdays = days.filter((x) => !isSunday(x));
  const [w1, w2, w3, holiday] = weekdays;
  await addWorker(page, 'Guddu', 'daily', 400, d(1));
  // Holiday on an unmarked weekday.
  await page.goto('/settings');
  await page.getByTestId('holidays-card').getByLabel('छुट्टी की तारीख').fill(holiday);
  await page.getByTestId('holidays-card').getByRole('button', { name: /छुट्टी जोड़ें/ }).click();
  await expect(page.getByTestId(`holiday-${holiday}`)).toBeVisible();
  for (const [day, st] of [[w1, 'P'], [w2, 'P'], [w3, 'P'], [sundays[0], 'A'], [sundays[1], 'P']] as [string, Mark][]) await markDay(page, 'Guddu', day, st);

  const expected = {
    none: (3 + 1) * 400,                                  // the Sunday worked counts as a work day
    sundays: (3 + sundays.length - 1) * 400,               // every Sunday except the absent one, the worked one once
    sundays_and_holidays: (3 + sundays.length - 1 + 1) * 400,
  } as const;
  for (const policy of ['none', 'sundays', 'sundays_and_holidays'] as const) {
    await setPolicy(page, policy);
    await page.goto('/wages');
    await page.getByTestId('month-picker').getByRole('button', { name: 'वापस' }).click();
    await page.getByText('Guddu').first().click();
    await expect(page.getByTestId('wage-paid')).toHaveText(inr(expected[policy]));
    const offDays = policy === 'none' ? 0 : policy === 'sundays' ? sundays.length - 1 : sundays.length;
    if (offDays) await expect(page.getByTestId('line-off_days')).toContainText(`छुट्टी के दिन (पगार वाले): ${offDays}`);
    else await expect(page.getByTestId('line-off_days')).toHaveCount(0);
  }
});
