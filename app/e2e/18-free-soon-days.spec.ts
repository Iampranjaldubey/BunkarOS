// Bunkar OS — SPEC-017 owner-home "free in next 30 days" must never render a
// negative "free in −N days" estimate (UI-fixer behavioural regression test).
//
// loomsFreeSoon (src/domain/owner.ts) estimates a finish date from the last
// check-in pace; when that estimate has already elapsed (freeDay in the past)
// it can emit a negative `daysLeft`. The owner home (HomePage FreeSoonCard,
// owned by this fixer) clamps the displayed value with Math.max(0, …) and
// shows "अब खाली होने वाला" / "freeing up now" instead of "-34 दिन में".
//
// This spec seeds a loom whose on-loom piece's last check-in is old enough that
// the finish estimate is in the past, renders the owner home, and asserts that
// (a) no free-soon row ever shows a minus sign, and (b) the elapsed row shows
// the "now" copy. It writes backdated Recs straight into IndexedDB (the live
// useRecords hook renders them) because addRecord stamps day=today.
import { test, expect, type Page } from '@playwright/test';
import { APP, createUnitAndLogin, resetLocal } from './fixtures';

/** YYYY-MM-DD that is `n` days before today (UTC, matching istDay in tests). */
function dayOffset(n: number): string {
  const t = Date.now() - n * 24 * 60 * 60 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Put backdated raw Recs directly into IndexedDB for the active unit so the
 * live owner-home projection sees them. Mirrors the real Rec shape; `day` is
 * set per-record so loomsFreeSoon can land freeDay in the past.
 */
async function seedBackdatedRecs(
  page: Page,
  recs: Array<{ type: string; payload: unknown; day: string }>,
): Promise<void> {
  await page.evaluate(async (recs) => {
    const dbMod = (await import('/src/db/db.ts')) as {
      db: { records: { put: (r: unknown) => Promise<unknown> } };
    };
    const raw =
      localStorage.getItem('bunkar.session') ??
      sessionStorage.getItem('bunkar.session') ??
      'null';
    const sess = JSON.parse(raw) as { unitId: string; userId: string; role: string } | null;
    if (!sess) throw new Error('no session');
    let i = 0;
    for (const r of recs) {
      await dbMod.db.records.put({
        id: `e2e-free-${Date.now()}-${i++}`,
        type: r.type,
        unitId: sess.unitId,
        payload: r.payload,
        by: sess.userId,
        role: sess.role,
        device: 'e2e',
        at: `${r.day}T06:00:00.000Z`,
        day: r.day,
        sync: 'synced',
      });
    }
  }, recs);
}

test.describe('SPEC-017 — free-in-30-days never shows negative days', () => {
  test.afterEach(async ({ page }) => {
    await resetLocal(page);
  });

  test('elapsed finish estimate renders "अब खाली होने वाला", not "-N दिन में"', async ({
    page,
  }) => {
    await createUnitAndLogin(page, { owner: 'Salim Ansari', pin: '1234' });

    // Loom L1 with an on-loom piece whose last check-in is 35 days old.
    // assign 40d ago, wovenIn 700 of 710 → pace 17.5 in/day, remaining 10 →
    // daysToFinish ceil(10/17.5)=1 → freeDay = (today-35)+1 = today-34 →
    // loomsFreeSoon emits daysLeft = -34 (passes the <=30 filter).
    await seedBackdatedRecs(page, [
      {
        type: 'loom',
        day: dayOffset(60),
        payload: {
          entityId: 'L1',
          code: '01',
          village: 'V',
          widthIn: 72,
          weaverIds: [],
          active: true,
        },
      },
      {
        type: 'order',
        day: dayOffset(60),
        payload: {
          entityId: 'O1',
          orderNo: 'EX-900',
          exporter: 'X',
          design: 'D',
          quality: 'Q',
          colour: 'C',
          lengthIn: 710,
          widthIn: 120,
          count: 1,
          pieces: [{ pieceId: 'EX-900/01', seq: 1 }],
        },
      },
      { type: 'piece_assign', day: dayOffset(40), payload: { pieceId: 'EX-900/01', loomId: 'L1' } },
      {
        type: 'checkin',
        day: dayOffset(35),
        payload: { pieceId: 'EX-900/01', loomId: 'L1', wovenIn: 700 },
      },
    ]);

    await page.goto(`${APP}/`);

    // The free-soon card must render our overdue loom.
    const rows = page.getByTestId('free-soon-loom');
    await expect(rows.first()).toBeVisible();

    // (a) No row's days label may show a negative number ("-34 दिन में").
    // Scope to the days-label span (the piece id itself legitimately contains a
    // hyphen, e.g. "EX-900/01", so we must not check the whole row text).
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const label = rows.nth(i).locator('span.text-muted.font-medium');
      const text = (await label.innerText()).replace(/\u2212/g, '-'); // normalise U+2212
      expect(text, `free-soon row ${i} days label must not be negative`).not.toMatch(/-\s*\d/);
    }

    // (b) The elapsed row shows the "now" copy (Hindi default).
    await expect(rows.filter({ hasText: 'अब खाली होने वाला' }).first()).toBeVisible();
  });
});
