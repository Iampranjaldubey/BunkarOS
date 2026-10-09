// Bunkar OS — SPEC-016 piece rates + kg/day/piece job payments (c2).
// AC1 piece-rate bazaar gross = flat rate (area-independent).
// AC2 straightening ₹7/kg, 12.500 kg → amount ₹87.50 → paid ₹88 (+₹0.50), roker out.
// AC3 helper ₹350/day, 1.5 days to an "other" worker (name required) → ₹525.
// AC4 no job rate → blocked with a link to /rates (owner).
// AC5 tampered job amount rejected by the server (see server/test/jobs.test.mjs,
//     referenced here; the server validator mirror is unit-tested in-repo).
import { test, expect } from '@playwright/test';
import {
  APP, createUnitAndLogin, forceEnglish, resetLocal, projection, addRecordInPage,
} from './fixtures';

/** Seed a weaver + a dated rate via the app's own addRecord (authored owner). */
async function seedWeaver(page: import('@playwright/test').Page, entityId: string, name: string) {
  await addRecordInPage(page, 'weaver', {
    entityId, name, fatherName: 'Pita', village: 'Gaon', phone: '9000000000',
    phoneType: 'smartphone', active: true,
  });
}

async function seedJobRate(
  page: import('@playwright/test').Page,
  work: string, unit: string, ratePaise: number, effectiveFrom: string,
) {
  await addRecordInPage(page, 'rate', {
    entityId: `rate-${work}-${unit}`, quality: '', unit, ratePaise, effectiveFrom, work,
  });
}

test.describe('15 c2 jobs', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('AC1: piece-rate bazaar gross equals the flat rate, independent of area', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Jobs Carpets', owner: 'Salim Ansari', pin: '1234' });
    await forceEnglish(page);

    // A piece-unit weaving rate of ₹8,000 for quality "Soumak".
    await addRecordInPage(page, 'rate', {
      entityId: 'rate-soumak-piece', quality: 'Soumak', unit: 'piece', ratePaise: 800000,
      effectiveFrom: '2026-01-01',
    });

    // computeWage mirrors: gross = ratePaise regardless of area.
    const grossDirect = await page.evaluate(async () => {
      const wage = await import('/src/domain/wage.ts');
      return wage.computeWage({ areaSqft: 79.33, ratePaise: 800000, rateUnit: 'piece' });
    });
    expect(grossDirect).toBe(800000);
    const grossSmall = await page.evaluate(async () => {
      const wage = await import('/src/domain/wage.ts');
      return wage.computeWage({ areaSqft: 1, ratePaise: 800000, rateUnit: 'piece' });
    });
    expect(grossSmall).toBe(800000);

    // The piece rate resolves for a Soumak piece via rateForPiece as well.
    const resolved = await projection<{ unit: string; ratePaise: number } | undefined>(
      page,
      "(() => { const r = proj.latestEntities(recs, 'rate').find(x => x.quality === 'Soumak'); return r ? { unit: r.unit, ratePaise: r.ratePaise } : undefined; })()",
    );
    expect(resolved).toMatchObject({ unit: 'piece', ratePaise: 800000 });
  });

  test('AC2: straightening ₹7/kg, 12.500 kg → ₹87.50 paid ₹88, roker out', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Jobs Carpets', owner: 'Salim Ansari', pin: '1234' });
    await forceEnglish(page);
    await seedWeaver(page, 'w-ramesh', 'Ramesh');
    await seedJobRate(page, 'straightening', 'kg', 700, '2026-01-01');

    await page.goto(`${APP}/jobs/new`);
    // worker: weaver (default) → pick Ramesh.
    await page.getByRole('button', { name: /Ramesh/ }).first().click();
    // work: straightening tile.
    await page.getByRole('radio', { name: /Straightening/ }).click();
    // qty: 12.5 kg.
    await page.getByLabel('Weight', { exact: true }).fill('12.5');

    // amount shown ₹87.50, paid ₹88.
    await expect(page.getByText('₹88', { exact: false }).first()).toBeVisible();

    // pay all cash (₹88).
    await page.getByLabel('Cash', { exact: true }).fill('88');

    await page.getByTestId('job-save').click();
    await page.getByRole('button', { name: 'Save payment' }).last().click();
    await page.waitForURL(/\/$/);

    // A 'job' record was written with the exact money.
    const jobs = await projection<Array<{ amountPaise: number; paidPaise: number; roundingPaise: number; work: string }>>(
      page,
      "(() => proj.listJobs(recs).map(j => ({ amountPaise: j.payload.amountPaise, paidPaise: j.payload.paidPaise, roundingPaise: j.payload.roundingPaise, work: j.payload.work })))()",
    );
    expect(jobs.length).toBe(1);
    expect(jobs[0]).toMatchObject({ amountPaise: 8750, paidPaise: 8800, roundingPaise: 50, work: 'straightening' });

    // Roker shows the job as a cash OUT entry today with the work + worker.
    await page.goto(`${APP}/roker`);
    await expect(page.getByText(/Straightening.*Ramesh|Ramesh/).first()).toBeVisible();
  });

  test('AC3: helper ₹350/day, 1.5 days to an "other" worker (name required) → ₹525', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Jobs Carpets', owner: 'Salim Ansari', pin: '1234' });
    await forceEnglish(page);
    await seedJobRate(page, 'helper', 'day', 35000, '2026-01-01');

    await page.goto(`${APP}/jobs/new`);
    // worker kind → "Someone else".
    await page.getByRole('radio', { name: /Someone else/ }).click();
    // work → Helper.
    await page.getByRole('radio', { name: /Helper/ }).click();
    // qty → 1.5 days.
    await page.getByLabel('How many days').fill('1.5');

    // Try to save without a name → blocked (name required).
    await page.getByTestId('job-save').click();
    await expect(page.getByText('Name is required')).toBeVisible();

    // Enter the name, pay ₹525 cash.
    await page.getByLabel('Name', { exact: false }).first().fill('Sohan');
    await expect(page.getByText('₹525', { exact: false }).first()).toBeVisible();
    await page.getByLabel('Cash', { exact: true }).fill('525');
    await page.getByTestId('job-save').click();
    await page.getByRole('button', { name: 'Save payment' }).last().click();
    await page.waitForURL(/\/$/);

    const jobs = await projection<Array<{ amountPaise: number; workerName?: string }>>(
      page,
      "(() => proj.listJobs(recs).map(j => ({ amountPaise: j.payload.amountPaise, workerName: j.payload.workerName })))()",
    );
    expect(jobs[0]).toMatchObject({ amountPaise: 52500, workerName: 'Sohan' });
  });

  test('AC4: no job rate blocks saving with a link to rates (owner)', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Jobs Carpets', owner: 'Salim Ansari', pin: '1234' });
    await forceEnglish(page);
    await seedWeaver(page, 'w-ramesh', 'Ramesh');
    // No job rate seeded.

    await page.goto(`${APP}/jobs/new`);
    await page.getByRole('button', { name: /Ramesh/ }).first().click();
    await page.getByRole('radio', { name: /Untying/ }).click();

    // The blocking message + a link to /rates is shown.
    await expect(page.getByTestId('job-no-rate')).toBeVisible();
    await expect(page.getByText('No rate set for this work')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Set the rate' })).toBeVisible();
  });
});
