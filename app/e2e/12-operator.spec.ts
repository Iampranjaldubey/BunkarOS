import { test, expect, type Browser, type Page } from '@playwright/test';
import { setupAndLogin, loginAs, attRow, markRadio, istToday, setPerms, addStaffLogin, localRecords, synced, settled } from './fixtures';

/** Another device joins the unit with the code and key from Settings, then an operator logs in on it. */
async function operatorDevice(browser: Browser, owner: Page, unitId: string, unitKey: string, name: string, pin: string) {
  const ctx = await browser.newContext({ baseURL: 'http://localhost:5174', viewport: owner.viewportSize()! });
  const op = await ctx.newPage();
  await op.goto('/setup');
  await op.getByRole('radio', { name: 'मौजूदा यूनिट से जुड़ें' }).click();
  await op.getByLabel(/यूनिट कोड/).fill(unitId);
  await op.getByLabel(/यूनिट चाबी/).fill(unitKey);
  await op.getByRole('button', { name: 'जुड़ें', exact: true }).click();
  await expect(op).toHaveURL(/\/login/);
  await loginAs(op, name, pin);
  await synced(op);
  return { ctx, op };
}
/** Reload until the operator device has pulled the owner's latest setting and the check passes. */
async function afterSync(op: Page, check: () => Promise<void>) {
  await expect(async () => { await op.reload(); await synced(op); await check(); }).toPass({ timeout: 40_000, intervals: [500, 1000, 2000] });
}
const orderPrices = async (p: Page) => (await localRecords(p)).filter((r) => r.type === 'order').map((r) => r.payload.pricePaise);

/** SPEC-M13 AC1, AC3–AC9 and SPEC-M14 AC3 (UI); the server refusals are in server/test/permissions.test.mjs. */
test('operator toggles: defaults, export, edit past, add entries, see prices removed by the server with a resync', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const today = istToday();
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  await setupAndLogin(page);
  await addStaffLogin(page, 'Munshi Ji', '2222');
  await addStaffLogin(page, 'Munshi Do', '3333');
  // A worker, the owner's mark for yesterday, and an order with a price (20 × ₹5,000).
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Rafiq');
  await page.getByLabel(/^फ़ोन/).fill('9876501234');
  await page.getByLabel(/महीने की तनख्वाह/).fill('12000');
  await page.getByLabel(/कब से काम पर/).fill(yesterday.slice(0, 8) + '01');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/workers$/);
  await page.goto('/attendance');
  await page.getByLabel('तारीख').fill(yesterday);
  await markRadio(attRow(page, 'Rafiq'), 'P').click();
  await expect(markRadio(attRow(page, 'Rafiq'), 'P')).toHaveAttribute('aria-checked', 'true');
  await page.goto('/orders/new');
  await page.getByRole('button', { name: /नया खरीदार/ }).click();
  await page.getByRole('dialog').getByLabel(/नाम \/ फर्म/).fill('Sharma Exports');
  await page.getByRole('dialog').getByRole('button', { name: /सेव करें/ }).click();
  await expect(page.getByLabel(/^खरीदार/)).toHaveValue(/.+/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel(/डिज़ाइन/).fill('Kashan');
  await page.getByLabel(/साइज़/).fill('8x10');
  await page.getByLabel(/कितने कालीन/).fill('20');
  await page.getByLabel(/भाव/).fill('5000');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/(?!new)[^/]+$/);
  const orderUrl = new URL(page.url()).pathname;
  await page.goto('/settings');
  const unitId = (await page.getByTestId('join-unit-id').textContent())!.trim();
  const unitKey = (await page.getByTestId('join-unit-key').textContent())!.trim();
  await synced(page);

  const { ctx, op } = await operatorDevice(browser, page, unitId, unitKey, 'Munshi Ji', '2222');

  // AC1 defaults: the operator marks attendance and sees prices; no export; no undo on another user's past entry.
  await op.goto(orderUrl);
  await expect(op.getByText('बाकी रकम')).toBeVisible();
  expect(await orderPrices(op)).toEqual([500_000]);
  await op.goto('/month');
  await expect(op.getByTestId('export-xlsx')).toHaveCount(0);           // AC9 export off
  await op.goto('/log');
  await expect(op.getByText(/Rafiq · हाज़िर/)).toBeVisible();
  await expect(op.getByRole('button', { name: 'एंट्री वापस लें' })).toHaveCount(0); // AC4 edit past off
  // SPEC-M14 AC3: no "बदलें" on the pay page for an operator.
  await op.goto('/wages');
  await op.getByText('Rafiq').first().click();
  await expect(op.getByTestId('wage-lines')).toBeVisible();
  await expect(op.getByTestId('wage-lines').getByRole('button', { name: /बदलें/ })).toHaveCount(0);

  // AC9: export on → the operator gets the export button and a real file.
  await setPerms(page, { export: true });
  await synced(page);
  await afterSync(op, async () => { await op.goto('/month'); await expect(op.getByTestId('export-xlsx')).toBeVisible({ timeout: 2000 }); });
  const [download] = await Promise.all([op.waitForEvent('download'), op.getByTestId('export-xlsx').click()]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);

  // AC4: edit past on → the operator undoes the owner's entry from yesterday with a reason → accepted by the server.
  await setPerms(page, { editPast: true });
  await synced(page);
  await afterSync(op, async () => { await op.goto('/log'); await expect(op.getByRole('button', { name: 'एंट्री वापस लें' }).first()).toBeVisible({ timeout: 2000 }); });
  await op.getByRole('button', { name: 'एंट्री वापस लें' }).first().click();
  await op.getByRole('dialog').getByLabel(/वजह/).fill('ग़लत दिन');
  await op.getByRole('dialog').getByRole('button', { name: 'वापस लें', exact: true }).click();
  expect(await settled(op)).toEqual([]);
  expect((await localRecords(op)).filter((r) => r.type === 'reversal').map((r) => r.sync)).toEqual(['synced']);
  await setPerms(page, { editPast: false });

  // AC3: add entries off → attendance is read-only and the quick buttons are gone.
  await setPerms(page, { addEntries: false });
  await synced(page);
  await afterSync(op, async () => { await op.goto('/attendance'); await expect(markRadio(attRow(op, 'Rafiq'), 'P')).toBeDisabled({ timeout: 2000 }); });
  await op.goto('/');
  await expect(op.getByRole('button', { name: 'हाज़िरी', exact: true })).toHaveCount(0);
  await op.goto('/orders/new');
  await expect(op.getByRole('button', { name: 'सेव करें', exact: true })).toHaveCount(0);
  await setPerms(page, { addEntries: true });
  await synced(page);
  await afterSync(op, async () => { await op.goto('/attendance'); await expect(markRadio(attRow(op, 'Rafiq'), 'P')).toBeEnabled({ timeout: 2000 }); });

  // AC7: the operator writes an entry offline; the owner hides prices; back online the phone resyncs without prices
  // and the pending entry is still pushed.
  await ctx.setOffline(true);
  await markRadio(attRow(op, 'Rafiq'), 'H').click();
  await expect(markRadio(attRow(op, 'Rafiq'), 'H')).toHaveAttribute('aria-checked', 'true');
  expect((await localRecords(op)).filter((r) => r.sync === 'pending').map((r) => r.type)).toEqual(['attendance']);
  await setPerms(page, { seePrices: false });
  await synced(page);
  await ctx.setOffline(false);
  await afterSync(op, async () => { expect(await orderPrices(op)).toEqual([undefined]); });
  expect(await settled(op)).toEqual([]);
  const after = await localRecords(op);
  expect(after.filter((r) => r.type === 'attendance' && r.payload.status === 'half').map((r) => r.sync)).toEqual(['synced']);
  expect(after.filter((r) => r.type === 'order').every((r) => !('pricePaise' in r.payload))).toBe(true);
  // AC5: no price field, column or amount pending on the operator's screens.
  await op.goto(orderUrl);
  await expect(op.getByTestId('order-pending')).toBeVisible();
  await expect(op.getByText('बाकी रकम')).toHaveCount(0);
  await op.goto('/month');
  await expect(op.getByTestId('month-amount-pending')).toHaveCount(0);
  // AC6: the operator changes the due date → the server keeps the stored price.
  await op.goto(orderUrl + '/edit');
  await expect(op.getByLabel(/भाव/)).toHaveCount(0);
  await op.getByLabel(/कब तक देना/).fill(today);
  await op.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(op).toHaveURL(new RegExp(`${orderUrl}$`));
  expect(await settled(op)).toEqual([]);
  // AC8: a second operator gets the same view; the owner still sees every price.
  const second = await operatorDevice(browser, page, unitId, unitKey, 'Munshi Do', '3333');
  expect(await orderPrices(second.op)).toEqual([undefined, undefined]);
  await second.ctx.close();
  await afterSync(page, async () => {
    const ownerOrders = (await localRecords(page)).filter((r) => r.type === 'order');
    expect(ownerOrders.map((r) => r.payload.pricePaise)).toEqual([500_000, 500_000]); // the operator's edit kept the stored price
    expect(ownerOrders.some((r) => r.payload.dueDate === today)).toBe(true);
  });
  await page.goto(orderUrl);
  await expect(page.getByText('बाकी रकम')).toBeVisible();

  // AC7: prices shown again → the next sync brings them back.
  await setPerms(page, { seePrices: true });
  await synced(page);
  await afterSync(op, async () => { expect(await orderPrices(op)).toEqual([500_000, 500_000]); });
  await ctx.close();
});
