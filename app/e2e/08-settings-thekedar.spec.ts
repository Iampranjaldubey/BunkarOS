// Bunkar OS — E2E 08: Settings add-user thekedar binding (SPEC-001 / N2 / B2).
// When role = thekedar, the add-user sheet REQUIRES picking a thekedar entity;
// the created user record carries UserP.thekedarId so visibleLoomIds scopes the
// thekedar to exactly his looms. Without the binding (the old bug) a thekedar
// saw zero looms.
import { test, expect } from '@playwright/test';
import { APP, createUnitAndLogin, loginAs, loadDemo, forceEnglish, resetLocal, projection } from './fixtures';

test.describe('08 settings thekedar binding', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('a thekedar user must be bound to a thekedar and then sees exactly his looms', async ({ page }) => {
    await createUnitAndLogin(page, { name: 'Thekedar Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await forceEnglish(page);

    // The seed makes looms 1-12 belong to thekedar "Shamim", 13-24 to "Salim".
    const shamim = await projection<{ id: string; loomCount: number }>(
      page,
      "(() => { const th = proj.listThekedars(recs).find(t => t.name === 'Shamim'); const n = proj.listLooms(recs).filter(l => l.thekedarId === th.entityId).length; return { id: th.entityId, loomCount: n }; })()",
    );
    expect(shamim.loomCount).toBe(12);

    // --- Add a thekedar user via the Settings sheet. ---
    await page.goto(`${APP}/settings`);
    await page.getByRole('button', { name: 'Add a user' }).click();
    await page.getByLabel(/^Name/).fill('Shamim Bhai');
    // Switch role to thekedar — the thekedar-entity picker appears.
    await page.getByRole('radio', { name: 'Thekedar' }).click();
    await expect(page.getByTestId('user-thekedar-select')).toBeVisible();

    // Fill PIN but leave the thekedar entity unpicked → Save must be blocked.
    // (Field labels carry a trailing " *" for required, so match by regex.)
    await page.getByLabel(/4-digit PIN/).fill('5678');
    await page.getByLabel(/Re-enter PIN/).fill('5678');
    await page.getByRole('button', { name: 'Save user' }).click();
    // Still on the sheet (not saved) because the thekedar entity is required.
    await expect(page.getByTestId('user-thekedar-select')).toBeVisible();
    const beforeUsers = await projection<number>(page, "proj.listUsers(recs).filter(u => u.name === 'Shamim Bhai').length");
    expect(beforeUsers).toBe(0);

    // Pick the Shamim thekedar entity, then save.
    await page.getByTestId('user-thekedar-select').selectOption({ label: 'Shamim' });
    await page.getByRole('button', { name: 'Save user' }).click();
    await expect(page.getByTestId('user-thekedar-select')).toHaveCount(0, { timeout: 10_000 });

    // The created user carries the thekedarId.
    const created = await projection<{ role: string; thekedarId: string | null }>(
      page,
      "(() => { const u = proj.listUsers(recs).find(x => x.name === 'Shamim Bhai'); return { role: u.role, thekedarId: u.thekedarId ?? null }; })()",
    );
    expect(created.role).toBe('thekedar');
    expect(created.thekedarId).toBe(shamim.id);

    // visibleLoomIds for the created thekedar == exactly Shamim's 12 looms.
    const visible = await projection<{ count: number; allShamim: boolean }>(
      page,
      "(() => { const u = proj.listUsers(recs).find(x => x.name === 'Shamim Bhai'); return import('/src/domain/permissions.ts').then(m => { const vis = m.visibleLoomIds(recs, u); const shamimLooms = proj.listLooms(recs).filter(l => l.thekedarId === u.thekedarId).map(l => l.entityId); return { count: vis.length, allShamim: vis.every(id => shamimLooms.includes(id)) && vis.length === shamimLooms.length }; }); })()",
    );
    expect(visible.count).toBe(12);
    expect(visible.allShamim).toBe(true);

    // --- Log in as the thekedar and confirm his looms render (not empty). ---
    await page.goto(`${APP}/login`);
    await loginAs(page, 'Shamim Bhai', '5678');
    await forceEnglish(page);
    await page.goto(`${APP}/checkin/new`);
    // The loom picker is scoped to his looms — at least one loom option shows
    // (the pre-fix bug rendered zero options).
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 10_000 });

    await resetLocal(page);
  });
});
