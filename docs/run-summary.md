# Run summary — SPEC-M16 server integrity and paid-month display

- **Date:** 2026-11-02.
- **Branch:** `desktop-first`, local commit only (not pushed).
- **Spec:** SPECS.md SPEC-M16, approved by the user's goal message.
- **Databases:** every test ran on a throwaway Postgres schema:
  - `t_<random>` per server test file;
  - `e2e` for Playwright;
  - `seedcheck` for the seed check.
  The local `public` schema was not modified.

## Acceptance criteria

| # | Criterion | What changed | Tests (all passing) |
|---|---|---|---|
| 1 | A paid month always shows the saved payment on the pay screen, slip and worker page, and the numbers stay the same after the worker's rate changes | New payments save a fuller `snapshot` (W, per-day, absence and half-day deductions, OT rate, advance balance before payment). `paidView()` (`app/src/domain/wage.ts`) builds every paid-month line only from the payment record; the pay screen, WhatsApp slip text, worker page and wage-sheet/export paid rows use it. Older payments show base + one combined attendance deduction from the stored record. | `app/src/domain/paidview.test.ts` (6): snapshot fields; paid view = the lines seen before confirming; **salary ₹12,000 → ₹15,000 and a later absence change nothing**; old payment fallback; lines add up to paid. e2e `03-wages`: after paying ₹10,020 the owner sets salary ₹15,000 → pay screen still ₹10,020, same lines (₹12,000, −₹923.08), same counts, identical slip text. e2e `07-worker-page`: same check on the worker's own page (paid amount, year total, slip lines; no ₹15,000). |
| 2 | Undoing an entry dated in a locked month is refused for everyone, including the owner; the owner must unlock first | `server/rules.mjs`: a `reversal` whose target is dated in a locked month (or a payment for a locked month) → `period_locked`, for all roles; the lock's own reversal is allowed and, in one push, reopens the month for later records. Entry log: no undo button, a lock mark instead (`LogPage.tsx`, `domain/locks.ts` `isRecordLocked`). | `server/test/integrity.test.mjs` AC2: owner reversals of attendance, advance, payment, and a payment recorded in July for June → all `period_locked`; staff → `period_locked`; unlock + reversal in one push → both accepted; payment reversal accepted after unlock. `paidview.test.ts` "locked entries". e2e `03-wages`: after locking, the log shows 4 attendance + 1 payment lock marks and no "एंट्री वापस लें" button. |
| 3 | The server rejects a wage payment with net < 0, \|rounding\| > 50 paise or paid < 0 | `server/rules.mjs` `wage_payment`: `negative_net`, `invalid_rounding`, `negative_paid` (before the arithmetic check). Pay screen: confirm disabled with a message when net < 0. | `integrity.test.mjs` AC3: net −30 / rounding +30 → `negative_net`; rounding +99 and −60 → `invalid_rounding`; net 20 / rounding −40 / paid −20 → `negative_paid`; rounding +50 → accepted. Existing `rules.test.mjs` arithmetic test still passes. |
| 4 | Stock out that would go below zero is refused unless the record is by an owner with an explicit override flag | The server computes each item's balance from stored records (`server/db.mjs` `stockBalances`, reversed records excluded) and keeps it current through the push. Stock out, negative adjustments and finished-stock deliveries below zero → `insufficient_stock`, unless the author is the owner, `allowNegative: true` and `overrideReason` is not empty. App: the owner must type "माइनस में जाने की वजह"; the record carries flag + reason. | `integrity.test.mjs` AC4: staff zero stock → refused; owner without flag → refused; owner flag without reason → refused; staff with flag → refused; owner flag + reason → accepted; in 5 / out 3 / out 3 in one push → second out refused; negative adjustment over the balance → refused, within → accepted; reversal of an out frees stock in the same push; finished delivery 3 of 2 → refused, 2 → accepted; delivery without a finished item untouched. e2e `04-stock`: owner over-issue refused without a reason, accepted with one, synced, nothing rejected. |
| 5 | The staff same-day undo check uses the server's receive time, so back-dating an undo is refused | `rules.mjs`: a staff reversal needs `target.by === staff` and `target.day === ctx.serverDay` (server IST date at receive time). The reversal's `day` is no longer used. | `server/test/rules.test.mjs` "staff may reverse only own records from the server's today": own record today → accepted; another user's → `forbidden_reversal`; own record from yesterday with the reversal **back-dated to yesterday** → `forbidden_reversal`; same with today's date → `forbidden_reversal`; the owner may reverse it. |
| 6 | Photo ids are scoped to the unit; an upload of an id another unit owns is refused without changing anything | `server/db.mjs` `putPhoto`: `INSERT … ON CONFLICT DO NOTHING`, then compare. Another unit → 409 `photo_id_taken`; same unit, other bytes → 409 `photo_exists`; same bytes → 200. Reads stay scoped to the unit. App: a 409 photo is marked `rejected` and not retried. | `integrity.test.mjs` AC6: B uploads A's id → 409 `photo_id_taken`; A still reads its original bytes; B reads it → 404; A re-sends the same bytes → 200; A sends other bytes → 409 `photo_exists`, original kept. `app/src/sync/client.test.ts` "a photo refused with 409 is marked rejected and not sent again". |

## Checks

| Check | Command | Result |
|---|---|---|
| Typecheck | `cd app && npm run typecheck` | exit 0 |
| Lint | `cd app && npm run lint` | 0 errors, 53 warnings (same 53 as before; 3 new ones from this run were removed by moving the line helpers to `features/wages/lines.ts`) |
| Unit tests | `cd app && npx vitest run` | 10 files, **40 passed** (was 33: +6 paidview, +1 photo 409) |
| Server tests | `cd server && npm test` | **30 pass, 0 fail** (was 26: +4 integrity; the same-day undo test was rewritten for the server date) |
| Browser tests | `cd app && npx playwright test` | **27 passed**, three full runs (12 mobile + 15 desktop; e2e 03, 04, 07 extended) |
| Build | `cd app && npm run build` | exit 0, precache 108 entries / 1320.72 KiB |
| Demo seed against the new rules | throwaway server (`PGSCHEMA=seedcheck`) + `node server/seed-demo.mjs` | accepted 34, rejected 0 |

## Behaviour changes to know

- **Locked months:** the owner can no longer correct an entry inside a locked month without unlocking first. The entry log shows a lock instead of the undo button.
- **Stock below zero:** stock can only go below zero when the owner types a reason. Operators are refused, by the app and by the server.
- **Old offline records:** records written by older app versions that would take stock below zero, or that are reversals inside a locked month, will now be rejected at sync and shown as "सर्वर ने नहीं माना" in the log.
- **Payments made before this change:** they lack the new snapshot fields. Their pay screen shows the base salary and one "हाज़िरी की कटौती" line instead of separate absence and half-day lines. The amounts come from the stored record.
- **Staff undo near midnight:** staff can only undo their own entries dated on the server's today. An entry made at 23:59 and undone after midnight is refused.

## New Hindi strings (for proofreading)

- `wages.negativeNet`: "कटौती कमाई से ज़्यादा है — इतना भुगतान नहीं हो सकता"
- `wages.attendanceDeduct`: "हाज़िरी की कटौती"
- `stock.overrideReason`: "माइनस में जाने की वजह"
- `stock.overrideHint`: "स्टॉक माइनस में जाएगा। वजह लिखें — यह इतिहास में दर्ज होगी।"
- `log.lockedMonth`: "महीना लॉक है — पहले खोलें"

Hinglish and English versions are in `wages.*.ts`, `stock.*.ts` and `desktop.*.ts`.

## Files

- **Server:**
  - `server/rules.mjs` (reversal, payment and stock rules; `stockMove`, `lockMonthsOf`)
  - `server/routes.mjs` (server day, stock balances, in-push unlock and stock bookkeeping, photo 409s)
  - `server/db.mjs` (`stockBalances`, non-overwriting `putPhoto`)
  - `server/test/integrity.test.mjs` (new), `server/test/rules.test.mjs`, `server/test/helpers.mjs`
- **App domain:**
  - `app/src/domain/wage.ts` (`buildSnapshot`, `paidView`, `liveView`, wage-sheet paid rows from the snapshot)
  - `app/src/domain/locks.ts` (`isRecordLocked`)
  - `app/src/domain/paidview.test.ts` (new)
  - `app/src/db/types.ts` (`WageSnapshot`, stock override fields)
- **App UI:**
  - `WagePayPage.tsx`, `features/wages/lines.ts` (new), `WorkerHomePage.tsx`, `LogPage.tsx`, `StockMovePage.tsx`
  - `sync/client.ts` + test
  - i18n: wages, stock, desktop × 3 languages
- **e2e:** `03-wages`, `04-stock`, `07-worker-page`, `fixtures.ts` (`setSalary`).
- **Docs:** `SPECS.md` (SPEC-M16), `docs/decisions.md` (DM-002 and DM-003 resolved), `docs/ARCHITECTURE.md` §7, `TASKS.md`, `WATCHINGLOGS.md`.

## Not done / limits

- **Independent review:** none. The sub-agent reviewers (`sp-reviewer`, `sp-final-reviewer`) are not installed in this environment, so I reviewed the diff myself.
- **Server cost per push:** the server now reads all stock records of the unit on every push that moves stock or contains a reversal. This is fine for one shop, but it adds to audit §9 P3-16 (sync performance).
- **Stock adjustments:** the server still accepts an empty adjustment note (audit §8.5). That was not part of this goal.
- **Local servers:** API :8791 (now serving the new build `index-lMfOqypx.js`) and dev app :5174 are running on the new code, against the local `public` schema, which none of the tests touched.
