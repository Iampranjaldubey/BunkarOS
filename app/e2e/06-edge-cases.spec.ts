// Bunkar OS — E2E 06: edge cases + guards (C3/E2/E1/C5/C2/N2).
// Each test loads the demo for realistic masters, then exercises one guard:
//  a) duplicate bazaar for an off_loom piece is blocked (UI + server rule)
//  b) peshgi recovery > balance shows an inline error / is clamped
//  c) returning more wool than held shows an inline error
//  d) a missing rate blocks the wage step
//  e) a deduction without a photo cannot advance
//  f) a payment split that does not sum to the paid amount is blocked
//  g) an owner reversal of a bazaar drops it from roker and re-allows a bazaar
//  h) a munshi cannot reverse yesterday's record
import { test, expect } from '@playwright/test';
import {
  createUnitAndLogin, loginAs, loadDemo, forceEnglish, resetLocal, uploadPhoto,
  addRecordInPage, hashPinInPage, projection,
} from './fixtures';

async function ownerDemo(page: import('@playwright/test').Page): Promise<void> {
  await createUnitAndLogin(page, { name: 'Edge Carpets', owner: 'Salim Ansari', pin: '1234' });
  await loadDemo(page);
  await forceEnglish(page);
}

/** Pick a piece in the bazaar wizard step 0 by its id (on_loom options). */
async function pickPiece(page: import('@playwright/test').Page, pieceId: string): Promise<void> {
  await page.getByRole('option', { name: new RegExp(pieceId.replace('/', '\\/')) }).first().click();
}

test.describe('06 edge cases', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('a: duplicate bazaar for an off_loom piece is blocked', async ({ page }) => {
    await ownerDemo(page);
    // EX-125/01 already has a completed (seeded) bazaar → it is off_loom.
    const status = await projection<string>(page, "(proj.listPieces(recs).find(p => p.pieceId === 'EX-125/01')||{}).status");
    expect(status).toBe('off_loom');

    // The bazaar wizard offers only on_loom pieces, so EX-125/01 is not pickable.
    await page.goto('/bazaar/new');
    await expect(page.getByRole('option', { name: /EX-125\/01/ })).toHaveCount(0);

    // And the server rejects a second bazaar for the same piece (duplicate_bazaar).
    // Push the seeded data first so the original EX-125/01 bazaar is persisted
    // server-side, then add + sync the duplicate for a clean rejection. Sync is
    // retried until the queue settles (a single cycle can be gated by the
    // auto-sync running flag or batched photo uploads).
    const drain = async () => {
      await page.evaluate(async () => {
        const sync = (await import('/src/sync/client.ts')) as { syncNow: () => Promise<void> };
        for (let i = 0; i < 10; i++) {
          await sync.syncNow();
          const dbMod = (await import('/src/db/db.ts')) as { db: { records: { where: (k: string) => { equals: (v: string) => { count: () => Promise<number> } } } } };
          const pending = await dbMod.db.records.where('sync').equals('pending').count();
          if (pending === 0) break;
          await new Promise((r) => setTimeout(r, 150));
        }
      });
    };
    await drain();
    const bazaarId = await projection<string>(
      page,
      "(recs.find(r => r.type === 'bazaar' && r.payload.pieceId === 'EX-125/01')||{}).id",
    );
    expect(bazaarId).toBeTruthy();
    const dupId = await addRecordInPage(page, 'bazaar', {
      pieceId: 'EX-125/01', loomId: 'x', weaverId: 'w', lengthIn: 84, widthIn: 120, areaSqft: 70,
      carpetGrams: 20000, rateId: 'r', ratePaise: 3800, rateUnit: 'sqft', grossPaise: 266000,
      deductions: [], peshgiRecoveredPaise: 0, netPaise: 266000, paidPaise: 266000, roundingPaise: 0,
      payment: { cashPaise: 266000, upiPaise: 0 },
      tauli: { issuedG: 22000, returnedG: 900, usedG: 21100, wastagePct: 3, allowedG: 633, gapG: 1100, shortG: 467, extraG: 0, weaverAck: true },
    });
    await drain();
    const reason = await page.evaluate(async (id) => {
      const dbMod = (await import('/src/db/db.ts')) as { db: { records: { get: (id: string) => Promise<{ sync?: string; rejectReason?: string } | undefined> } } };
      const r = await dbMod.db.records.get(id);
      return { sync: r?.sync, reason: r?.rejectReason };
    }, dupId);
    expect(reason.sync).toBe('rejected');
    expect(reason.reason).toBe('duplicate_bazaar');
    await resetLocal(page);
  });

  test('b: peshgi recovery greater than balance is blocked inline', async ({ page }) => {
    await ownerDemo(page);
    // Issue the 2nd 12kg + return so EX-118/03 is ready, then enter the wizard.
    await page.goto('/bazaar/new');
    await pickPiece(page, 'EX-118/03');
    await page.getByRole('button', { name: 'Next' }).click();
    // Measure: keep prefilled size, add carpet weight.
    await page.getByLabel('Carpet weight', { exact: true }).fill('21.600');
    await page.getByRole('button', { name: 'Next' }).click();
    // Tauli: pick cause + ack if a shortage shows; then continue.
    const cause = page.getByRole('button', { name: 'Less wool returned' });
    if (await cause.count()) await cause.click();
    const ack = page.getByRole('checkbox');
    if (await ack.count()) await ack.first().check();
    await page.getByRole('button', { name: 'Next' }).click();
    // Wage: try to recover far more than the ₹5,000 peshgi balance.
    await page.getByLabel('Peshgi recovery', { exact: true }).first().fill('999999');
    // Inline "too much" error appears and Next stays disabled.
    await expect(page.getByText(/more than|balance|ज़्यादा|बाक़ी से/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    await resetLocal(page);
  });

  test('c: returning more wool than held is blocked inline', async ({ page }) => {
    await ownerDemo(page);
    await page.goto('/yarn/return');
    await page.getByRole('option').first().click();
    // Pick the first held shade/lot, then try to return an absurd amount.
    await page.getByLabel('Shade / lot').selectOption({ index: 1 });
    await page.getByLabel('Weight', { exact: true }).fill('9999');
    // Trigger validation by attempting to submit.
    await page.getByRole('button', { name: 'Return yarn' }).first().click();
    await expect(page.getByText(/Only .* held|cannot return more|सिर्फ़|ज़्यादा वापस/i).first()).toBeVisible();
    // No confirm sheet opened (still on the form).
    await expect(page).toHaveURL(/\/yarn\/return$/);
    await resetLocal(page);
  });

  test('d: a missing rate blocks the wage step', async ({ page }) => {
    await ownerDemo(page);
    // Reverse every rate so no rate is in force, then bazaar EX-118/03.
    await page.evaluate(async () => {
      const repo = (await import('/src/db/repo.ts')) as { reverse: (id: string, reason: string) => Promise<unknown> };
      const dbMod = (await import('/src/db/db.ts')) as { db: { records: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ id: string; type: string }>> } } } } };
      const raw = localStorage.getItem('bunkar.session') ?? sessionStorage.getItem('bunkar.session') ?? 'null';
      const sess = JSON.parse(raw) as { unitId: string };
      const recs = await dbMod.db.records.where('unitId').equals(sess.unitId).toArray();
      for (const r of recs.filter((x) => x.type === 'rate')) await repo.reverse(r.id, 'test: remove rate');
    });
    await page.goto('/bazaar/new');
    await pickPiece(page, 'EX-118/03');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Carpet weight', { exact: true }).fill('21.600');
    await page.getByRole('button', { name: 'Next' }).click();
    const cause = page.getByRole('button', { name: 'Less wool returned' });
    if (await cause.count()) await cause.click();
    const ack = page.getByRole('checkbox');
    if (await ack.count()) await ack.first().check();
    await page.getByRole('button', { name: 'Next' }).click();
    // Wage step shows "No rate for this quality" and offers to set the rate.
    await expect(page.getByText(/No rate for this quality|रेट नहीं/i).first()).toBeVisible();
    await resetLocal(page);
  });

  test('e: a deduction without a photo cannot advance', async ({ page }) => {
    await ownerDemo(page);
    await page.goto('/bazaar/new');
    await pickPiece(page, 'EX-118/03');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Carpet weight', { exact: true }).fill('21.600');
    await page.getByRole('button', { name: 'Next' }).click();
    const cause = page.getByRole('button', { name: 'Less wool returned' });
    if (await cause.count()) await cause.click();
    const ack = page.getByRole('checkbox');
    if (await ack.count()) await ack.first().check();
    await page.getByRole('button', { name: 'Next' }).click();
    // Add a deduction with reason + amount but NO photo → Next stays disabled.
    await page.getByRole('button', { name: 'Add deduction' }).click();
    await page.getByLabel(/^Reason/).first().fill('No photo');
    await page.getByLabel(/^Amount/).first().fill('60');
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    // Adding the photo unblocks it.
    await uploadPhoto(page);
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
    await resetLocal(page);
  });

  test('f: a payment split that does not sum is blocked', async ({ page }) => {
    await ownerDemo(page);
    await page.goto('/bazaar/new');
    await pickPiece(page, 'EX-118/03');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByLabel('Carpet weight', { exact: true }).fill('21.600');
    await page.getByRole('button', { name: 'Next' }).click();
    const cause = page.getByRole('button', { name: 'Less wool returned' });
    if (await cause.count()) await cause.click();
    const ack = page.getByRole('checkbox');
    if (await ack.count()) await ack.first().check();
    await page.getByRole('button', { name: 'Next' }).click();
    // Wage step: no deductions, no recovery → go to payment.
    await page.getByRole('button', { name: 'Next' }).click();
    // Payment: force cash to a wrong value so cash+upi != paid.
    await page.getByLabel(/^Cash/).first().fill('1');
    await expect(page.getByText(/must equal|must add|बराबर|जोड़/i).first()).toBeVisible();
    await expect(page.getByTestId('bazaar-save')).toHaveCount(0); // still on step 4
    await resetLocal(page);
  });

  test('g: owner reversal drops the bazaar from roker and re-allows a bazaar', async ({ page }) => {
    await ownerDemo(page);
    // Reverse the seeded EX-125/01 bazaar; it should drop out of projections and
    // the piece should become bazaar-able again (no longer off_loom).
    const bazaarId = await projection<string>(
      page,
      "(recs.find(r => r.type === 'bazaar' && r.payload.pieceId === 'EX-125/01')||{}).id",
    );
    const dayOfBazaar = await projection<string>(
      page,
      "(recs.find(r => r.type === 'bazaar' && r.payload.pieceId === 'EX-125/01')||{}).day",
    );
    // Roker on that day currently has an EX-125/01 cash entry.
    const before = await projection<boolean>(
      page,
      `proj.rokerDay(recs, ${JSON.stringify(dayOfBazaar)}).entries.some(e => /EX-125\\/01/.test(e.label))`,
    );
    expect(before).toBe(true);

    await page.evaluate(async (id) => {
      const repo = (await import('/src/db/repo.ts')) as { reverse: (id: string, reason: string) => Promise<unknown> };
      await repo.reverse(id, 'owner correction');
    }, bazaarId);

    // After reversal: roker entry gone + piece no longer off_loom (bazaar-able).
    const after = await projection<boolean>(
      page,
      `proj.rokerDay(recs, ${JSON.stringify(dayOfBazaar)}).entries.some(e => /EX-125\\/01/.test(e.label))`,
    );
    expect(after).toBe(false);
    const status = await projection<string>(page, "(proj.listPieces(recs).find(p => p.pieceId === 'EX-125/01')||{}).status");
    expect(status).not.toBe('off_loom');
    await resetLocal(page);
  });

  test('h: a munshi cannot reverse yesterday’s record', async ({ page }) => {
    await ownerDemo(page);
    // Seed a munshi + a bazaar authored by that munshi DATED YESTERDAY.
    const { pinHash, pinSalt } = await hashPinInPage(page, '1111');
    await addRecordInPage(page, 'user', {
      entityId: 'munshi-rev', name: 'Munshi Ji', phone: '', role: 'munshi', pinHash, pinSalt, active: true,
    });
    const yBazaarId = await page.evaluate(async () => {
      const dbMod = (await import('/src/db/db.ts')) as {
        db: { records: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<Record<string, unknown>>> } }; put: (r: unknown) => Promise<unknown> } };
      };
      const idsMod = (await import('/src/domain/ids.ts')) as { uuid: () => string; istDay: (s: string) => string };
      const raw = localStorage.getItem('bunkar.session') ?? sessionStorage.getItem('bunkar.session') ?? 'null';
      const sess = JSON.parse(raw) as { unitId: string };
      const yISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const id = idsMod.uuid();
      await dbMod.db.records.put({
        id, type: 'bazaar', unitId: sess.unitId,
        payload: { pieceId: 'EX-999/01', loomId: 'l', weaverId: 'w', lengthIn: 84, widthIn: 120, areaSqft: 70, carpetGrams: 20000, rateId: 'r', ratePaise: 3800, rateUnit: 'sqft', grossPaise: 266000, deductions: [], peshgiRecoveredPaise: 0, netPaise: 266000, paidPaise: 266000, roundingPaise: 0, payment: { cashPaise: 266000, upiPaise: 0 }, tauli: { issuedG: 22000, returnedG: 900, usedG: 21100, wastagePct: 3, allowedG: 633, gapG: 1100, shortG: 467, extraG: 0, weaverAck: true } },
        by: 'munshi-rev', role: 'munshi', device: 'test', at: yISO, day: idsMod.istDay(yISO), sync: 'pending',
      });
      return id;
    });

    // Log in as the munshi and open that bazaar's detail.
    await page.goto('/login');
    await loginAs(page, 'Munshi Ji', '1111');
    await forceEnglish(page);
    await page.goto(`/bazaar/${yBazaarId}`);
    // The receipt renders, but no "reverse" action is offered (ownToday only).
    await expect(page.getByText(/EX-999\/01/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Reverse|पलट|रद्द/i })).toHaveCount(0);
    // The hint explains it cannot be reversed.
    await expect(page.getByText(/cannot|नहीं कर सकते|only|आज/i).first()).toBeVisible();
    await resetLocal(page);
  });
});
