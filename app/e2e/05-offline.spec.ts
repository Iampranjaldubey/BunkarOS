// Bunkar OS — E2E 05: offline queue + sync badge (M3/M5), dev stack (:5173).
// The dev server has no service worker (vite.config devOptions.enabled=false),
// so lazy-route navigation cannot be served offline. We therefore capture the
// offline writes through the app's OWN addRecord (the exact code path every
// save button runs) while the shell stays on an already-loaded page: a yarn
// issue + a check-in are stored locally with sync:'pending', the header badge
// reports the offline/pending state, and going back online drains the queue to
// zero (synced). The app-shell offline RELOAD is proven in 05b against a
// production preview build where the service worker is active.
import { test, expect } from '@playwright/test';
import { createUnitAndLogin, loadDemo, forceEnglish, resetLocal, projection } from './fixtures';

/** Append a record offline via the app's repo.addRecord (session-authored). */
async function addOffline(page: import('@playwright/test').Page, type: string, payload: unknown): Promise<void> {
  await page.evaluate(async ({ type, payload }) => {
    const repo = (await import('/src/db/repo.ts')) as { addRecord: (t: string, p: unknown, o?: unknown) => Promise<unknown> };
    await repo.addRecord(type, payload);
  }, { type, payload });
}

test.describe('05 offline queue', () => {
  test.afterEach(async ({ page, context }) => {
    await context.setOffline(false);
    await resetLocal(page);
  });

  test('offline writes queue as pending and drain to zero when back online', async ({ page, context }) => {
    await createUnitAndLogin(page, { name: 'Offline Carpets', owner: 'Salim Ansari', pin: '1234' });
    await loadDemo(page);
    await forceEnglish(page);

    // Resolve the demo loom 07 + piece EX-118/03 to author realistic writes.
    const ctx = await projection<{ loomId: string; pieceId: string }>(
      page,
      "(() => { const p = proj.listPieces(recs).find(x => x.pieceId === 'EX-118/03'); return { loomId: p.loomId, pieceId: p.pieceId }; })()",
    );

    // Baseline sync so the delta is unambiguous.
    await page.evaluate(async () => {
      const sync = (await import('/src/sync/client.ts')) as { syncNow: () => Promise<void> };
      await sync.syncNow();
    });
    const pendingBefore = await projection<number>(page, "recs.filter(r => r.sync === 'pending').length");

    // --- Go offline. ---
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByText(/^Offline$|ऑफ़लाइन|ऑफलाइन/).first()).toBeVisible({ timeout: 10_000 });

    // --- Create a yarn issue + a check-in while offline (same code path as UI). ---
    await addOffline(page, 'yarn_issue', {
      holder: { kind: 'loom', loomId: ctx.loomId, pieceId: ctx.pieceId },
      shade: 'Red',
      lot: 'L-OFF',
      grams: 5000,
    });
    await addOffline(page, 'checkin', { pieceId: ctx.pieceId, loomId: ctx.loomId, wovenIn: 6 });

    // Both writes are queued locally with sync:'pending'.
    const kinds = await projection<string[]>(
      page,
      "recs.filter(r => r.sync === 'pending' && (r.payload.lot === 'L-OFF' || r.type === 'checkin')).map(r => r.type)",
    );
    expect(kinds).toContain('yarn_issue');
    expect(kinds).toContain('checkin');
    const pendingOffline = await projection<number>(page, "recs.filter(r => r.sync === 'pending').length");
    expect(pendingOffline).toBeGreaterThanOrEqual(pendingBefore + 2);
    // The header badge reflects the offline state.
    await expect(page.getByText(/^Offline$|ऑफ़लाइन|ऑफलाइन/).first()).toBeVisible();

    // --- Back online → auto-sync drains the queue to zero. ---
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.evaluate(async () => {
      const sync = (await import('/src/sync/client.ts')) as { syncNow: () => Promise<void> };
      await sync.syncNow();
    });
    await expect
      .poll(async () => projection<number>(page, "recs.filter(r => r.sync === 'pending').length"), { timeout: 20_000 })
      .toBe(0);
    await expect(page.getByText(/^Synced$|सिंक/).first()).toBeVisible({ timeout: 10_000 });

    await resetLocal(page);
  });
});
