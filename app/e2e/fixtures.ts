import { expect, type Page } from '@playwright/test';

export const OWNER = { unit: 'Ideal Carpet', name: 'Shubham', phone: '9876543210', pin: '1234' };

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
