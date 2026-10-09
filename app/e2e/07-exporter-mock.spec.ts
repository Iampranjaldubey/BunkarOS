// Bunkar OS — E2E 07: A2 static exporter status mock (SPEC-013).
// The /o/:orderId page must be driven by the REAL seeded order (listOrders /
// listPieces), not a hardcoded fixture: it shows the seeded exporter, design,
// size (8'0" × 10'0"), piece count (12), finished/on-loom counts, avg % woven,
// an est. dispatch, the live board legend (17/3/3/1/0), latest check-in photos
// via PhotoThumb, the J2 consent note and the 'Demo mock' badge. An unknown
// order shows a friendly not-found that never echoes the raw id.
import { test, expect } from '@playwright/test';
import { APP, createUnitAndLogin, loadDemo, forceEnglish, resetLocal, projection } from './fixtures';

test.describe('07 exporter mock (A2)', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('reads the real seeded EX-118 order and the live board legend', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Exporter Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await forceEnglish(page);

    // Cross-check what the projection emits for EX-118 (12 pieces, 8'0"×10'0",
    // Sharma Exports, Kashan 14) — the page must mirror this, not a fixture.
    const proj = await projection<{ orderNo: string; exporter: string; design: string; count: number }>(
      page,
      "(() => { const o = proj.listOrders(recs).find(x => x.orderNo === 'EX-118'); return { orderNo: o.orderNo, exporter: o.exporter, design: o.design, count: o.pieces.length }; })()",
    );
    expect(proj.exporter).toBe('Sharma Exports');
    expect(proj.design).toBe('Kashan 14');
    expect(proj.count).toBe(12);

    await page.goto(`${APP}/o/EX-118`);

    // Demo mock badge + seeded header values (NOT the old Obeetee/Ziegler mock).
    await expect(page.getByText('Demo mock').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'EX-118' })).toBeVisible();
    await expect(page.getByText('Sharma Exports')).toBeVisible();
    await expect(page.getByText('Kashan 14')).toBeVisible();
    await expect(page.getByText(/8'0" × 10'0"/)).toBeVisible();
    await expect(page.getByText('Obeetee Exports')).toHaveCount(0);
    await expect(page.getByText('Ziegler 1842')).toHaveCount(0);

    // 12 pieces listed (one row per seeded piece), piece 01..12 present.
    await expect(page.getByText('EX-118/01').first()).toBeVisible();
    await expect(page.getByText('EX-118/12').first()).toBeVisible();

    // Board legend == live board source of truth (17 / 3 / 3 / 1 no_wool / 0 free).
    await expect(page.getByTestId('legend-on_track')).toHaveText('17');
    await expect(page.getByTestId('legend-slow')).toHaveText('3');
    await expect(page.getByTestId('legend-idle')).toHaveText('3');
    await expect(page.getByTestId('legend-no_wool')).toHaveText('1');
    await expect(page.getByTestId('legend-free')).toHaveText('0');

    // Est. dispatch rendered as a human date (projected from pace), e.g. "9 October 2026".
    await expect(page.getByTestId('est-dispatch')).toHaveText(/\d{1,2}\s+[A-Z][a-z]+\s+\d{4}/);

    // J2 consent note present.
    await expect(page.getByText(/consent/i)).toBeVisible();

    await resetLocal(page);
  });

  test('an unknown order shows a friendly not-found and does not echo the raw id', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Exporter Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await forceEnglish(page);

    const bogus = 'ZZ-999-DROP-TABLE';
    await page.goto(`${APP}/o/${bogus}`);
    await expect(page.getByText(/not found/i)).toBeVisible();
    // The raw id must NOT be reflected back to the viewer.
    await expect(page.getByText(bogus)).toHaveCount(0);

    await resetLocal(page);
  });
});
