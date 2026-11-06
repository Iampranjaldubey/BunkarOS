import { test, expect, type Page } from '@playwright/test';
import { FOUNDER, createOrg, openInvite, loginAs, isDesktop, synced } from './fixtures';

const UNIT_ROUTES = ['/', '/attendance', '/workers', '/workers/new', '/advances/new', '/wages', '/stock', '/stock/new', '/catalogue', '/catalogue/new', '/stock/move/in', '/orders', '/orders/new', '/buyers', '/month', '/log', '/settings', '/more'];
const LANGS = ['हिंदी', 'Hinglish', 'EN'];

/** Every interactive element is at least `min` px in both directions (same rules as e2e 20). */
async function smallTargets(page: Page, min: number): Promise<string[]> {
  return page.evaluate((m) => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('button, a[href], select, input:not([type=hidden]):not([type=file]), textarea, [role=radio], [role=switch], [role=tab], [tabindex="0"]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.classList.contains('visually-hidden')) continue;
      if (el.tagName === 'A' && el.closest('p') && r.height < m) continue; // inline text link in a sentence
      if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label') && el.closest('label')!.getBoundingClientRect().height >= m) continue;
      if (r.height < m - 0.5 || r.width < m - 0.5) out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
    return out;
  }, min);
}
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
/** A translation key shown instead of words, e.g. "m18.paused" or "cat.title". */
const rawKeys = (page: Page) => page.evaluate(() => (document.body.innerText.match(/\b(?:m17|m18|join|reject|cat|nav|wp|wj|att|wages|stock|order|worker|settings|home|month|log|sync|setup|login|common|action|valid)\.[a-zA-Z][\w.]*\b/g) ?? []).filter((k) => !/\.(?:com|in|org)\b/.test(k)));
const widths = (page: Page) => (isDesktop(page) ? [1024, 1440, 1920] : [390, 768]);
const minTarget = (page: Page) => (isDesktop(page) ? 44 : 48);

test('founders console: no overflow, targets big enough, no page errors (all widths)', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(String(e)));
  const org = await createOrg(page, { unit: 'Sweep Bags', name: 'Owner', phone: '9811144444', industry: 'bags' });
  await page.goto('/admin');
  await page.getByLabel('Name').fill(FOUNDER.name); await page.getByLabel('Admin key').fill(FOUNDER.key);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible();
  const small: string[] = [];
  for (const width of widths(page)) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/admin', '/admin/new', '/admin/industries', `/admin/units/${org.unitId}`]) {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForTimeout(200);
      expect(await overflow(page), `overflow on ${path} at ${width}`).toBe(false);
      for (const f of await smallTargets(page, minTarget(page))) small.push(`${path}@${width}: ${f}`);
    }
    for (const tab of ['modules', 'people', 'changes']) {
      await page.getByTestId(`tab-${tab}`).click();
      expect(await overflow(page), `overflow on org ${tab} at ${width}`).toBe(false);
      for (const f of await smallTargets(page, minTarget(page))) small.push(`org ${tab}@${width}: ${f}`);
    }
  }
  expect(small, 'targets too small').toEqual([]);
  expect(errors, 'page errors').toEqual([]);
});

test('invite screens: /setup and /join in three languages, no overflow, no raw keys, targets big enough', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(String(e)));
  const org = await createOrg(page, { unit: 'Join Sweep', name: 'Owner', phone: '9811155555', industry: 'bags' });
  const small: string[] = [];
  for (const width of widths(page)) {
    await page.setViewportSize({ width, height: isDesktop(page) ? 900 : 844 });
    for (const lang of LANGS) {
      for (const path of ['/setup', `/join/${org.invite.token}`]) {
        await page.goto(path);
        await page.getByRole('radio', { name: lang }).first().click();
        await expect(page.locator('main')).toBeVisible();
        await page.waitForTimeout(150);
        expect(await overflow(page), `overflow on ${path} at ${width} (${lang})`).toBe(false);
        expect(await rawKeys(page), `raw keys on ${path} (${lang})`).toEqual([]);
        for (const f of await smallTargets(page, minTarget(page))) small.push(`${path}@${width} ${lang}: ${f}`);
      }
    }
  }
  await page.getByRole('radio', { name: 'हिंदी' }).first().click();
  expect(small, 'targets too small').toEqual([]);
  expect(errors, 'page errors').toEqual([]);
});

test('bags organisation: every unit screen in three languages has no overflow, no raw keys and no carpet word', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(String(e)));
  const org = await createOrg(page, { unit: 'Bags Sweep', name: 'Owner', phone: '9811166666', industry: 'bags' });
  await openInvite(page, org.invite.token, '1234');
  await loginAs(page, 'Owner', '1234');
  await synced(page);
  const carpetWords = /कालीन|बुनकर|ऊन|[Cc]arpet|[Ww]eaver|[Ww]ool|Kaleen/;
  for (const width of widths(page).slice(0, 2)) {
    await page.setViewportSize({ width, height: 900 });
    for (const lang of LANGS) {
      await page.getByRole('banner').getByRole('radio', { name: lang }).click();
      for (const path of UNIT_ROUTES) {
        await page.goto(path);
        await expect(page.locator('main')).toBeVisible();
        await page.waitForTimeout(150);
        expect(await overflow(page), `overflow on ${path} at ${width} (${lang})`).toBe(false);
        expect(await rawKeys(page), `raw keys on ${path} (${lang})`).toEqual([]);
        const text = await page.locator('main').innerText();
        expect(text.match(carpetWords)?.[0] ?? null, `carpet word on ${path} (${lang})`).toBeNull();
      }
    }
  }
  await page.getByRole('banner').getByRole('radio', { name: 'हिंदी' }).click();
  expect(errors, 'page errors').toEqual([]);
});
