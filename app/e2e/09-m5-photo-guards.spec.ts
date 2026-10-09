// Bunkar OS — E2E 09: M5 high-risk photo guards (SPEC-002 AC-5, D4).
// Payments/advances strictly ABOVE the ₹2,000 threshold require a photo:
//  a) a bazaar whose net paid is > ₹2,000 cannot leave the payment step
//     without a photo (and can once a photo is attached).
//  b) a peshgi give of > ₹2,000 is blocked (no confirm, no save) until a photo
//     is attached.
import { test, expect } from '@playwright/test';
import { createUnitAndLogin, loadDemo, forceEnglish, resetLocal, uploadPhoto, projection } from './fixtures';

async function pickPiece(page: import('@playwright/test').Page, pieceId: string): Promise<void> {
  await page.getByRole('option', { name: new RegExp(pieceId.replace('/', '\\/')) }).first().click();
}

test.describe('09 M5 photo guards', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('a: a bazaar paid > ₹2,000 is blocked at payment without a photo', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'M5 Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await forceEnglish(page);

    // EX-118/03 gross is ₹3,014.54 at the measured 8'0"×9'11" (area 79.33). With
    // NO deduction and NO peshgi recovery the paid rounds to ₹3,015 — strictly
    // above the ₹2,000 threshold → a payment photo is required.
    await page.goto('/bazaar/new');
    await pickPiece(page, 'EX-118/03');
    await page.getByRole('button', { name: 'Next' }).click();
    // Measure: width → 9'11" (length prefilled 8'0"), carpet 21.600 kg.
    await page.getByLabel('ft', { exact: true }).nth(1).fill('9');
    await page.getByLabel('in', { exact: true }).nth(1).fill('11');
    await expect(page.getByTestId('bazaar-area-value')).toContainText('79.33');
    await page.getByLabel('Carpet weight', { exact: true }).fill('21.600');
    await page.getByRole('button', { name: 'Next' }).click();
    // Tauli: ack any shortage + cause so the step can advance.
    const cause = page.getByRole('button', { name: 'Less wool returned' });
    if (await cause.count()) await cause.click();
    const ack = page.getByRole('checkbox');
    if (await ack.count()) await ack.first().check();
    await page.getByRole('button', { name: 'Next' }).click();
    // Wage: no deductions, no recovery → net ₹3,014.54, paid ≈ ₹3,015 (> ₹2,000).
    await expect(page.getByTestId('bazaar-net')).toContainText('3,014.54');
    await page.getByRole('button', { name: 'Next' }).click();

    // Payment step: a photo is now required; Next stays disabled without one.
    await expect(page.getByText(/photo/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    // Attaching the payment photo unblocks the step.
    await uploadPhoto(page);
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();

    await resetLocal(page);
  });

  test('b: a peshgi give > ₹2,000 is blocked without a photo', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'M5 Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await forceEnglish(page);

    // Confirm the threshold is ₹2,000 (200000 paise).
    const threshold = await projection<number>(page, 'proj.getSettings(recs).photoRequiredAbovePaise');
    expect(threshold).toBe(200000);

    await page.goto('/peshgi/new');
    // The weaver PersonPicker renders photo-tile buttons (not role=option);
    // pick the seeded demo weaver "Rafiq Ansari" by name.
    await page.getByRole('button', { name: /Rafiq Ansari/ }).first().click();
    // Give ₹2,500 (> ₹2,000) → photo required.
    await page.getByLabel('Amount', { exact: true }).fill('2500');
    // Try to save without a photo → inline photo error, confirm sheet never opens.
    await page.getByTestId('peshgi-save').click();
    await expect(page.getByText(/photo|फ़ोटो/i).first()).toBeVisible();
    // The confirm sheet (title "Confirm peshgi") must NOT be shown while blocked.
    await expect(page.getByText(/Confirm peshgi|पेशगी देना पक्का करें/i)).toBeHidden();
    const beforeCount = await projection<number>(page, "recs.filter(r => r.type === 'peshgi' && r.payload.amountPaise === 250000).length");
    expect(beforeCount).toBe(0);

    // A give of exactly ₹2,000 (not ABOVE threshold) needs no photo and can save:
    // clicking save opens the confirm sheet ("Confirm peshgi").
    await page.getByLabel('Amount', { exact: true }).fill('2000');
    await page.getByTestId('peshgi-save').click();
    await expect(page.getByText(/Confirm peshgi|पेशगी देना पक्का करें/i).first()).toBeVisible();

    await resetLocal(page);
  });
});
