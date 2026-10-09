// Bunkar OS — E2E 21 (desktop project, 1440×900): owner-facing screens use the width.
// SPEC-019 AC1/AC2/AC6 for home, digest, exporter page, weaver slip page and login.
import { test, expect, type Page } from '@playwright/test';
import { APP, createUnitAndLogin, loadDemo, forceEnglish, resetLocal } from './fixtures';

async function noHorizontalScroll(page: Page): Promise<void> {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.scrollingElement!.scrollWidth, iw: window.innerWidth }));
  expect(sw, 'page must not scroll sideways').toBeLessThanOrEqual(iw);
}

test.describe('21 desktop owner screens', () => {
  test.afterEach(async ({ page }) => { await resetLocal(page); });

  test('owner home: two columns, loom board with ≥ 8 tiles per row, no phone bottom bar', async ({ page }) => {
    await createUnitAndLogin(page);
    await loadDemo(page);
    await forceEnglish(page);
    await page.goto(`${APP}/`);
    const tiles = page.getByTestId('loom-tile');
    await expect(tiles).toHaveCount(24, { timeout: 30_000 });

    // ≥ 8 tiles share the first row.
    const ys = await tiles.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    const firstRow = ys.filter((y) => y === ys[0]).length;
    expect(firstRow).toBeGreaterThanOrEqual(8);

    // Two columns: the side column (today's numbers, orders at risk) sits right of the board.
    const lastTileInRow = tiles.nth(firstRow - 1);
    const boardRight = await lastTileInRow.evaluate((el) => el.getBoundingClientRect().right);
    const risk = await page.getByTestId('risk-order').first().boundingBox();
    const today = await page.getByText("Today's summary").first().boundingBox();
    expect(risk && today).toBeTruthy();
    expect(risk!.x).toBeGreaterThan(boardRight);
    expect(today!.x).toBeGreaterThan(boardRight);
    expect(today!.y).toBeLessThan(400); // side column starts at the top, level with the board

    // Desktop chrome only: the phone bottom bar is not in the page at all.
    await expect(page.getByTestId('side-nav')).toBeVisible();
    await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
    // Every loom name appears once (no hidden phone copy of the page).
    await expect(page.getByText('Orders at risk', { exact: false })).toHaveCount(1);
    await noHorizontalScroll(page);
  });

  test('digest: today and this month side by side', async ({ page }) => {
    await createUnitAndLogin(page);
    await loadDemo(page);
    await forceEnglish(page);
    await page.goto(`${APP}/digest`);
    const month = page.getByTestId('month-summary');
    await expect(month).toBeVisible({ timeout: 20_000 });
    const share = await page.getByTestId('digest-share').boundingBox();
    const monthBox = await month.boundingBox();
    expect(share && monthBox).toBeTruthy();
    // The month card is in the right-hand column, level with today's column.
    expect(monthBox!.x).toBeGreaterThan(share!.x + 100);
    await noHorizontalScroll(page);
  });

  test('exporter page: wide table of all 12 EX-118 pieces', async ({ page }) => {
    await createUnitAndLogin(page);
    await loadDemo(page);
    await forceEnglish(page);
    await page.goto(`${APP}/o/EX-118`);
    const table = page.getByTestId('data-table');
    await expect(table).toBeVisible({ timeout: 20_000 });
    await expect(table.locator('thead th').first()).toBeVisible();
    await expect(table.locator('tbody tr')).toHaveCount(12);
    const w = await table.evaluate((el) => el.getBoundingClientRect().width);
    expect(w).toBeGreaterThan(700);
    await noHorizontalScroll(page);
  });

  test('weaver slip page stays a centered, readable card (≤ 680 px)', async ({ page, browser }) => {
    await createUnitAndLogin(page);
    await loadDemo(page);
    const token = await page.evaluate(async () => {
      const sync = (await import('/src/sync/client.ts')) as { syncNow: () => Promise<void> };
      const dbMod = (await import('/src/db/db.ts')) as {
        db: { records: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ type: string; sync: string; payload: { kind?: string; token?: string } }>> } } } };
      };
      const raw = localStorage.getItem('bunkar.session') ?? sessionStorage.getItem('bunkar.session') ?? 'null';
      const sess = JSON.parse(raw) as { unitId: string };
      for (let i = 0; i < 20; i++) {
        await sync.syncNow();
        const recs = await dbMod.db.records.where('unitId').equals(sess.unitId).toArray();
        const slip = recs.find((r) => r.type === 'slip' && r.payload.kind === 'bazaar' && r.sync === 'synced');
        if (slip) return slip.payload.token as string;
        await new Promise((r) => setTimeout(r, 300));
      }
      return '';
    });
    expect(token.length).toBeGreaterThanOrEqual(22);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pub = await ctx.newPage();
    await pub.goto(`${APP}/s/${token}`);
    const card = pub.getByTestId('slip-card');
    await expect(pub.getByTestId('slip-agree')).toBeVisible({ timeout: 15_000 }); // slip loaded
    const box = await card.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(680);
    expect(Math.abs(box!.x + box!.width / 2 - 720)).toBeLessThan(40); // centered in a 1440 px window
    await expect(pub.getByTestId('slip-agree')).toBeVisible();
    await ctx.close();
  });

  test('login screen: centered card on desktop', async ({ page }) => {
    await createUnitAndLogin(page);
    await page.evaluate(() => { localStorage.removeItem('bunkar.session'); sessionStorage.removeItem('bunkar.session'); });
    await page.goto(`${APP}/login`);
    const pick = page.getByRole('button', { name: /Salim Ansari/ }).first();
    await expect(pick).toBeVisible({ timeout: 15_000 });
    const box = await pick.boundingBox();
    expect(Math.abs(box!.x + box!.width / 2 - 720)).toBeLessThan(260);
    await noHorizontalScroll(page);
  });
});
