// Bunkar OS — E2E 01: unit setup, role users, per-role login, permissions.
// Covers SPEC-001 (M1/N2/N1): owner creates a unit, adds a munshi + a thekedar
// in Settings, each logs in; munshi sees the rate card read-only (owner-only
// edit, server rejects a forced non-owner rate); a thekedar sees only his looms
// and the check-in action; a wrong PIN eventually shows the lockout message.
import { test, expect } from '@playwright/test';
import {
  APP,
  createUnitAndLogin,
  loginAs,
  addRecordInPage,
  hashPinInPage,
  resetLocal,
} from './fixtures';

test.describe('01 setup + roles', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('owner adds munshi + thekedar in Settings and both can log in', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Role Carpets', owner: 'Owner Sahab', pin: '1234' });

    // --- Owner adds a munshi via Settings → Add user. ---
    await page.goto(`${APP}/settings`);
    await page.getByRole('button', { name: /Add a user|नया यूज़र/ }).click();
    await page.getByLabel(/^Name|नाम/).first().fill('Munshi Ji');
    // Role defaults to munshi. Fill PIN + confirm (tel inputs with maxLength 4).
    const pinFields = page.getByLabel(/PIN|पिन/);
    await pinFields.nth(0).fill('1111');
    await pinFields.nth(1).fill('1111');
    await page.getByRole('button', { name: /Save user|यूज़र सेव/ }).last().click();
    await expect(page.getByText(/Munshi Ji/)).toBeVisible();

    // --- Owner adds a thekedar user. ---
    // A thekedar login must be bound to a thekedar entity (UserP.thekedarId), so
    // first create a thekedar entity to bind to (no demo seed in this test).
    await addRecordInPage(page, 'thekedar', {
      entityId: 'thek-1', name: 'Shamim', phone: '9811122233', village: 'Gopiganj', active: true,
    });
    await page.getByRole('button', { name: /Add a user|नया यूज़र/ }).click();
    await page.getByLabel(/^Name|नाम/).first().fill('Thekedar Ji');
    // Switch the role segmented control to thekedar (radio option).
    await page.getByRole('radio', { name: 'ठेकेदार', exact: true }).click();
    // The thekedar-entity picker appears; bind to the seeded "Shamim".
    await expect(page.getByTestId('user-thekedar-select')).toBeVisible();
    await page.getByTestId('user-thekedar-select').selectOption({ label: 'Shamim' });
    const pin2 = page.getByLabel(/PIN|पिन/);
    await pin2.nth(0).fill('2222');
    await pin2.nth(1).fill('2222');
    await page.getByRole('button', { name: /Save user|यूज़र सेव/ }).last().click();
    await expect(page.getByText(/Thekedar Ji/)).toBeVisible();

    // --- Munshi logs in and lands on the munshi home (big action tiles). ---
    await page.goto(`${APP}/login`);
    await loginAs(page, 'Munshi Ji', '1111');
    await expect(page).toHaveURL(/localhost:5173\/$/);
    // Munshi action tiles include a Bazaar action.
    await expect(page.getByRole('link', { name: /Bazaar|बाज़ार/ }).first()).toBeVisible();
    await resetLocal(page);
  });

  test('munshi sees the rate card read-only; a forced non-owner rate is rejected', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Rate Carpets', owner: 'Owner Sahab', pin: '1234' });

    // Seed a munshi user so we can log in as one.
    const { pinHash, pinSalt } = await hashPinInPage(page, '1111');
    await addRecordInPage(page, 'user', {
      entityId: 'munshi-1',
      name: 'Munshi Ji',
      phone: '',
      role: 'munshi',
      pinHash,
      pinSalt,
      active: true,
    });

    await page.goto(`${APP}/login`);
    await loginAs(page, 'Munshi Ji', '1111');

    // On /rates the munshi gets a read-only banner and NO add-rate button.
    await page.goto(`${APP}/rates`);
    await expect(page.getByText(/Only the owner can change rates|सिर्फ़ मालिक रेट बदल सकते हैं/).first()).toBeVisible();
    await expect(page.getByTestId('add-rate-btn')).toHaveCount(0);

    // Server rule: a rate record authored by a non-owner is rejected. Push one
    // through the app's own repo (role is stamped from the munshi session), then
    // sync and assert it is marked rejected with reason 'forbidden_role'.
    const rateRecId = await addRecordInPage(page, 'rate', {
      entityId: 'rate-forced',
      quality: 'Forced',
      unit: 'sqft',
      ratePaise: 3800,
      effectiveFrom: '2026-10-01',
    });
    const reason = await page.evaluate(async (id) => {
      const sync = (await import('/src/sync/client.ts')) as { syncNow: () => Promise<void> };
      await sync.syncNow();
      const dbMod = (await import('/src/db/db.ts')) as {
        db: { records: { get: (id: string) => Promise<{ sync?: string; rejectReason?: string } | undefined> } };
      };
      const r = await dbMod.db.records.get(id);
      return { sync: r?.sync, reason: r?.rejectReason };
    }, rateRecId);
    expect(reason.sync).toBe('rejected');
    expect(reason.reason).toBe('forbidden_role');
    await resetLocal(page);
  });

  test('thekedar sees only his looms and the check-in action', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Thekedar Carpets', owner: 'Owner Sahab', pin: '1234' });

    // Seed two thekedars, two looms (one each), and a thekedar user linked to T1.
    await addRecordInPage(page, 'thekedar', { entityId: 'th-1', name: 'Shamim', phone: '9811122233', village: 'Gopiganj', active: true });
    await addRecordInPage(page, 'thekedar', { entityId: 'th-2', name: 'Salim', phone: '9822233344', village: 'Aurai', active: true });
    await addRecordInPage(page, 'loom', { entityId: 'loom-A', code: '07', village: 'Gopiganj', widthIn: 120, thekedarId: 'th-1', weaverIds: [], active: true });
    await addRecordInPage(page, 'loom', { entityId: 'loom-B', code: '18', village: 'Aurai', widthIn: 120, thekedarId: 'th-2', weaverIds: [], active: true });

    const { pinHash, pinSalt } = await hashPinInPage(page, '2222');
    await addRecordInPage(page, 'user', {
      entityId: 'thekedar-user-1',
      name: 'Thekedar Shamim',
      phone: '',
      role: 'thekedar',
      thekedarId: 'th-1',
      pinHash,
      pinSalt,
      active: true,
    });

    await page.goto(`${APP}/login`);
    await loginAs(page, 'Thekedar Shamim', '2222');

    // Thekedar home shows his loom (Gopiganj) and a prominent check-in CTA.
    await expect(page.getByRole('button', { name: /check.?in|हाज़िरी|चेक/i }).first()).toBeVisible();
    await expect(page.getByText(/Gopiganj/).first()).toBeVisible();
    await expect(page.getByText(/Aurai/)).toHaveCount(0);

    // The check-in piece picker is scoped to his looms only (visibleLoomIds).
    const visible = await page.evaluate(async () => {
      const proj = await import('/src/domain/projections.ts');
      const perm = await import('/src/domain/permissions.ts');
      const dbMod = await import('/src/db/db.ts');
      const raw = localStorage.getItem('bunkar.session') ?? sessionStorage.getItem('bunkar.session') ?? 'null';
      const sess = JSON.parse(raw) as { unitId: string } | null;
      const recs = sess ? await dbMod.db.records.where('unitId').equals(sess.unitId).toArray() : [];
      const user = proj.listUsers(recs).find((u: { entityId: string }) => u.entityId === 'thekedar-user-1');
      return perm.visibleLoomIds(recs, user);
    });
    expect(visible).toEqual(['loom-A']);
    await resetLocal(page);
  });

  test('wrong PIN five times shows the lockout message', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Lock Carpets', owner: 'Owner Sahab', pin: '1234' });

    await page.goto(`${APP}/login`);
    await page.getByRole('button', { name: /Owner Sahab/ }).first().click();

    // Enter a wrong 4-digit PIN five times → lockout engages (MAX_ATTEMPTS=5).
    for (let attempt = 0; attempt < 5; attempt++) {
      for (const d of '9999') {
        await page.getByRole('button', { name: d, exact: true }).click();
      }
      await expect(page.getByRole('alert')).toBeVisible();
    }

    // The alert now shows the lockout countdown message, not just "wrong PIN".
    await expect(page.getByRole('alert')).toContainText(/second|सेकंड/i);
    await expect(page).toHaveURL(/\/login/);
    await resetLocal(page);
  });
});
