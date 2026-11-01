import { test, expect, type Page } from '@playwright/test';
import { setupAndLogin, attRow, markRadio, setOvertime } from './fixtures';

async function addWorker(page: Page, name: string) {
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill(name); await page.getByLabel(/महीने की तनख्वाह/).fill('9000');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click(); await expect(page).toHaveURL(/\/workers$/);
}

/** SPEC-M12: desktop-first behaviour at 1440 px. */
test('desktop UX: keyboard roll call, log table + type filter, quick entry, collapse remembered, context panel, home panels, logout', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await setupAndLogin(page);
  await setOvertime(page, true); // the + / − keys change overtime, which is off by default (D-001)
  await expect(page.getByTestId('topbar-date')).toBeVisible();
  await addWorker(page, 'Aamir'); await addWorker(page, 'Bilal');

  // Attendance by keyboard: P marks and moves down, A marks, ↑ goes back, + / − change OT, 2 = half.
  await page.goto('/attendance');
  await expect(page.getByTestId('attendance-table')).toBeVisible();
  const aamir = attRow(page, 'Aamir'); const bilal = attRow(page, 'Bilal');
  await aamir.focus();
  await page.keyboard.press('p');
  await expect(markRadio(aamir, 'P')).toHaveAttribute('aria-checked', 'true');
  await expect(bilal).toBeFocused();
  await page.keyboard.press('a');
  await expect(markRadio(bilal, 'A')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(aamir).toBeFocused();
  await page.keyboard.press('+');
  await expect(aamir.getByText('OT 0.5h')).toBeVisible();
  await page.keyboard.press('+');
  await expect(aamir.getByText('OT 1h')).toBeVisible();
  await page.keyboard.press('-');
  await expect(aamir.getByText('OT 0.5h')).toBeVisible();
  await page.keyboard.press('2');
  await expect(markRadio(aamir, 'H')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/2\/2 लगी/)).toBeVisible();
  await page.getByLabel('सिर्फ़ बाकी').check();
  await expect(page.getByText('सबकी हाज़िरी लग गई')).toBeVisible();

  // Entry log: a table; the type filter keeps only attendance; edited marks show as reversed.
  await page.goto('/log');
  await expect(page.getByTestId('log-table')).toBeVisible();
  await page.getByLabel('एंट्री की तरह').selectOption({ label: 'हाज़िरी' });
  await expect(page.getByTestId('log-row').first()).toContainText(/Aamir|Bilal/);
  await expect(page.getByTestId('log-row').filter({ hasText: 'कारीगर' })).toHaveCount(0);
  await expect(page.getByTestId('log-row').filter({ hasText: 'वापस लिया' }).first()).toBeVisible();

  // Quick entry menu: opens, Esc closes and returns focus, a link navigates and closes it.
  const quick = page.getByTestId('quick-entry'); const menu = page.getByTestId('quick-entry-menu');
  await quick.click();
  await expect(menu.getByRole('link')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(quick).toBeFocused();
  await quick.click();
  await menu.getByRole('link', { name: 'एडवांस दें' }).click();
  await expect(page).toHaveURL(/\/advances\/new$/);
  await expect(menu).toHaveCount(0);

  // Context panel on the advance form: the picked worker's balance and last advances.
  const ctx = page.getByTestId('form-context');
  await expect(ctx).toContainText('कारीगर चुनें');
  await page.getByLabel(/किसको/).selectOption({ label: 'Aamir' });
  await expect(page.getByTestId('ctx-balance')).toHaveText('₹0');
  await page.getByLabel(/रकम/).fill('500');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/workers\//);
  await page.goto('/advances/new');
  await page.getByLabel(/किसको/).selectOption({ label: 'Aamir' });
  await expect(page.getByTestId('ctx-balance')).toHaveText('₹500');
  await expect(ctx).toContainText('₹500');

  // Collapse the side menu: icons keep their names; the choice survives a reload.
  const nav = page.getByTestId('side-nav');
  await page.getByTestId('nav-toggle').click();
  await expect(nav).toHaveAttribute('data-collapsed', 'true');
  await expect(nav.getByRole('link', { name: 'हाज़िरी', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('side-nav')).toHaveAttribute('data-collapsed', 'true');
  const mainLeft = await page.locator('main').evaluate((el) => el.getBoundingClientRect().left);
  expect(mainLeft).toBeGreaterThanOrEqual(76);
  await page.getByTestId('nav-toggle').click();
  await expect(page.getByTestId('side-nav')).toHaveAttribute('data-collapsed', 'false');

  // Home panels: an overdue order and a low-stock item, each opens its record.
  await page.goto('/stock/new');
  await page.getByLabel(/^नाम/).fill('Dye'); await page.getByLabel(/कम स्टॉक की चेतावनी/).fill('5');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click(); await expect(page).toHaveURL(/\/stock$/);
  await page.goto('/orders/new');
  await page.getByRole('button', { name: /नया खरीदार/ }).click();
  await page.getByRole('dialog').getByLabel(/नाम \/ फर्म/).fill('Sharma');
  await page.getByRole('dialog').getByRole('button', { name: /सेव करें/ }).click();
  await expect(page.getByLabel(/^खरीदार/)).toHaveValue(/.+/);
  await page.getByLabel(/डिज़ाइन/).fill('Kashan'); await page.getByLabel(/कितने कालीन/).fill('3');
  await page.getByLabel(/कब तक देना है/).fill('2020-01-01');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click(); await expect(page).toHaveURL(/\/orders\/(?!new)[^/]+$/);
  await page.goto('/');
  await expect(page.getByTestId('home-stock-panel')).toContainText('Dye');
  const orders = page.getByTestId('home-orders-panel');
  await expect(orders).toContainText('Kashan');
  await orders.getByRole('link', { name: /Kashan/ }).click();
  await expect(page).toHaveURL(/\/orders\/(?!new)[^/]+$/);

  // Logout from the side menu.
  await page.getByTestId('side-logout').click();
  await expect(page).toHaveURL(/\/login/);
  expect(errors, 'page errors').toEqual([]);
});
