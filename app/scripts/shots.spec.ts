import { test, expect, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, process.env.SHOTS_DIR ?? '../../docs/screenshots/m12/now');
const SEED = resolve(HERE, '../../server/seed-demo.mjs');
const WIDTHS = (process.env.SHOTS_WIDTHS ?? '390,768,1280,1440').split(',').map(Number);
const ROUTES = (process.env.SHOTS_ROUTES ?? '').split(',').filter(Boolean);

async function loginAs(page: Page, name: string, pin: string) {
  await page.getByRole('button', { name }).click();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('screenshots', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const seed = execSync(`node ${SEED}`, { env: { ...process.env, BASE: 'http://localhost:8797' } }).toString();
  const { unitId, unitKey } = JSON.parse(seed.slice(seed.indexOf('{'), seed.indexOf('}') + 1));
  const report: Record<string, unknown>[] = [];

  for (const width of WIDTHS) {
    const height = width < 600 ? 844 : width < 1100 ? 1024 : 900;
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 1100 });
    const theme = process.env.SHOTS_THEME; const collapsed = process.env.SHOTS_COLLAPSED === '1';
    if (theme || collapsed) await ctx.addInitScript(([th, c]) => { if (th) localStorage.setItem('bunkar.theme', th as string); if (c) localStorage.setItem('bunkar.nav.collapsed', '1'); }, [theme ?? '', collapsed] as const);
    const prefix = `${process.env.SHOTS_PREFIX ?? ''}${width}`;
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/setup');
    await page.getByRole('radio', { name: /मौजूदा यूनिट से जुड़ें/ }).click();
    await page.getByLabel(/यूनिट कोड/).fill(unitId); await page.getByLabel(/यूनिट चाबी/).fill(unitKey);
    await page.getByRole('button', { name: /^जुड़ें$/ }).click();
    await expect(page.getByRole('button', { name: 'Ramesh (Owner)' })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${OUT}/${prefix}-login.png` });
    await loginAs(page, 'Ramesh (Owner)', '1234');
    await expect(page.getByText('सिंक हो गया')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);

    // Resolve detail routes from the data.
    await page.goto('/workers'); await page.waitForTimeout(400);
    const workerHref = await page.evaluate(async () => {
      const req = indexedDB.open('bunkar-mvp');
      const dbx: IDBDatabase = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
      const all: { type: string; payload: { entityId?: string } }[] = await new Promise((res) => { const g = dbx.transaction('records').objectStore('records').getAll(); g.onsuccess = () => res(g.result); });
      const pick = (t: string) => all.find((r) => r.type === t)?.payload.entityId ?? '';
      return { worker: pick('worker'), item: pick('item'), order: pick('order') };
    });
    const month = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 7);
    const routes: [string, string][] = [
      ['home', '/'], ['attendance', '/attendance'], ['workers', '/workers'], ['worker', `/workers/${workerHref.worker}`],
      ['worker-new', '/workers/new'], ['wages', '/wages'], ['wage-pay', `/wages/${month}/${workerHref.worker}`], ['advance-new', '/advances/new'],
      ['stock', '/stock'], ['item', `/stock/${workerHref.item}`], ['stock-in', '/stock/move/in'], ['orders', '/orders'],
      ['order', `/orders/${workerHref.order}`], ['order-new', '/orders/new'], ['buyers', '/buyers'], ['month', '/month'],
      ['log', '/log'], ['settings', '/settings'], ['more', '/more'],
    ];
    for (const [name, path] of routes) {
      if (ROUTES.length && !ROUTES.includes(name)) continue;
      await page.goto(path); await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const main = document.querySelector('main');
        const r = main?.getBoundingClientRect();
        return { scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth, mainW: Math.round(r?.width ?? 0), mainX: Math.round(r?.x ?? 0) };
      });
      report.push({ width, name, ...m, overflow: m.scrollW > m.clientW + 1 });
      await page.screenshot({ path: `${OUT}/${prefix}-${name}.png`, fullPage: true });
    }
    report.push({ width, pageErrors: errors });
    await ctx.close();
  }
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
});
