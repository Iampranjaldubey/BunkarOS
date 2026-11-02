import { test, expect } from '@playwright/test';
import { setupAndLogin, loginAs, logout, istToday } from './fixtures';

/** SPEC-M10 AC1: owner adds a holiday → chip, survives reload, attendance shows the note; staff cannot edit; remove → gone. */
test('holidays: owner adds and removes; attendance shows the day off; staff read-only', async ({ page }) => {
  const day = istToday(); // attendance allows dates up to today, so use today
  await setupAndLogin(page);
  await page.goto('/settings');
  const card = page.getByTestId('holidays-card');
  await expect(card).toContainText('अभी कोई छुट्टी नहीं');
  await card.getByLabel('छुट्टी की तारीख').fill(day);
  await card.getByRole('button', { name: /छुट्टी जोड़ें/ }).click();
  await expect(card.getByTestId(`holiday-${day}`)).toBeVisible();

  await page.reload();
  await expect(page.getByTestId(`holiday-${day}`)).toBeVisible();

  await page.goto('/attendance');
  await expect(page.getByTestId('day-off-note')).toHaveText('छुट्टी');

  // Staff sees the list but no add/remove buttons.
  await page.goto('/settings');
  await page.getByRole('button', { name: /स्टाफ़ जोड़ें/ }).click();
  await page.getByRole('dialog').getByLabel(/^नाम/).fill('Munshi Ji');
  await page.getByRole('dialog').getByLabel(/4 अंक का पिन/).fill('2222');
  await page.getByRole('dialog').getByRole('button', { name: /सेव करें/ }).click();
  await expect(page.getByText('Munshi Ji', { exact: true })).toBeVisible();
  await expect(page.getByText('सिंक हो गया')).toBeVisible({ timeout: 20_000 });
  await logout(page);
  await loginAs(page, 'Munshi Ji', '2222');
  await page.goto('/settings');
  const staffCard = page.getByTestId('holidays-card');
  await expect(staffCard.getByTestId(`holiday-${day}`)).toBeVisible();
  await expect(staffCard.getByRole('button')).toHaveCount(0);

  // Owner removes it.
  await logout(page);
  await loginAs(page, 'Shubham', '1234');
  await page.goto('/settings');
  await page.getByTestId(`holiday-${day}`).getByRole('button', { name: /हटाएँ/ }).click();
  await expect(page.getByTestId(`holiday-${day}`)).toHaveCount(0);
  await expect(page.getByTestId('holidays-card')).toContainText('अभी कोई छुट्टी नहीं');
  await page.goto('/attendance');
  await expect(page.getByTestId('day-off-note')).toHaveCount(weekdayIsSunday(day) ? 1 : 0);
});

function weekdayIsSunday(day: string): boolean { return new Date(`${day}T12:00:00Z`).getUTCDay() === 0; }
