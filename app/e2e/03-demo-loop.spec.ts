// Bunkar OS — E2E 03: the PRD demo loop (C3/E2/E1/C5/O1/C8/K1/K2).
// Load the demo, issue the SECOND 12.000 kg to EX-118/03, return 1.100 kg, then
// run the bazaar wizard for 8'0"×9'11" with carpet 21.600 kg and assert the
// exact demo numbers: area 79.33, tauli short 0.613 (cause required), gross
// ₹3,014.54, deduction ₹60 (photo), peshgi recovery ₹1,000, net ₹1,954.54,
// paid ₹1,955. Then verify the slip preview, today's roker, and owner digest.
import { test, expect } from '@playwright/test';
import { APP, createUnitAndLogin, forceEnglish, loadDemo, resetLocal, uploadPhoto, projection } from './fixtures';

const PIECE = 'EX-118/03';

test.describe('03 demo loop', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('full bazaar loop produces the exact demo receipt and posts today', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Demo Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await forceEnglish(page);

    // Precondition: after the fix, the demo seeds EXACTLY one 12.000 kg issue to
    // EX-118/03 (issued 12000 g, returned 0). The live loop adds the second 12kg.
    const before = await projection<{ issuedG: number; returnedG: number }>(page, "proj.pieceYarn(recs, 'EX-118/03')");
    expect(before).toEqual({ issuedG: 12_000, returnedG: 0 });

    // --- Step 2: issue the SECOND 12.000 kg to EX-118/03 (loom 07). ---
    await page.goto(`${APP}/yarn/issue`);
    // Holder picker defaults to loom; pick loom 07 (code tile → role=option).
    await page.getByRole('option', { name: /\b07\b/ }).first().click();
    // Attach the piece EX-118/03 so the issue counts toward its wool.
    await page.getByRole('option', { name: new RegExp(PIECE) }).first().click();
    await page.getByLabel('Shade (colour)').fill('Red');
    await page.getByLabel('Lot number').fill('L-214');
    await page.getByLabel('Weight', { exact: true }).fill('12');
    await page.getByTestId('yarn-issue-save').click();
    await page.getByRole('button', { name: 'Issue yarn' }).last().click();
    await page.waitForURL(/\/yarn$/);

    // --- Step 3: return 1.100 kg (Red · L-214) first. ---
    await page.goto(`${APP}/yarn/return`);
    await page.getByRole('option', { name: /\b07\b/ }).first().click();
    // Pick the Red · L-214 balance from the shade/lot select (first real option).
    await page.getByLabel('Shade / lot').selectOption({ index: 1 });
    await page.getByLabel('Weight', { exact: true }).fill('1.100');
    await page.getByRole('button', { name: 'Return yarn' }).first().click();
    await page.getByRole('button', { name: 'Return yarn' }).last().click();
    await page.waitForURL(/\/yarn$/);

    // Confirm the piece now has used = 22.900 kg (24000 - 1100).
    const afterYarn = await projection<{ issuedG: number; returnedG: number }>(page, "proj.pieceYarn(recs, 'EX-118/03')");
    expect(afterYarn).toEqual({ issuedG: 24_000, returnedG: 1_100 });

    // --- Step 4: bazaar wizard on EX-118/03. ---
    await page.goto(`${APP}/bazaar/new`);
    // Step 0 — pick the piece.
    await page.getByRole('option', { name: new RegExp(PIECE) }).first().click();
    await page.getByRole('button', { name: /Next|आगे/ }).click();

    // Step 1 — measure: width → 9'11" (length prefilled 8'0"), carpet 21.600 kg.
    // The width FtInInput is the 2nd ft/in pair: set ft=9, in=11.
    await page.getByLabel('ft', { exact: true }).nth(1).fill('9');
    await page.getByLabel('in', { exact: true }).nth(1).fill('11');
    await expect(page.getByTestId('bazaar-area-value')).toContainText('79.33');
    await page.getByLabel('Carpet weight', { exact: true }).fill('21.600');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2 — tauli: short 0.613 kg, cause required + weaver ack.
    await expect(page.getByTestId('tauli-short')).toContainText('0.613');
    // Pick a cause chip and tick the acknowledgement.
    await page.getByRole('button', { name: 'Less wool returned' }).click();
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3 — wage: gross ₹3,014.54; add a ₹60 deduction with a photo; recover ₹1,000.
    await expect(page.getByTestId('bazaar-gross')).toContainText('3,014.54');
    await page.getByRole('button', { name: 'Add deduction' }).click();
    await page.getByLabel(/^Reason/).first().fill('Thread short');
    await page.getByLabel(/^Amount/).first().fill('60');
    await uploadPhoto(page); // deduction photo (mandatory, D4)
    // Recover ₹1,000 peshgi from the seeded ₹5,000 balance.
    await page.getByLabel('Peshgi recovery', { exact: true }).first().fill('1000');
    // Net = 3014.54 - 60 - 1000 = 1954.54.
    await expect(page.getByTestId('bazaar-net')).toContainText('1,954.54');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4 — payment split: pay the whole ₹1,955 via UPI (demo narrative), so
    // the cash roker closing is unaffected and stays ₹34,500. Cash defaults to
    // the full paid amount, so zero it and move the amount to UPI.
    await page.getByLabel('Cash', { exact: true }).first().fill('0');
    await page.getByLabel('UPI', { exact: true }).first().fill('1955');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 5 — review + save.
    await page.getByTestId('bazaar-save').click();
    await page.getByRole('button', { name: 'Confirm bazaar' }).last().click();

    // Landed on the bazaar detail page.
    await page.waitForURL(/\/bazaar\/[0-9a-f-]+$/i);

    // --- Assert the saved record carries the exact demo numbers. ---
    const b = await projection<Record<string, number>>(
      page,
      "(() => { const r = proj.recsOfType ? null : null; const bz = recs.filter(x=>x.type==='bazaar').map(x=>x.payload).find(p=>p.pieceId==='EX-118/03'); return { area: bz.areaSqft, gross: bz.grossPaise, net: bz.netPaise, paid: bz.paidPaise, rounding: bz.roundingPaise, ded: bz.deductions.reduce((s,d)=>s+d.amountPaise,0), peshgi: bz.peshgiRecoveredPaise, short: bz.tauli.shortG, cause: bz.tauli.cause ? 1 : 0, dedPhoto: bz.deductions.every(d=>d.photoId) ? 1 : 0 }; })()",
    );
    expect(b.area).toBe(79.33);
    expect(b.gross).toBe(301454);
    expect(b.ded).toBe(6000);
    expect(b.peshgi).toBe(100000);
    expect(b.net).toBe(195454);
    expect(b.paid).toBe(195500);
    expect(b.rounding).toBe(46);
    expect(b.short).toBe(613);
    expect(b.cause).toBe(1);
    expect(b.dedPhoto).toBe(1);

    // --- Slip share sheet shows recipient + full preview text. ---
    await page.getByTestId('slip-share').click();
    // The PreviewShareSheet names the recipient and previews the full slip text + link.
    await expect(page.getByText(/Rafiq Ansari/).first()).toBeVisible();
    await expect(page.getByText(new RegExp(PIECE)).first()).toBeVisible();
    await expect(page.getByText(/\/s\//).first()).toBeVisible();
    // Close the sheet.
    await page.keyboard.press('Escape').catch(() => {});

    // --- Today's roker: the demo bazaar shows as a UPI-out entry, the seeded
    // cash-out (Salim peshgi ₹2,000 + dyer ₹6,000) nets ₹8,000 out, so cash
    // closing = opening ₹42,500 − ₹8,000 = ₹34,500 (SPEC-011/012). ---
    const roker = await projection<{ opening: number; closing: number; hasBazaarUpi: boolean }>(
      page,
      "(() => { const rk = proj.rokerDay(recs, today); const hasBazaarUpi = rk.entries.some(e => /EX-118\\/03/.test(e.label) && e.mode === 'upi'); return { opening: rk.openingCash, closing: rk.closingCash, hasBazaarUpi }; })()",
    );
    expect(roker.opening).toBe(4_250_000);
    expect(roker.closing).toBe(3_450_000);
    expect(roker.hasBazaarUpi).toBe(true);

    // --- Owner home / digest reflect today's bazaar + UPI paid, and take
    // cash/UPI straight from the roker (so the digest and cash book agree).
    // Today's roker cash-out is Salim peshgi ₹2,000 + dyer ₹6,000 = ₹8,000
    // (800000 paise); the live bazaar is paid ₹1,955 via UPI (195500 paise).
    // Wool is still outside (23 looms hold issued yarn + the demo piece), and
    // EX-121 (due within 14 days) is flagged as an order at risk (PRD K1). ---
    const dg = await projection<{
      bazaarCount: number;
      cashPaidPaise: number;
      upiPaidPaise: number;
      woolOutsideG: number;
      ordersAtRisk: Array<{ orderNo: string }>;
    }>(page, 'proj.digest(recs, today, nowISO)');
    expect(dg.bazaarCount).toBe(1);
    expect(dg.cashPaidPaise).toBe(800000);
    expect(dg.upiPaidPaise).toBe(195500);
    expect(dg.woolOutsideG).toBeGreaterThan(0);
    expect(dg.ordersAtRisk.map((o) => o.orderNo)).toContain('EX-121');

    await resetLocal(page);
  });
});
