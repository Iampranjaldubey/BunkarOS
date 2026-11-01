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
