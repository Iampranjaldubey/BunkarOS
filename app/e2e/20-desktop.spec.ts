import { test, expect } from '@playwright/test';
import { setupAndLogin } from './fixtures';

const ROUTES = ['/', '/attendance', '/workers', '/workers/new', '/advances/new', '/wages', '/stock', '/stock/new', '/stock/move/in', '/stock/move/adjust', '/orders', '/orders/new', '/buyers', '/month', '/log', '/settings', '/more'];

test('desktop: side menu, no bottom bar, no horizontal scroll at 1024/1440/1920 in three languages, content clear of the menu, no page errors', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await setupAndLogin(page);
  await expect(page.getByTestId('side-nav')).toBeVisible();
  await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
  for (const width of [1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const lang of ['हिंदी', 'Hinglish', 'EN']) {
      await page.getByRole('banner').getByRole('radio', { name: lang }).click();
      for (const path of ROUTES) {
        await page.goto(path);
        await expect(page.locator('main')).toBeVisible();
        const m = await page.evaluate(() => {
          const nav = document.querySelector('[data-testid="side-nav"]')?.getBoundingClientRect();
          const main = document.querySelector('main')!.getBoundingClientRect();
          return { over: document.documentElement.scrollWidth > document.documentElement.clientWidth, navRight: nav?.right ?? 0, mainLeft: main.left };
        });
        expect(m.over, `horizontal overflow on ${path} at ${width} (${lang})`).toBe(false);
        expect(m.mainLeft, `content under the side menu on ${path} at ${width}`).toBeGreaterThanOrEqual(m.navRight - 1);
      }
    }
  }
  await page.getByRole('banner').getByRole('radio', { name: 'हिंदी' }).click();
  expect(errors, 'page errors').toEqual([]);
});

test('desktop: workers list renders as a table; wage sheet as a table', async ({ page }) => {
  await setupAndLogin(page);
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Rafiq'); await page.getByLabel(/महीने की तनख्वाह/).fill('12000');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click(); await expect(page).toHaveURL(/\/workers$/);
  await expect(page.getByTestId('data-table')).toBeVisible();
  await page.goto('/wages');
  await expect(page.getByTestId('data-table')).toContainText('Rafiq');
});

/** SPEC-M12 quality bar: every control in the side menu, top bar and page is at least 44 px tall (and wide) on desktop. */
test('desktop: interactive targets are at least 44 × 44 px', async ({ page }) => {
  test.setTimeout(120_000);
  await setupAndLogin(page);
  await page.goto('/workers/new');
  await page.getByLabel(/^नाम/).fill('Rafiq'); await page.getByLabel(/महीने की तनख्वाह/).fill('12000');
  await page.getByRole('button', { name: 'सेव करें', exact: true }).click(); await expect(page).toHaveURL(/\/workers$/);
  const small: string[] = [];
  for (const path of ROUTES) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await page.waitForTimeout(150);
    const found = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('button, a[href], select, input:not([type=hidden]):not([type=file]), textarea, [role=radio], [tabindex="0"]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || el.classList.contains('visually-hidden')) continue; // not rendered / skip link (shown on focus)
        if (el.closest('p, li > p, td > p')?.contains(el) && el.tagName === 'A' && r.height < 44 && el.closest('p')) continue; // inline text link inside a sentence
        if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) {
          const lr = el.closest('label')!.getBoundingClientRect(); if (lr.height >= 44) continue; // the label is the target
        }
        if (r.height < 43.5 || r.width < 43.5) out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      return out;
    });
    for (const f of found) small.push(`${path}: ${f}`);
  }
  expect(small, 'targets smaller than 44 px').toEqual([]);
});
