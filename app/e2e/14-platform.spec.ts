import { test, expect, type Page } from '@playwright/test';
import { FOUNDER, createOrg, openInvite, loginAs, localRecords, synced, isDesktop, attRow, markRadio } from './fixtures';

const setOrg = async (page: Page, adminToken: string, unitId: string, body: Record<string, unknown>) => {
  const r = await page.request.post(`/api/admin/units/${unitId}/org`, { headers: { Authorization: `Bearer ${adminToken}` }, data: body });
  expect(r.status()).toBe(200);
};
/** Is a destination in the menu? Phones: the "More" page; desktop: the side menu. Waits for the menu to render. */
const expectMenu = async (page: Page, name: string, present: boolean) => {
  if (!isDesktop(page)) { await page.goto('/more'); await expect(page.getByRole('heading', { name: 'और' })).toBeVisible(); }
  const menu = isDesktop(page) ? page.getByTestId('side-nav') : page.locator('main');
  await expect(menu.getByRole('link', { name, exact: true })).toHaveCount(present ? 1 : 0);
};

/** AC7: a founder creates a bags organisation in the console; the owner joins with the link and sees the bags pack. */
test('founder creates a bags organisation in 3 steps; owner joins by link; bag words, jobs, drawn bag and stitch line', async ({ page, browser }) => {
  const admin = await browser.newContext({ baseURL: 'http://localhost:5174', viewport: { width: 1280, height: 860 } });
  const a = await admin.newPage();
  await a.goto('/admin');
  await a.getByLabel('Name').fill(FOUNDER.name); await a.getByLabel('Admin key').fill(FOUNDER.key);
  await a.getByRole('button', { name: 'Sign in' }).click();
  await a.getByTestId('new-org').click();
  const orgName = `Kanpur Bags ${Date.now().toString(36)}`; // the e2e database is shared by both projects
  await a.getByLabel(/^Business name/).fill(orgName);
  await a.getByLabel(/^Industry/).selectOption('bags');
  await a.getByTestId('wizard-next').click();
  await expect(a.getByTestId('step-modules')).toContainText('Bags');
  for (const m of ['attendance', 'wages', 'advances', 'stock', 'orders', 'catalogue']) await expect(a.getByTestId(`module-${m}`)).toHaveAttribute('aria-checked', 'true');
  await a.getByTestId('wizard-next').click();
  await a.getByLabel(/^Owner's name/).fill('Imran'); await a.getByLabel(/^Owner's mobile/).fill('9811100000');
  await a.getByTestId('wizard-create').click();
  const link = (await a.getByTestId('invite-link').textContent())!.trim();
  expect(link).toMatch(/\/join\/[A-Za-z0-9_-]{20,}$/);
  await expect(a.getByTestId('invite-code-shown')).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // The owner opens the link on their phone.
  await openInvite(page, link.split('/join/')[1], '4321');
  await expect(page.getByTestId('stitch-line').first()).toBeVisible(); // bags signature on the login card
  await loginAs(page, 'Imran', '4321');
  await synced(page);
  await expectMenu(page, 'बैग कैटलॉग', true);
  await page.goto('/workers/new');
  const jobSelect = page.getByLabel('काम', { exact: true });
  await expect(jobSelect.locator('option').first()).toBeAttached();
  const jobs = await jobSelect.locator('option').allTextContents();
  expect(jobs).toEqual(['कटिंग', 'सिलाई', 'फिनिशिंग', 'पैकिंग', 'हेल्पर', 'अन्य']);
  await page.goto('/stock/new');
  await expect(page.getByLabel('इकाई')).toHaveValue('metre');
  await page.goto('/catalogue/new');
  await expect(page.getByRole('heading', { name: 'नया बैग' })).toBeVisible();
  await page.getByLabel(/^मॉडल/).fill('School backpack');
  await page.getByLabel(/^लंबाई/).fill('30'); await page.getByLabel(/^चौड़ाई/).fill('42');
  await expect(page.getByRole('radio', { name: 'सेमी' })).toHaveAttribute('aria-checked', 'true');
  await page.getByLabel(/^कितने बैग/).fill('5');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await page.goto('/catalogue');
  await expect(page.getByRole('heading', { name: 'बैग कैटलॉग' })).toBeVisible();
  await expect(page.getByTestId('carpet-card').first().getByTestId('bag-art')).toBeVisible();
  // The founders' list shows the organisation as active with its industry.
  await a.goto('/admin');
  await expect(a.getByTestId('admin-units').locator('tr').filter({ hasText: orgName })).toContainText('Active');
  await admin.close();
});

/** AC8: the founder turns the catalogue off; it disappears and an entry made offline before is refused with a sentence. */
test('module off: menu and screen gone, offline entry refused with a readable reason, data back when on', async ({ page, context }) => {
  const org = await createOrg(page, { unit: 'Off Test', name: 'Owner', phone: '9811122222' });
  await openInvite(page, org.invite.token, '1234');
  await loginAs(page, 'Owner', '1234');
  await synced(page);
  await expectMenu(page, 'कालीन कैटलॉग', true);
  await page.goto('/catalogue/new');
  await expect(page.getByLabel(/^डिज़ाइन/)).toBeVisible(); // the dev server has no service worker: load the form, then go offline
  await context.setOffline(true);
  await page.getByLabel(/^डिज़ाइन/).fill('Kashan'); await page.getByLabel(/^लंबाई/).fill('8'); await page.getByLabel(/^चौड़ाई/).fill('10'); await page.getByLabel(/^कितने कालीन/).fill('2');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect.poll(async () => (await localRecords(page)).filter((r) => r.type === 'carpet' && r.sync === 'pending').length).toBe(1);
  await setOrg(page, org.adminToken, org.unitId, { modules: { catalogue: false }, reason: 'not used by this unit' });
  await context.setOffline(false);
  await expect.poll(async () => (await localRecords(page)).filter((r) => r.type === 'carpet').map((r) => r.sync), { timeout: 25_000 }).toEqual(['rejected']);
  await page.goto('/log');
  await expect(page.getByTestId('reject-reason').first()).toHaveText('यह हिस्सा बंद है, एंट्री नहीं गई');
  await expectMenu(page, 'कालीन कैटलॉग', false);
  await page.goto('/catalogue');
  await expect(page.getByRole('heading', { name: 'यह हिस्सा बंद है' })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByTestId('modules-card')).toContainText('तैयार माल कैटलॉग');
  await setOrg(page, org.adminToken, org.unitId, { modules: { catalogue: true }, reason: 'back on' });
  await expect(async () => { await page.reload(); await synced(page); await expectMenu(page, 'कालीन कैटलॉग', true); }).toPass({ timeout: 30_000 });
});

/** AC9: pause → banner, no new entries, data visible; active again → normal. */
test('paused: banner, entry controls off, data still visible; active again restores entries', async ({ page }) => {
  const org = await createOrg(page, { unit: 'Pause Test', name: 'Owner', phone: '9811133333' });
  await openInvite(page, org.invite.token, '1234');
  await loginAs(page, 'Owner', '1234');
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Rafiq'); await page.getByLabel(/महीने की तनख्वाह/).fill('9000');
  await page.getByLabel(/कब से काम पर/).fill('2026-01-01'); // joined long before today, whatever the clock says
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click(); await expect(page).toHaveURL(/\/workers$/);
  await synced(page);
  await setOrg(page, org.adminToken, org.unitId, { status: 'paused', reason: 'trial ended' });
  await expect(async () => { await page.reload(); await synced(page); await expect(page.getByTestId('paused-banner')).toBeVisible({ timeout: 1_000 }); }).toPass({ timeout: 30_000 });
  await page.goto('/attendance');
  await expect(attRow(page, 'Rafiq')).toBeVisible();
  await expect(markRadio(attRow(page, 'Rafiq'), 'P')).toBeDisabled();
  await page.goto('/workers');
  await expect(page.getByText('Rafiq').first()).toBeVisible();
  await page.goto('/workers/new');
  await expect(page.getByRole('heading', { name: 'खाता रुका हुआ है' })).toBeVisible();
  await setOrg(page, org.adminToken, org.unitId, { status: 'active', reason: 'paid' });
  await expect(async () => { await page.reload(); await synced(page); await expect(page.getByTestId('paused-banner')).toHaveCount(0, { timeout: 1_000 }); }).toPass({ timeout: 30_000 });
  await page.goto('/attendance');
  await expect(markRadio(attRow(page, 'Rafiq'), 'P')).toBeEnabled();
});
