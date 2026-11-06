import { expect, type Locator, type Page } from '@playwright/test';
import zlib from 'node:zlib';
import type { Browser } from '@playwright/test';

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

// SPEC-M18: organisations are created by a founder; the owner opens the invite link and sets a PIN.
export const FOUNDER = { name: 'shubham', key: 'e2e-admin-key-123' };
export async function founderToken(page: Page): Promise<string> {
  const r = await page.request.post('/api/admin/login', { data: FOUNDER });
  return (await r.json()).token;
}
/** A founder creates an organisation through the API; returns its id and the invite secrets. */
export async function createOrg(page: Page, o: { unit: string; name: string; phone: string; industry?: string; modules?: Record<string, boolean> }) {
  const token = await founderToken(page);
  const r = await page.request.post('/api/admin/orgs', { headers: { Authorization: `Bearer ${token}` }, data: { name: o.unit, industry: o.industry ?? 'carpet', lang: 'hi', ownerName: o.name, ownerPhone: o.phone, ...(o.modules ? { modules: o.modules } : {}) } });
  expect(r.status()).toBe(201);
  const b = await r.json();
  return { unitId: b.unitId as string, invite: b.invite as { token: string; code: string }, adminToken: token };
}
/** The owner opens the invite link, sets the PIN and lands on the login screen. */
export async function openInvite(page: Page, inviteToken: string, pin: string) {
  await page.goto(`/join/${inviteToken}`);
  await page.getByLabel(/4 अंक का पिन बनाएँ|Create a 4-digit PIN/).fill(pin);
  await page.getByLabel(/पिन दोबारा भरें|Re-enter PIN/).fill(pin);
  await page.getByRole('button', { name: /यूनिट खोलें|Open unit/ }).click();
  await expect(page).toHaveURL(/\/login/);
}
/** Create an organisation (founder API + invite link) and log in as its owner. */
export async function setupAndLogin(page: Page, o: { unit: string; name: string; phone: string; pin: string; industry?: string } = OWNER) {
  const org = await createOrg(page, o);
  await openInvite(page, org.invite.token, o.pin);
  await loginAs(page, o.name, o.pin);
  return org;
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

// ---------- shared by e2e 12 and 13 ----------
/** Another device joins the unit with the code and key from Settings, then an operator logs in on it. */
export async function operatorDevice(browser: Browser, owner: Page, unitId: string, unitKey: string, name: string, pin: string) {
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
export async function afterSync(op: Page, check: () => Promise<void>) {
  await expect(async () => { await op.reload(); await synced(op); await check(); }).toPass({ timeout: 40_000, intervals: [500, 1000, 2000] });
}

/** Photos in this browser's IndexedDB (id, sync state, size, dimensions). */
export async function localPhotos(page: Page): Promise<{ id: string; sync: string; mime: string; w: number; h: number; size: number }[]> {
  return page.evaluate(async () => {
    const req = indexedDB.open('bunkar-mvp');
    const db: IDBDatabase = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    const rows: { id: string; sync: string; mime: string; w: number; h: number; blob: Blob }[] = await new Promise((res) => { const g = db.transaction('photos').objectStore('photos').getAll(); g.onsuccess = () => res(g.result); });
    return rows.map((r) => ({ id: r.id, sync: r.sync, mime: r.mime, w: r.w, h: r.h, size: r.blob.size }));
  });
}
/** Write a record straight into this phone's IndexedDB as a pending entry of the logged-in user (the sync client pushes it). */
export async function injectPending(page: Page, type: string, payload: Record<string, unknown>, day?: string): Promise<string> {
  return page.evaluate(async ({ type, payload, day }) => {
    const s = JSON.parse(localStorage.getItem('bunkar.session')!);
    const at = new Date().toISOString();
    const rec = { id: crypto.randomUUID(), type, unitId: s.unitId, payload, by: s.userId, role: s.role, device: localStorage.getItem('bunkar.device') ?? 'e2e', at, day: day ?? new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10), sync: 'pending' };
    const req = indexedDB.open('bunkar-mvp');
    const db: IDBDatabase = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    await new Promise<void>((res, rej) => { const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').put(rec); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    return rec.id;
  }, { type, payload, day });
}
/** A large noisy PNG (worst case for JPEG size): proves the app shrinks every photo to ≤ 1280 px and ≤ 300 KB. */
export function noisyPng(width = 2400, height = 1600): Buffer {
  const crc32 = (zlib as unknown as { crc32: (b: Buffer) => number }).crc32;
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let seed = 12345;
  for (let y = 0; y < height; y++) {
    const o = y * (width * 3 + 1); raw[o] = 0;
    for (let i = 1; i <= width * 3; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; raw[o + i] = seed >> 16; }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 1 })), chunk('IEND', Buffer.alloc(0))]);
}
