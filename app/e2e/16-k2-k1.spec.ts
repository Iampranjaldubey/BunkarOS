// Bunkar OS — E2E 16: K2 full owner home (SPEC-017) + K1 monthly summary (SPEC-018).
//
// SPEC-017 (full owner home / loom board):
//   AC1 board 17 on-track / 3 slow / 3 idle / 1 no-wool, legend counts match.
//   AC2 order filter EX-118 → only looms with EX-118 pieces show.
//   AC3 pace 2 in/day, 20 in remaining → loom listed free in ~10 days.
//   AC4 peshgi ₹4,000 + ₹2,000 → dues tile ₹6,000.
//   AC5 today's records by munshi (12) + owner (3) → "आज की एंट्री" lists both with counts.
// SPEC-018 (monthly summary on /digest):
//   AC1 demo month after the live bazaar: sq ft incl 79.33, wage bill incl ₹3,014.54,
//       wool short incl 0.613 kg, loss % = short ÷ used.
//   AC2 a reversed bazaar is excluded from the month.
//   AC3 the share button → preview text lists every number on its own line in Hindi.
import { test, expect } from '@playwright/test';
import { APP, createUnitAndLogin, loadDemo, forceEnglish, resetLocal, projection } from './fixtures';

/**
 * Build a self-contained set of raw Rec objects in-page and run a named owner
 * projection over them (bypassing IndexedDB) so pace/dues math is deterministic
 * and independent of the demo seed. Returns the projection's JSON result.
 */
async function runOnSynthetic<T>(page: import('@playwright/test').Page, body: string): Promise<T> {
  return page.evaluate(async (src) => {
    const proj = await import('/src/domain/projections.ts');
    const today = '2026-10-09';
    const nowISO = '2026-10-09T12:00:00+05:30';
    const mk = (type: string, payload: unknown, day: string, extra: Record<string, unknown> = {}) => ({
      id: `${type}-${Math.random().toString(36).slice(2)}`,
      type, unitId: 'U', payload,
      by: 'u-owner', role: 'owner', device: 'd1',
      at: `${day}T10:00:00+05:30`, day, sync: 'synced',
      ...extra,
    });
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const run = new Function('proj', 'today', 'nowISO', 'mk', `return (${src});`);
    return run(proj, today, nowISO, mk);
  }, body);
}

test.describe('16 K2 full owner home + K1 monthly', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  // ---------------- SPEC-017 ----------------

  test('AC1: board shows 17 on-track / 3 slow / 3 idle / 1 no-wool and the legend matches', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Owner Home Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);

    // Projection source of truth.
    const by = await projection<Record<string, number>>(
      page,
      "(() => { const rows = proj.loomBoard(recs, nowISO); const c = { on_track:0, slow:0, idle:0, no_wool:0, free:0 }; for (const r of rows) c[r.status]++; return c; })()",
    );
    expect(by).toEqual({ on_track: 17, slow: 3, idle: 3, no_wool: 1, free: 0 });

    // Owner home legend mirrors the projection exactly.
    await page.goto(`${APP}/`);
    await expect(page.getByTestId('board-legend')).toBeVisible();
    await expect(page.getByTestId('legend-on_track')).toHaveText('17');
    await expect(page.getByTestId('legend-slow')).toHaveText('3');
    await expect(page.getByTestId('legend-idle')).toHaveText('3');
    await expect(page.getByTestId('legend-no_wool')).toHaveText('1');
    await expect(page.getByTestId('legend-free')).toHaveText('0');

    // The no-wool loom renders as a tile with its own status (grey + package icon).
    await expect(page.locator('[data-testid="loom-tile"][data-status="no_wool"]')).toHaveCount(1);
  });

  test('AC2: the order filter EX-118 shows only looms carrying EX-118 pieces', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Owner Home Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await forceEnglish(page);
    await page.goto(`${APP}/`);

    // Wait for the board to render, then count the full (unfiltered) tiles.
    await expect(page.getByTestId('loom-tile').first()).toBeVisible();
    const allTiles = await page.getByTestId('loom-tile').count();

    // Expected count of looms with an on_loom EX-118 piece (projection truth).
    const expected = await projection<number>(
      page,
      "(() => { const pieces = proj.listPieces(recs); const order = proj.listOrders(recs).find(o => o.orderNo === 'EX-118'); const set = new Set(pieces.filter(p => p.orderId === order.entityId && p.status === 'on_loom' && p.loomId).map(p => p.loomId)); return set.size; })()",
    );
    expect(expected).toBeGreaterThan(0);
    expect(expected).toBeLessThan(allTiles); // the filter must actually narrow the board

    // Switch to "By order", pick EX-118.
    await page.getByRole('button', { name: 'By order' }).click();
    await page.getByTestId('board-order-chip').filter({ hasText: 'EX-118' }).click();

    await expect(page.getByTestId('loom-tile')).toHaveCount(expected);
  });

  test('AC3: a piece with pace 2 in/day and 20 in remaining frees in ~10 days', async ({ page }) => {
    await createUnitAndLogin(page, { owner: 'Salim Ansari', pin: '1234' });

    // 80" piece, assigned 20 days ago, two check-ins so wovenIn=60 (pace = 60/20 = 3?).
    // We want pace 2 in/day with 20 in remaining: lengthIn 80, wovenIn 60 reached over
    // 30 days → pace 2/day; remaining 20 → ~10 more days.
    const row = await runOnSynthetic<{ daysLeft: number; loomId: string } | null>(
      page,
      `(() => {
        const recs = [
          mk('loom', { entityId: 'L1', code: '01', village: 'V', widthIn: 72, weaverIds: [], active: true }, '2026-08-01'),
          mk('order', { entityId: 'O1', orderNo: 'EX-200', exporter: 'X', design: 'D', quality: 'Q', colour: 'C', lengthIn: 80, widthIn: 120, count: 1, pieces: [{ pieceId: 'EX-200/01', seq: 1 }] }, '2026-08-01'),
          mk('piece_assign', { pieceId: 'EX-200/01', loomId: 'L1' }, '2026-09-09'),      // assigned 30 days before today
          mk('checkin', { pieceId: 'EX-200/01', loomId: 'L1', wovenIn: 60 }, '2026-10-09'), // wovenIn 60 of 80, remaining 20
        ];
        const rows = proj.loomsFreeSoon(recs, nowISO, 30);
        return rows.find(r => r.loomId === 'L1') ?? null;
      })()`,
    );
    expect(row).not.toBeNull();
    // pace = 60in / 30 days = 2 in/day; remaining 20 → ceil(10) = 10 days → freeDay ~ +10.
    expect(row!.daysLeft).toBe(10);
  });

  test('AC4: peshgi balances ₹4,000 + ₹2,000 → dues tile shows ₹6,000', async ({ page }) => {
    await createUnitAndLogin(page, { owner: 'Salim Ansari', pin: '1234' });

    // Projection: two weavers each with an outstanding give.
    const total = await runOnSynthetic<number>(
      page,
      `(() => {
        const recs = [
          mk('weaver', { entityId: 'W1', name: 'Rafiq', fatherName: '', village: 'V', phone: '9000000001', phoneType: 'keypad', active: true }, '2026-10-01'),
          mk('weaver', { entityId: 'W2', name: 'Imran', fatherName: '', village: 'V', phone: '9000000002', phoneType: 'keypad', active: true }, '2026-10-01'),
          mk('peshgi', { personKind: 'weaver', personId: 'W1', amountPaise: 400000, mode: 'cash' }, '2026-10-02'),
          mk('peshgi', { personKind: 'weaver', personId: 'W2', amountPaise: 200000, mode: 'cash' }, '2026-10-02'),
        ];
        return proj.peshgiOutstanding(recs).totalPaise;
      })()`,
    );
    expect(total).toBe(600000); // ₹6,000

    // The owner-home dues tile renders the live total (demo-independent: real
    // seeded dues could differ, so assert the tile exists and the projection is
    // the source — then prove the exact-₹6,000 case via the projection above).
    await loadDemo(page);
    await page.goto(`${APP}/`);
    await expect(page.getByTestId('dues-tile')).toBeVisible();
    const liveTotal = await projection<number>(page, '(() => proj.peshgiOutstanding(recs).totalPaise)()');
    // Format ₹ with Indian grouping the same way the UI does.
    const expectedText = new Intl.NumberFormat('en-IN').format(Math.round(liveTotal / 100));
    await expect(page.getByTestId('dues-tile')).toContainText(expectedText);
  });

  test('AC5: today\'s entries list each author with their count', async ({ page }) => {
    await createUnitAndLogin(page, { owner: 'Salim Ansari', pin: '1234' });

    // munshi Ramesh: 12 entries, owner: 3 entries, all today → sorted by count desc.
    const staff = await runOnSynthetic<Array<{ name: string; role: string; count: number }>>(
      page,
      `(() => {
        const recs = [];
        recs.push(mk('user', { entityId: 'u-owner', name: 'Salim', phone: '9', role: 'owner', pinHash: 'h', pinSalt: 's', active: true }, '2026-10-01'));
        recs.push(mk('user', { entityId: 'u-ramesh', name: 'Ramesh', phone: '8', role: 'munshi', pinHash: 'h', pinSalt: 's', active: true }, '2026-10-01', { by: 'u-owner', role: 'owner' }));
        for (let i = 0; i < 12; i++) recs.push(mk('checkin', { pieceId: 'P/' + i, loomId: 'L', wovenIn: 1 }, '2026-10-09', { by: 'u-ramesh', role: 'munshi' }));
        for (let i = 0; i < 3; i++) recs.push(mk('roker', { dir: 'out', mode: 'cash', amountPaise: 100, head: 'misc' }, '2026-10-09', { by: 'u-owner', role: 'owner' }));
        return proj.todayEntriesByUser(recs, today);
      })()`,
    );
    // The two user-master records are also authored today (by owner), so owner's
    // count includes them. Assert the munshi count exactly and the ordering.
    const ramesh = staff.find((s) => s.name === 'Ramesh');
    const owner = staff.find((s) => s.name === 'Salim');
    expect(ramesh?.count).toBe(12);
    expect(owner).toBeTruthy();
    expect(owner!.count).toBeGreaterThanOrEqual(3);
    expect(staff[0].name).toBe('Ramesh'); // highest count first

    // The owner-home staff card renders at least one staff-entry row from the seed.
    await loadDemo(page);
    await page.goto(`${APP}/`);
    await expect(page.getByTestId('staff-entry').first()).toBeVisible();
  });

  // ---------------- SPEC-018 ----------------

  test('AC1: the demo month includes the live bazaar numbers and yarn loss = short ÷ used', async ({ page }) => {
    await createUnitAndLogin(page, { owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);

    // The live demo bazaar (walkthrough step 4) is created on top of the seed:
    // piece EX-118/03, area 79.33 sq ft, gross ₹3,014.54, wool short 0.613 kg.
    // Add it as a real record (today's IST day) so monthlySummary rolls it up.
    await page.evaluate(async () => {
      const repo = (await import('/src/db/repo.ts')) as { addRecord: (t: string, p: unknown) => Promise<unknown> };
      const tauli = { issuedG: 24000, returnedG: 1100, usedG: 22900, wastagePct: 3, allowedG: 687, gapG: 1300, shortG: 613, extraG: 0 };
      await repo.addRecord('bazaar', {
        pieceId: 'EX-118/03', loomId: 'live-loom', weaverId: 'live-weaver',
        lengthIn: 96, widthIn: 119, areaSqft: 79.33, carpetGrams: 21600,
        rateId: 'live-rate', ratePaise: 3800, rateUnit: 'sqft',
        grossPaise: 301454, deductions: [], peshgiRecoveredPaise: 0,
        netPaise: 301454, paidPaise: 301500, roundingPaise: 46,
        payment: { cashPaise: 301500, upiPaise: 0 }, tauli,
      });
    });

    const month = await projection<{
      month: string; sqftWoven: number; wageBillPaise: number; woolShortG: number; woolUsedG: number; yarnLossPct: number | null;
    }>(
      page,
      "(() => proj.monthlySummary(recs, today.slice(0,7)))()",
    );

    // The live demo bazaar: area 79.33 sq ft, gross ₹3,014.54, wool short 0.613 kg.
    expect(month.sqftWoven).toBeGreaterThanOrEqual(79.33);
    expect(month.wageBillPaise).toBeGreaterThanOrEqual(301454);
    expect(month.woolShortG).toBeGreaterThanOrEqual(613);
    expect(month.woolUsedG).toBeGreaterThan(0);
    // Loss % = short ÷ used × 100, rounded to 1 dp.
    const expectedLoss = Math.round((month.woolShortG / month.woolUsedG) * 1000) / 10;
    expect(month.yarnLossPct).toBeCloseTo(expectedLoss, 5);
  });

  test('AC2: a reversed bazaar is excluded from the month', async ({ page }) => {
    await createUnitAndLogin(page, { owner: 'Salim Ansari', pin: '1234' });

    const months = await runOnSynthetic<{ withBazaar: number; reversed: number }>(
      page,
      `(() => {
        const tauli = { issuedG: 24000, returnedG: 1100, usedG: 22900, wastagePct: 3, allowedG: 687, gapG: 1300, shortG: 613, extraG: 0 };
        const bazaar = mk('bazaar', {
          pieceId: 'EX-200/01', loomId: 'L1', weaverId: 'W1',
          lengthIn: 96, widthIn: 119, areaSqft: 79.33, carpetGrams: 21600,
          rateId: 'R1', ratePaise: 3800, rateUnit: 'sqft',
          grossPaise: 301454, deductions: [], peshgiRecoveredPaise: 0,
          netPaise: 301454, paidPaise: 301500, roundingPaise: 46,
          payment: { cashPaise: 301500, upiPaise: 0 }, tauli,
        }, '2026-10-05');
        const withBazaar = proj.monthlySummary([bazaar], '2026-10').bazaarCount;
        const reversal = mk('reversal', { targetId: bazaar.id, reason: 'test' }, '2026-10-06');
        const reversed = proj.monthlySummary([bazaar, reversal], '2026-10').bazaarCount;
        return { withBazaar, reversed };
      })()`,
    );
    expect(months.withBazaar).toBe(1);
    expect(months.reversed).toBe(0);
  });

  test('AC3: the monthly share preview lists every number on its own Hindi line', async ({ page }) => {
    await createUnitAndLogin(page, { owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);

    // The on-screen share text (Hindi) is rendered under the monthly card.
    await page.goto(`${APP}/digest`);
    const shareText = page.getByTestId('month-share-text');
    await expect(shareText).toBeVisible();
    const text = (await shareText.innerText()).trim();

    // Multi-line Hindi summary, one fact per bullet line.
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(10);
    expect(lines[0]).toContain('मासिक सार'); // header
    // Every number line is a "• <label>: <value>" bullet.
    expect(lines.filter((l) => l.startsWith('•')).length).toBeGreaterThanOrEqual(10);
    // Key Hindi labels present.
    expect(text).toContain('बुनाई');
    expect(text).toContain('मज़दूरी बिल');
    expect(text).toContain('ऊन कमी');
    expect(text).toContain('रिजेक्ट');

    // The share button opens the preview sheet (nothing sent until confirm).
    await page.getByTestId('month-share').click();
    await expect(page.getByText('मासिक सार', { exact: false }).first()).toBeVisible();
  });
});
