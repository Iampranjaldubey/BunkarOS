import { expect, type Locator, type Page } from '@playwright/test';

export const OWNER = { unit: 'Ideal Carpet', name: 'Shubham', phone: '9876543210', pin: '1234' };

/** True in the desktop project (side menu, tables) — SPEC-M12 breakpoint is 1024 px. */
export const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

// Attendance works the same on phone cards and the desktop table (SPEC-M12).
export const MARK = { P: 'हाज़िर', H: 'आधा दिन', A: 'ग़ैरहाज़िर' } as const;
export type Mark = keyof typeof MARK;
export const attList = (page: Page) => page.getByTestId(/^attendance-(list|table)$/);
export const attRow = (page: Page, name: string) => page.locator('[data-att-row]').filter({ hasText: name });
export const markRadio = (row: Locator, st: Mark) => row.getByRole('radio', { name: `${MARK[st]} (${st})`, exact: true });

/** Today in Asia/Kolkata (the app's business day), independent of the machine's time zone. */
export function istToday(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
/** The previous IST month as 'YYYY-MM' and a day helper for it (always fully in the past). */
export function istPrevMonth(): { month: string; d: (n: number) => string } {
  const [y, m] = istToday().split('-').map(Number);
  const py = m === 1 ? y - 1 : y; const pm = m === 1 ? 12 : m - 1;
  const month = `${py}-${String(pm).padStart(2, '0')}`;
  return { month, d: (n: number) => `${month}-${String(n).padStart(2, '0')}` };
}

/** Create a unit on /setup and log in as the owner. */
export async function setupAndLogin(page: Page, o = OWNER) {
  await page.goto('/setup');
  await page.getByLabel(/यूनिट \/ दुकान का नाम|Unit \/ shop name/).fill(o.unit);
  await page.getByLabel(/मालिक का नाम|Owner name/).fill(o.name);
  await page.getByLabel(/मालिक का फ़ोन|Owner phone/).fill(o.phone);
  await page.getByLabel(/4 अंक का पिन बनाएँ|Create a 4-digit PIN/).fill(o.pin);
  await page.getByLabel(/पिन दोबारा भरें|Re-enter PIN/).fill(o.pin);
  await page.getByRole('button', { name: /यूनिट बनाएँ|Create unit/ }).click();
  await expect(page).toHaveURL(/\/login/);
  await loginAs(page, o.name, o.pin);
}

export async function loginAs(page: Page, name: string, pin: string) {
  await page.getByRole('button', { name }).click();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Log out: side menu on desktop, the "More" page on phones. */
export async function logout(page: Page) {
  if (isDesktop(page)) await page.getByTestId('side-logout').click();
  else { await page.goto('/more'); await page.getByRole('button', { name: /लॉग आउट/ }).click(); }
  await expect(page).toHaveURL(/\/login/);
}

/** Owner changes a monthly worker's salary from the worker page (SPEC-M16 AC1: a paid month must not move). */
export async function setSalary(page: Page, name: string, rupees: number) {
  await page.goto('/workers');
  await page.getByText(name).first().click();
  await expect(page).toHaveURL(/\/workers\/[^/]+$/);
  await page.getByRole('button', { name: /बदलें/ }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByLabel(/महीने की तनख्वाह/).fill(String(rupees));
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click();
  await expect(page).toHaveURL(/\/workers\/[^/]+$/);
}

// ---------- SPEC-M13 / M14 helpers ----------
/** Owner turns overtime on or off in Settings → पगार के नियम (D-001). */
export async function setOvertime(page: Page, on: boolean) {
  await page.goto('/settings');
  const sw = page.getByTestId('overtime-switch');
  if ((await sw.getAttribute('aria-checked')) !== String(on)) {
    await sw.click();
    await page.getByTestId('save-rules').click();
  }
  await expect(page.getByTestId('overtime-switch')).toHaveAttribute('aria-checked', String(on));
  await expect(page.getByTestId('save-rules')).toBeDisabled();
}
export const POLICY = { none: 'कोई नहीं', sundays: 'रविवार', sundays_and_holidays: 'रविवार और छुट्टियाँ' } as const;
/** Owner picks the off-day policy (D-002). */
export async function setPolicy(page: Page, policy: keyof typeof POLICY) {
  await page.goto('/settings');
  const radio = page.locator(`input[name=offDayPolicy][value=${policy}]`);
  if (!(await radio.isChecked())) { await radio.check(); await page.getByTestId('save-rules').click(); }
  await expect(page.locator(`input[name=offDayPolicy][value=${policy}]`)).toBeChecked();
  await expect(page.getByTestId('save-rules')).toBeDisabled(); // saved: nothing left to save
}
/** Owner switches operator toggles (D-005); only the given keys change. */
export async function setPerms(page: Page, perms: Partial<Record<'addEntries' | 'editPast' | 'seePrices' | 'export', boolean>>) {
  await page.goto('/settings');
  let changed = false;
  for (const [k, v] of Object.entries(perms)) {
    const sw = page.getByTestId(`perm-${k}`);
    if ((await sw.getAttribute('aria-checked')) !== String(v)) { await sw.click(); changed = true; }
  }
  if (changed) await page.getByTestId('save-perms').click();
  for (const [k, v] of Object.entries(perms)) await expect(page.getByTestId(`perm-${k}`)).toHaveAttribute('aria-checked', String(v));
  await expect(page.getByTestId('save-perms')).toBeDisabled();
}
/** Owner adds a staff (operator) login in Settings. */
export async function addStaffLogin(page: Page, name: string, pin: string) {
  await page.goto('/settings');
  await page.getByRole('button', { name: /स्टाफ़ जोड़ें/ }).click();
  await page.getByRole('dialog').getByLabel(/^नाम/).fill(name);
  await page.getByRole('dialog').getByLabel(/4 अंक का पिन/).fill(pin);
  await page.getByRole('dialog').getByRole('button', { name: /सेव करें/ }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}
/** Records in this browser's IndexedDB (to check what reached the phone). */
export async function localRecords(page: Page): Promise<{ id: string; type: string; sync: string; payload: Record<string, unknown> }[]> {
  return page.evaluate(async () => {
    const req = indexedDB.open('bunkar-mvp');
    const db: IDBDatabase = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    return new Promise((res) => { const g = db.transaction('records').objectStore('records').getAll(); g.onsuccess = () => res(g.result); });
  });
}
/** Wait until the header badge says everything is synced. */
export async function synced(page: Page) { await expect(page.getByText('सिंक हो गया').first()).toBeVisible({ timeout: 20_000 }); }
/** Wait until no record is pending on this device; return the refused ones as "type reason" strings (expect []). */
export async function settled(page: Page): Promise<string[]> {
  await expect.poll(async () => (await localRecords(page)).filter((r) => r.sync === 'pending').length, { timeout: 25_000 }).toBe(0);
  return (await localRecords(page)).filter((r) => r.sync === 'rejected').map((r) => `${r.type} ${(r as { rejectReason?: string }).rejectReason ?? ''}`);
}
