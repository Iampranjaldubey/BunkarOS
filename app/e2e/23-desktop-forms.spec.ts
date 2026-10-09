// SPEC-019 — Desktop & tablet forms (desktop project, 1440x900, DPR 1).
// Runs the PRD bazaar demo on EX-118/03 (same steps as 03-demo-loop) and
// asserts the lg+ live-summary rail (data-testid="bazaar-summary") fills in with
// the exact demo numbers at the right steps and sits to the RIGHT of the step
// content. Then verifies the Settings two-column card grid and the centered
// add-user dialog. The phone layout is covered by the mobile project.
import { test, expect } from '@playwright/test';
import { APP, createUnitAndLogin, forceEnglish, loadDemo, resetLocal, uploadPhoto, projection } from './fixtures';

const PIECE = 'EX-118/03';

test.describe('23 desktop forms', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('bazaar wizard: live-summary rail fills with demo numbers and sits to the right', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Desk Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await forceEnglish(page);

    // Precondition: demo seeds exactly one 12.000 kg issue to EX-118/03.
    const before = await projection<{ issuedG: number; returnedG: number }>(page, "proj.pieceYarn(recs, 'EX-118/03')");
    expect(before).toEqual({ issuedG: 12_000, returnedG: 0 });

    // --- Issue the SECOND 12.000 kg to EX-118/03 (loom 07). ---
    await page.goto(`${APP}/yarn/issue`);
    await page.getByRole('option', { name: /\b07\b/ }).first().click();
    await page.getByRole('option', { name: new RegExp(PIECE) }).first().click();
    await page.getByLabel('Shade (colour)').fill('Red');
    await page.getByLabel('Lot number').fill('L-214');
    await page.getByLabel('Weight', { exact: true }).fill('12');
    await page.getByTestId('yarn-issue-save').click();
    await page.getByRole('button', { name: 'Issue yarn' }).last().click();
    await page.waitForURL(/\/yarn$/);

    // --- Return 1.100 kg (Red · L-214). ---
    await page.goto(`${APP}/yarn/return`);
    await page.getByRole('option', { name: /\b07\b/ }).first().click();
    await page.getByLabel('Shade / lot').selectOption({ index: 1 });
    await page.getByLabel('Weight', { exact: true }).fill('1.100');
    await page.getByRole('button', { name: 'Return yarn' }).first().click();
    await page.getByRole('button', { name: 'Return yarn' }).last().click();
    await page.waitForURL(/\/yarn$/);

    const afterYarn = await projection<{ issuedG: number; returnedG: number }>(page, "proj.pieceYarn(recs, 'EX-118/03')");
    expect(afterYarn).toEqual({ issuedG: 24_000, returnedG: 1_100 });

    // --- Bazaar wizard on EX-118/03. ---
    await page.goto(`${APP}/bazaar/new`);
    const summary = page.getByTestId('bazaar-summary');

    // The summary rail is visible on desktop from the start.
    await expect(summary).toBeVisible();

    // Step 0 — pick the piece; summary now names the carpet.
    await page.getByRole('option', { name: new RegExp(PIECE) }).first().click();
    await expect(summary).toContainText(PIECE);
    await page.getByRole('button', { name: /Next|आगे/ }).click();

    // Step 1 — measure: width 9'11" (length prefilled 8'0"), carpet 21.600 kg.
    await page.getByLabel('ft', { exact: true }).nth(1).fill('9');
    await page.getByLabel('in', { exact: true }).nth(1).fill('11');
    await expect(page.getByTestId('bazaar-area-value')).toContainText('79.33');
    // The summary rail mirrors the area.
    await expect(summary).toContainText('79.33');
    await page.getByLabel('Carpet weight', { exact: true }).fill('21.600');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2 — tauli: short 0.613 kg; summary shows it too.
    await expect(page.getByTestId('tauli-short')).toContainText('0.613');
    await expect(page.getByTestId('summary-short')).toContainText('0.613');
    await page.getByRole('button', { name: 'Less wool returned' }).click();
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3 — wage: gross ₹3,014.54; add a ₹60 deduction (photo); recover ₹1,000.
    await expect(page.getByTestId('bazaar-gross')).toContainText('3,014.54');
    await expect(page.getByTestId('summary-gross')).toContainText('3,014.54');
    await page.getByRole('button', { name: 'Add deduction' }).click();
    await page.getByLabel(/^Reason/).first().fill('Thread short');
    await page.getByLabel(/^Amount/).first().fill('60');
    await uploadPhoto(page);
    await page.getByLabel('Peshgi recovery', { exact: true }).first().fill('1000');
    await expect(page.getByTestId('bazaar-net')).toContainText('1,954.54');
    // Summary rail: net ₹1,954.54 and paid ₹1,955 (half-up rounding).
    await expect(page.getByTestId('summary-net')).toContainText('1,954.54');
    await expect(page.getByTestId('summary-paid')).toContainText('1,955');

    // --- Position: the summary rail sits to the RIGHT of the step content. ---
    const stepBox = await page.getByTestId('bazaar-gross').boundingBox();
    const sumBox = await summary.boundingBox();
    expect(stepBox).not.toBeNull();
    expect(sumBox).not.toBeNull();
    if (stepBox && sumBox) {
      // The summary's left edge is to the right of the step content's left edge,
      // and the two columns do not overlap horizontally.
      expect(sumBox.x).toBeGreaterThan(stepBox.x);
      expect(sumBox.x).toBeGreaterThanOrEqual(stepBox.x + stepBox.width - 2);
    }

    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4 — payment split: pay the whole ₹1,955 via UPI.
    await page.getByLabel('Cash', { exact: true }).first().fill('0');
    await page.getByLabel('UPI', { exact: true }).first().fill('1955');
    // Summary payment lines now show the cash/UPI split.
    await expect(summary).toContainText('1,955');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 5 — save.
    await page.getByTestId('bazaar-save').click();
    await page.getByRole('button', { name: 'Confirm bazaar' }).last().click();
    await page.waitForURL(/\/bazaar\/[0-9a-f-]+$/i);

    // The saved record carries the exact demo numbers.
    const b = await projection<Record<string, number>>(
      page,
      "(() => { const bz = recs.filter(x=>x.type==='bazaar').map(x=>x.payload).find(p=>p.pieceId==='EX-118/03'); return { area: bz.areaSqft, gross: bz.grossPaise, net: bz.netPaise, paid: bz.paidPaise, short: bz.tauli.shortG }; })()",
    );
    expect(b.area).toBe(79.33);
    expect(b.gross).toBe(301454);
    expect(b.net).toBe(195454);
    expect(b.paid).toBe(195500);
    expect(b.short).toBe(613);

    // --- Bazaar receipt (detail) uses the two-column layout: receipt in the
    // main column, the slip-share action in the aside to the right. ---
    const share = page.getByTestId('slip-share');
    await expect(share).toBeVisible();
    // The receipt (main column) and the slip actions (aside) sit side by side.
    const mainBox = await page.getByTestId('page-main').first().boundingBox();
    const asideBox = await page.getByTestId('page-aside').first().boundingBox();
    const shareBox = await share.boundingBox();
    expect(mainBox && asideBox && shareBox).toBeTruthy();
    expect(asideBox!.x).toBeGreaterThanOrEqual(mainBox!.x + mainBox!.width - 1);
    expect(shareBox!.x).toBeGreaterThanOrEqual(asideBox!.x);
    await expect(page.getByTestId('page-main').first()).toContainText('1,955');
  });

  test('settings: two-column card grid and a centered add-user dialog', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Desk Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await page.goto('/settings');

    // --- Cards form two columns: the first two section cards are side by side. ---
    const cards = page.locator('#main section > div > .shadow-card');
    await expect(cards.first()).toBeVisible();
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (first && second) {
      // Two columns ⇒ the second card starts to the right of the first and they
      // share (roughly) the same top edge.
      expect(second.x).toBeGreaterThan(first.x + first.width - 2);
      expect(Math.abs(second.y - first.y)).toBeLessThan(40);
    }

    // --- Add-user dialog opens centered (not a bottom sheet). ---
    await page.getByRole('button', { name: /Add a user|Add user|यूज़र जोड़ें/i }).first().click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const vp = page.viewportSize()!;
    expect(box).not.toBeNull();
    if (box) {
      const dialogCenter = box.x + box.width / 2;
      expect(Math.abs(dialogCenter - vp.width / 2)).toBeLessThan(vp.width * 0.25);
      // Not pinned to the bottom edge.
      expect(box.y + box.height).toBeLessThan(vp.height - 20);
      expect(box.y).toBeGreaterThan(10);
    }
  });
});
