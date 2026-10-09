// Bunkar OS — E2E 04: public weaver slip (C8/C9).
// A bazaar slip is synced to the server; opened at /s/<token> in a NEW browser
// context with no app session, the weaver can agree once (second response is
// rejected 409 → "already answered"); the owner sees the agreement after a
// sync pulls the slip_response back. A bogus token shows a friendly error.
import { test, expect } from '@playwright/test';
import { APP, createUnitAndLogin, loadDemo, resetLocal } from './fixtures';

test.describe('04 public slip', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('agree once, second response rejected, owner sees agreed, bogus token friendly', async ({ page, browser }) => {
    await createUnitAndLogin(page, { name: 'Slip Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);

    // Push all local records (incl. seeded slips) to the server so the public
    // slip endpoint can serve them. Return the first bazaar slip's token.
    const token = await page.evaluate(async () => {
      const sync = (await import('/src/sync/client.ts')) as { syncNow: () => Promise<void> };
      await sync.syncNow();
      const dbMod = (await import('/src/db/db.ts')) as {
        db: { records: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ type: string; payload: { kind?: string; token?: string } }>> } } } };
      };
      const raw = localStorage.getItem('bunkar.session') ?? sessionStorage.getItem('bunkar.session') ?? 'null';
      const sess = JSON.parse(raw) as { unitId: string };
      const recs = await dbMod.db.records.where('unitId').equals(sess.unitId).toArray();
      const slip = recs.find((r) => r.type === 'slip' && r.payload.kind === 'bazaar');
      return slip?.payload.token as string;
    });
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThanOrEqual(22);

    // --- Open the public slip in a fresh, session-less context. ---
    const publicCtx = await browser.newContext();
    const pub = await publicCtx.newPage();
    await pub.goto(`${APP}/s/${token}`);
    // The slip renders (not the login/setup shell) with Agree/Dispute actions.
    await expect(pub.getByTestId('slip-agree')).toBeVisible({ timeout: 10_000 });
    await expect(pub.getByTestId('slip-speak')).toBeVisible();

    // Agree → thank-you confirmation.
    await pub.getByTestId('slip-agree').click();
    await expect(pub.getByText(/Thank you|धन्यवाद/i).first()).toBeVisible({ timeout: 10_000 });

    // --- Second response is rejected: a fresh load shows the already-answered state. ---
    const pub2 = await publicCtx.newPage();
    await pub2.goto(`${APP}/s/${token}`);
    // Server returns the stored response → the page shows the "already" state,
    // never the Agree button again.
    await expect(pub2.getByText(/earlier|पहले|Thank you|धन्यवाद/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(pub2.getByTestId('slip-agree')).toHaveCount(0);

    // Direct API double-post also yields 409 already_answered.
    const second = await pub2.evaluate(async (tok) => {
      const res = await fetch(`/api/slips/${tok}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: 'agree' }),
      });
      return res.status;
    }, token);
    expect(second).toBe(409);

    // --- Owner syncs and sees the agreement reflected on the bazaar detail. ---
    const agreed = await page.evaluate(async (tok) => {
      const sync = (await import('/src/sync/client.ts')) as { syncNow: () => Promise<void> };
      await sync.syncNow();
      const dbMod = (await import('/src/db/db.ts')) as {
        db: { records: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ type: string; payload: { token?: string; answer?: string } }>> } } } };
      };
      const raw = localStorage.getItem('bunkar.session') ?? sessionStorage.getItem('bunkar.session') ?? 'null';
      const sess = JSON.parse(raw) as { unitId: string };
      const recs = await dbMod.db.records.where('unitId').equals(sess.unitId).toArray();
      const resp = recs.find((r) => r.type === 'slip_response' && r.payload.token === tok);
      return resp?.payload.answer;
    }, token);
    expect(agreed).toBe('agree');

    // --- Bogus token → friendly "not found", no crash. ---
    const bogus = await publicCtx.newPage();
    await bogus.goto(`${APP}/s/this-token-is-not-real-000000`);
    await expect(bogus.getByText(/not found|नहीं मिली|No internet|इंटरनेट/i).first()).toBeVisible({ timeout: 10_000 });
    const body = (await bogus.locator('body').innerText()).trim();
    expect(body.length).toBeGreaterThan(0);

    await publicCtx.close();
    await resetLocal(page);
  });
});
