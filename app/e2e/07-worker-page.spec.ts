import { test, expect } from '@playwright/test';
import { setupAndLogin } from './fixtures';

/** SPEC-M07: owner sends a link → worker's phone opens it once and keeps it; shop-code fallback; cancel → closed. */
test('worker page via link, via shop code, stays after reload, revoked after cancel', async ({ page, browser }) => {
  await setupAndLogin(page);
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Rafiq'); await page.getByLabel(/^फ़ोन/).fill('9876501234');
  await page.getByLabel(/महीने की तनख्वाह/).fill('12000');
  const y = new Date().getFullYear(); const m = String(new Date().getMonth() + 1).padStart(2, '0');
  await page.getByLabel(/कब से काम पर/).fill(`${y}-${m}-01`);
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click(); await expect(page).toHaveURL(/\/workers$/);
  // One absent day and an advance so the worker page has something to show.
  await page.goto('/attendance');
  const row = page.getByTestId('attendance-list').locator('li').filter({ hasText: 'Rafiq' });
  await row.getByRole('radio', { name: /^A$/ }).click();
  await expect(row.getByRole('radio', { name: /^A$/ })).toHaveAttribute('aria-checked', 'true');
  await page.goto('/advances/new');
  await page.getByLabel(/किसको/).selectOption({ label: 'Rafiq' }); await page.getByLabel(/रकम/).fill('500');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page.getByTestId('worker-balance')).toContainText('₹500');
  await expect(page.getByText('सिंक हो गया')).toBeVisible({ timeout: 20_000 });

  // Owner: access code visible; send link → preview shows the URL.
  const code = (await page.getByTestId('worker-access-code').textContent())!.trim();
  expect(code).toMatch(/^\d{4}$/);
  await page.getByTestId('send-link').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('/w/');
  const url = (await dialog.textContent())!.match(/https?:\/\/\S+\/w\/[A-Za-z0-9_-]+/)![0];
  await page.keyboard.press('Escape');
  // Shop code in settings.
  await page.goto('/settings');
  const shopCode = (await page.getByTestId('shop-code').textContent())!.trim();
  expect(shopCode).toMatch(/^\d{6}$/);

  // Worker's phone #1: open the link once; page shows this month; reload keeps it; no login words.
  const phone = await browser.newContext({ baseURL: 'http://localhost:5174', viewport: { width: 390, height: 844 } });
  const wp = await phone.newPage();
  await wp.goto(url);
  await expect(wp).toHaveURL(/\/w$/);
  await expect(wp.getByRole('heading', { name: /नमस्ते, Rafiq/ })).toBeVisible();
  await expect(wp.getByTestId('wp-estimate')).toBeVisible();
  await expect(wp.getByText(/ग़ैरहाज़िर/).first()).toBeVisible();
  await wp.reload();
  await expect(wp.getByRole('heading', { name: /नमस्ते, Rafiq/ })).toBeVisible();
  await expect(wp.getByText(/लॉग/)).toHaveCount(0);
  await wp.getByRole('tab', { name: /एडवांस/ }).click();
  await expect(wp.getByTestId('wp-balance')).toContainText('₹500');
  await wp.getByRole('tab', { name: /मेरी जानकारी/ }).click();
  await expect(wp.getByText(/महीने की तनख्वाह/)).toBeVisible();
  await expect(wp.getByRole('link', { name: /मालिक से पूछें/ })).toHaveAttribute('href', /wa\.me/);

  // Worker's phone #2: shop code → name → 4-digit code; wrong code refused first.
  const phone2 = await browser.newContext({ baseURL: 'http://localhost:5174', viewport: { width: 390, height: 844 } });
  const w2 = await phone2.newPage();
  await w2.goto('/w');
  await expect(w2).toHaveURL(/\/w\/join/);
  await w2.getByLabel(/दुकान कोड/).fill(shopCode);
  await w2.getByRole('button', { name: /Rafiq/ }).click();
  await w2.getByLabel(/4 अंक का कोड/).fill('0000');
  await w2.getByRole('button', { name: /मेरा पन्ना खोलें/ }).click();
  await expect(w2.getByRole('alert')).toContainText('ग़लत');
  await w2.getByLabel(/4 अंक का कोड/).fill(code);
  await w2.getByRole('button', { name: /मेरा पन्ना खोलें/ }).click();
  await expect(w2).toHaveURL(/\/w$/);
  await expect(w2.getByRole('heading', { name: /नमस्ते, Rafiq/ })).toBeVisible();

  // Owner pays this month → worker's pay tab shows the month, the slip lines and the year total (AC4).
  await page.goto('/wages'); await page.getByText('Rafiq').first().click();
  await page.locator('input[type=file]').setInputFiles('e2e/photo.png');
  await page.getByRole('button', { name: /भुगतान पक्का करें/ }).click();
  await expect(page.getByText(/को दिया/)).toBeVisible();
  const paidText = (await page.getByTestId('wage-paid').textContent())!.trim();
  await expect(page.getByText('सिंक हो गया')).toBeVisible({ timeout: 20_000 }); // pushed to the server
  await wp.reload();
  await wp.getByRole('tab', { name: /^पगार$/ }).click();
  await expect(wp.getByTestId(`year-total-${y}`)).toHaveText(paidText);
  await wp.getByRole('button', { name: /को मिला/ }).first().click();
  await expect(wp.getByText(/एडवांस काटा/)).toBeVisible();

  // Owner cancels the link → phone #1 sees the closed message on next load.
  await page.goto('/workers'); await page.getByText('Rafiq').first().click();
  await page.getByTestId('cancel-link').click();
  await expect(page.getByText(/लिंक बंद कर दिया/)).toBeVisible();
  await wp.reload();
  await expect(wp.getByText(/यह लिंक बंद हो गया है/)).toBeVisible();
  await phone.close(); await phone2.close();
});
