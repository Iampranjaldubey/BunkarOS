// Bunkar OS — E2E 02: masters (B1/C1/A1/C2) via the real owner UI.
// Owner creates a thekedar, two weavers (each with a photo uploaded through the
// hidden file input), a loom, a ₹38/sqft rate, a norm; then an order EX-118 of
// 3 pieces 8'0"×10'0" and assigns piece EX-118/03 to the loom.
//
// NB: Field labels render the required marker as " *" inside the <label>, so
// label locators use start-anchored regexes rather than exact matches.
import { test, expect } from '@playwright/test';
import { APP, createUnitAndLogin, forceEnglish, resetLocal, uploadPhoto, projection } from './fixtures';

test.describe('02 masters', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('owner builds masters + order and assigns piece 03', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Masters Carpets', owner: 'Owner Sahab', pin: '1234' });
    await forceEnglish(page);

    // --- Thekedar ---
    await page.goto(`${APP}/thekedars/new`);
    await page.getByLabel(/^Name/).fill('Shamim');
    await page.getByLabel(/^Village/).fill('Gopiganj');
    await page.getByRole('button', { name: 'Save thekedar' }).click();
    await page.waitForURL(/\/thekedars$/);
    await expect(page.getByText('Shamim')).toBeVisible();

    // --- Weaver 1 (with photo) ---
    await page.goto(`${APP}/weavers/new`);
    await uploadPhoto(page);
    await page.getByLabel(/^Name/).fill('Rafiq Ansari');
    await page.getByLabel(/^Father/).fill('Abdul Ansari');
    await page.getByLabel(/^Village/).fill('Rampur');
    await page.getByRole('button', { name: 'Save weaver' }).click();
    await page.waitForURL(/\/weavers$/);
    await expect(page.getByText('Rafiq Ansari')).toBeVisible();

    // --- Weaver 2 (with photo) ---
    await page.goto(`${APP}/weavers/new`);
    await uploadPhoto(page);
    await page.getByLabel(/^Name/).fill('Imran Ali');
    await page.getByLabel(/^Father/).fill('Yusuf Ali');
    await page.getByLabel(/^Village/).fill('Bhanpur');
    await page.getByRole('button', { name: 'Save weaver' }).click();
    await page.waitForURL(/\/weavers$/);
    await expect(page.getByText('Imran Ali')).toBeVisible();

    // Both weavers persisted with a photoId.
    const weavers = await projection<Array<{ name: string; photoId?: string }>>(
      page,
      'proj.listWeavers(recs)',
    );
    expect(weavers.map((w) => w.name).sort()).toEqual(['Imran Ali', 'Rafiq Ansari']);
    expect(weavers.every((w) => typeof w.photoId === 'string' && w.photoId.length > 0)).toBe(true);

    // --- Loom (code 07, width 10'0") ---
    await page.goto(`${APP}/looms/new`);
    await page.getByLabel(/^Loom code/).fill('07');
    await page.getByLabel(/^Village/).fill('Gopiganj');
    // Width = 10'0" → the ft box of the width FtInInput.
    await page.getByLabel('ft', { exact: true }).first().fill('10');
    await page.getByRole('button', { name: 'Save loom' }).click();
    await page.waitForURL(/\/looms$/);
    await expect(page.getByText(/\b07\b/).first()).toBeVisible();

    // --- Rate ₹38/sqft ---
    await page.goto(`${APP}/rates`);
    await page.getByTestId('add-rate-btn').first().click();
    // The rate sheet's Quality input is the one wired to the rate-qualities list.
    await page.locator('input[list="rate-qualities"]').fill('Kashan 60 KPSI');
    await page.getByLabel('Rupees per unit').fill('38');
    await page.getByRole('button', { name: 'Save rate' }).click();
    await expect(page.getByTestId('rate-row')).toContainText(/38/);

    // --- Order EX-118, 3 pieces, 8'0"×10'0" ---
    await page.goto(`${APP}/orders/new`);
    await page.getByLabel(/^Exporter/).fill('Sharma Exports');
    await page.getByLabel(/^Order number/).fill('EX-118');
    await page.getByLabel(/^Quality/).fill('Kashan 60 KPSI');
    // Size: 8'0" × 10'0" — two FtInInputs → ft boxes [length, width].
    const ftBoxes = page.getByLabel('ft', { exact: true });
    await ftBoxes.nth(0).fill('8');
    await ftBoxes.nth(1).fill('10');
    // Count = 3 (default 1; press +1 twice).
    await page.getByRole('button', { name: '+1' }).click();
    await page.getByRole('button', { name: '+1' }).click();
    await page.getByRole('button', { name: 'Create order' }).click();
    await page.waitForURL(/\/orders\//);

    // Three pieces exist, all not_started, with the 8'0"×10'0" size (96×120).
    const pieces = await projection<Array<{ pieceId: string; status: string; lengthIn: number; widthIn: number }>>(
      page,
      "proj.listPieces(recs).filter(p => p.orderNo === 'EX-118')",
    );
    expect(pieces.map((p) => p.pieceId).sort()).toEqual(['EX-118/01', 'EX-118/02', 'EX-118/03']);
    expect(pieces.every((p) => p.status === 'not_started')).toBe(true);
    expect(pieces[0].lengthIn).toBe(96);
    expect(pieces[0].widthIn).toBe(120);

    // --- Assign piece EX-118/03 to the loom via the detail page action sheet ---
    const row03 = page.getByTestId('piece-row').filter({ hasText: 'EX-118/03' });
    await row03.getByRole('button').last().click();
    await page.getByTestId('assign-btn').click();
    await page.getByLabel('Choose a loom').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Confirm' }).click();

    // EX-118/03 is now on_loom.
    await expect
      .poll(async () =>
        projection<string>(page, "(proj.listPieces(recs).find(p => p.pieceId === 'EX-118/03')||{}).status"),
      )
      .toBe('on_loom');
    await resetLocal(page);
  });
});
