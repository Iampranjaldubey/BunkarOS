# Run summary: owner-controlled unit settings and wage behaviour

- **Date:** 2026-11-02 (IST). Branch `desktop-first`, committed locally, not pushed.
- **Scope:** D-001 to D-005 in `docs/decisions.md`; SPEC-M13 stage 1 (wages are not hidden from operators); SPEC-M14; SPEC-M02 AC5–AC9.
- **Previous run summary (SPEC-M16):** `git show 4c83c0a:docs/run-summary.md`.
- **Data:** every test ran on a throwaway Postgres schema:
  - `t_<random>` for each server test file;
  - `e2e` for Playwright;
  - `seedcheck` for the demo seed.
  The local `public` schema (the user's data) was not touched.

## Acceptance criteria and evidence

| # | Criterion | Built in | Test that proves it |
|---|---|---|---|
| 1 | **Owner-only unit settings with defaults:** overtime off; off-day policy `sundays_and_holidays`; the 8 slip sections; operator toggles add entries on, edit past off, see prices on, export off. Only these 4 toggles are shown; there is no "see wages" toggle. | `domain/settings.ts` (`unitRules`), Settings → "पगार के नियम" and "ऑपरेटर क्या कर सकते हैं" (`features/settings/RulesCards.tsx`); server `invalid_setting`, owner-only `setting` | Vitest `rules.test.ts` "SPEC-M13 AC1" (2 tests). e2e 10 "unit rules: defaults…" checks the switch states, the 8 checked sections, 4 switches and that `perm-seeWages` is absent. Server `permissions.test.mjs` "settings validation". |
| 2 | **Overtime off:** hidden on the worker form, attendance, wage sheet, pay page, slip, month report, Excel export and worker page. Recorded hours are not paid in unpaid months. | `wageInputsFor` zeroes overtime when the setting is off; every listed screen checks `rules.overtimeEnabled` | e2e 10 checks all 8 screens with overtime off, including the Excel headers read back with exceljs, the printed slip and the worker's own page. It then turns overtime on and sees the field, stepper and month column come back. e2e 03: the same recorded 3 h gives ₹9,846 with overtime off and ₹10,020 with it on. Vitest "AC5 overtime off → … ₹9,846". e2e 10 also checks that a new worker's `otRatePaise` is 0. |
| 3 | **Off-day pay:** AC8 gives ₹7,400 / ₹8,600 / ₹9,000; AC5 and AC6 pass. A paid off day is paid once when the worker is Present, Half or unmarked; an explicit Absent removes it. | `paidOffDays()` in `domain/attendance.ts`; daily pay in `domain/wage.ts`; "₹" days in the month grid; off-days line on the pay page and in the wage-sheet counts | Vitest Example B for each policy (off days and gross exact), AC6 for piece and monthly workers, and "paid once / Absent removes". e2e 10 "off-day policy…" checks the pay page amount and the off-days line under each of the 3 policies. Values: `docs/wage-examples.md` "Actual results". |
| 4 | **Slip:** a real A4 page with the chosen sections; a Rounding line only when it is non-zero; the WhatsApp text has the same fields plus the worker-page link. | `features/wages/SlipPaper.tsx`, `slipContent()` and `slipText()` in `features/wages/lines.ts`, print CSS in `index.css` | Vitest `lines.test.ts` (5 tests): default sections, rounding row only when non-zero, AC9 sections, overtime section only while on, WhatsApp text = same rows + link. e2e 11: in print media the slip is 794 × 1123 px (210 × 297 mm), shows the 8 sections and the Rounding row, and the screen breakdown is hidden. On desktop, `page.pdf` gives exactly 1 page with a 595 × 842 pt MediaBox. The share dialog shows the same rows plus `…/w/<token>`. AC9: attendance summary on and signature off take effect on the next print, and the change appears in the log. |
| 5 | **Owner override:** any line before payment, with a required reason written to the log. M14 examples pass. After payment the pay screen shows the saved snapshot. | `settle(…, overrides)`, `overrideError`, pay-page "बदलें" sheet, `paidView` with overrides, log lines for overrides and the four correction steps | Vitest Example C (exact amounts, stored `overrides`, `paidView`), plus override limits. Server "M14 overrides" and "M14 correction steps". e2e 11 covers AC1, AC2, AC4, AC5, AC6, AC7, AC8 and AC9 (see "SPEC-M14 coverage" below). |
| 6 | **Operator limits** enforced by the server, not only on screen. | Server `rules.mjs`: `forbidden_permission`, `forbidden_reversal`, `reason_required`, `forbidden_override`, `forbidden_price`. `routes.mjs` strips prices for operators, copies stored prices into operator edits and returns `view`. The app resyncs when `view` changes. Screens use `can(role, action, perms)`. | Server `permissions.test.mjs`: addEntries (`forbidden_permission`), editPast (accepted when on; `forbidden_reversal` when off, including back-dated), seePrices AC5–AC7 (pull and echo without prices, stored price kept, `forbidden_price`). Vitest `client.test.ts` resync tests. e2e 12 runs on two operator devices: defaults; export off/on; edit past on (operator's undo accepted); add entries off (radios disabled, entry buttons gone); see prices off while an operator entry is pending offline (resync, no `pricePaise` in IndexedDB, pending entry still synced); due-date edit keeps the stored price on the owner's device; the second operator gets the same view; prices on again brings them back; no "बदलें" for operators. |
| 7 | **Checks:** typecheck, lint, unit, server and browser tests all pass. | — | See "Checks". |
| 8 | **Docs.** | `docs/wage-examples.md` (new "Actual results" section), this file | — |

### SPEC-M14 coverage in e2e 11
- **AC1:** ₹923.08 → ₹500 with a reason gives ₹10,269. The stored payment matches Example C.
- **AC2:** the save button stays disabled without a reason.
- **AC4:** an override that makes net negative blocks the confirm button.
- **AC5:** the log shows "बदला: ग़ैरहाज़िरी की कटौती −₹923.08 → −₹500 (…)" and the worker page marks the line "मालिक ने बदला".
- **AC6:** the salary stays 1,200,000.
- **AC7:** the reversal is refused while the month is locked. Then: unlock, reverse, pay again with a correction reason and a new override, lock again. Each step has a reason, the log shows them in order, the reversed payment is struck through, the worker page shows only ₹10,077, and no record is rejected.
- **AC8:** no reason means the button is disabled for the unlock, the reversal, the re-payment and the re-lock.
- **AC9:** a paid month has no "बदलें".

## Checks (final run, 2026-11-02)

| Check | Result |
|---|---|
| `npm run typecheck` (app) | exit 0 |
| `npm run lint` (app) | 0 errors, 53 warnings (same as the baseline) |
| `npx vitest run` | 12 files, 61 passed |
| `cd server && npm test` | 36 tests, 36 pass, 0 fail |
| `npx playwright test` (mobile 390×844 + desktop 1440×900) | 35 passed, twice in a row (4.6 min each); new specs 10, 11 and 12 run in both projects |
| `npm run build` | exit 0, precache 112 entries / 1368.36 KiB |
| Demo seed on schema `seedcheck` | accepted 34, rejected 0 |

## Bugs found by the new tests and fixed
- **Push order (sync client):** pending records were pushed in random id order. In one batch, a payment reversal could reach the server before the unlock that allows it, and be refused with `period_locked`. Similarly, a new payment could arrive before the reversal of the old one and be refused with `duplicate_payment`. Records are now pushed in the order they were written (`at`, then `id`). New Vitest "push order" test; it fails without the fix.
- **Pay button:** the confirm button was enabled when a correction reason was required but empty. The app now disables it (SPEC-M14 AC8).

## Behaviour changes to know
- **Overtime is off by default** for every unit, including existing ones (a missing setting means off). Recorded hours stay in the data and the log. They are not paid in unpaid months until the owner turns overtime on. Months already paid keep their stored overtime.
- **Daily workers' off days are now paid** by default: Sundays and listed holidays from the joining date, unless marked Absent. This is still provisional (D-002) and changes daily workers' pay in every unpaid month.
- **Unlocking a month needs a reason.** Re-locking a month that was locked before also needs one.
- **Operators:** settings are visible read-only. Operators can view attendance even when "add entries" is off, but cannot mark it.
- **The entry log** lists "महीना खोला" and "भुगतान वापस" as their own rows. A setting row lists what changed (overtime, policy, slip sections, operator toggles).

## New Hindi strings (for proofreading)
All 107 new keys are in `app/src/i18n/rules.hi.ts`, with Hinglish and English in `rules.hin.ts` and `rules.en.ts` (the same key set; checked by script). The main ones:

| Where | Strings |
|---|---|
| Settings | पगार के नियम · ओवरटाइम · चालू / बंद · छुट्टी के दिन की पगार (रोज़ वाले कारीगर) · कोई नहीं / रविवार / रविवार और छुट्टियाँ, with one-line examples · पर्ची में क्या छपे · हमेशा · पर्ची का नमूना · नियम सेव करें · ऑपरेटर क्या कर सकते हैं · एंट्री भरना · पुरानी एंट्री बदलना · भाव देखना · Excel फ़ाइल बनाना, with their hints · ऑपरेटर की छूट सेव करें |
| Pay page | {line} बदलें · रकम बदलें · {line} · हिसाब से · नई रकम (₹) · बदलने की वजह · बदलाव रखें · हिसाब वाली रकम वापस लें · मालिक ने बदला · दोबारा भुगतान की वजह · भुगतान बदलना है? · महीना लॉक है — पहले पगार शीट पर महीना खोलें · भुगतान वापस लें · वापस लेने की वजह · महीना खोलने की वजह · लॉक करने की वजह · पर्ची प्रिंट करें (A4) |
| Slip | कुल कमाई · कटौती · एडवांस काटा · राउंडिंग · दिया · हाज़िरी · छुट्टी के दिन (पगार वाले) · कारीगर के दस्तख़त · मालिक के दस्तख़त · अपना पूरा हिसाब यहाँ देखें: {url} |
| Log | बदला: {line} {from} → {to} ({reason}) · दोबारा भुगतान: {reason} · महीना खोला: {month} · भुगतान वापस: {name} · {month} · वजह: {reason} |
| Other | डेटा नया हो रहा है (resync badge) · पगार वाली छुट्टी (month grid) · the attendance keyboard hint without overtime |

Two strings name the net row differently: `slip.opt.net` "कुल भुगतान" in the settings checklist and `slip.sec.net` "दिया" on the slip. Please confirm both.

## Files
- **New:**
  - `app/src/domain/settings.ts`, `app/src/app/useCan.ts`
  - `app/src/features/settings/RulesCards.tsx`, `app/src/features/wages/SlipPaper.tsx`
  - `app/src/i18n/rules.{hi,hin,en}.ts`
  - tests: `app/src/domain/rules.test.ts`, `app/src/features/wages/lines.test.ts`, `server/test/permissions.test.mjs`, `app/e2e/10-wage-rules.spec.ts`, `app/e2e/11-override.spec.ts`, `app/e2e/12-operator.spec.ts`
- **Changed:**
  - wage engine (`domain/wage.ts`, `domain/attendance.ts`), permissions (`domain/permissions.ts`)
  - sync client (view and resync, push order)
  - server (`rules.mjs`, `db.mjs`, `routes.mjs`)
  - screens: attendance, workers, worker page, wages, pay page, month and export, orders, settings, log, home, navigation
  - print CSS
  - e2e 02, 03 and 22 now turn overtime on first; the desktop project also runs specs 10–19
- **Docs:** `docs/wage-examples.md`, `docs/decisions.md` (D-003 rounding row and WhatsApp link), `SPECS.md` (M02 slip text, index statuses, M14 reason code), `.kiro/steering/product.md` (statuses), `TASKS.md`, `WATCHINGLOGS.md`.

## Not done / limits
- **"See wages" (SPEC-M13 stage 2)** is not built. There is no toggle, and operators see wages as before.
- **Stock-in rates** are not hidden by "see prices" (stage 1 covers orders and the catalogue). The catalogue itself (SPEC-M15) is not built, so the server's carpet price rules have no screen yet. The server test covers them with raw records.
- **Export off** is a screen-only control. The export only contains what the device already holds.
- **Data already on a phone** cannot be taken back from a phone that never syncs again or runs a modified app (SPEC-M13 known limit).
- **The AC6 / AC8 calendar** (November 2026) is the current month, so e2e checks the same rule on the previous month's calendar. The exact November amounts are checked in Vitest.
- **Sub-agent review:** `sp-implementer`, `sp-reviewer` and `sp-final-reviewer` were not used this run. I reviewed the diff myself, and the browser tests caught the two bugs above.
- **Needs owner confirmation** (still open in `docs/decisions.md`):
  - D-001: recorded overtime is not paid in unpaid months.
  - D-002: the provisional default policy, and "paid once".
  - D-003: the fixed sections, the automatic Rounding row and the WhatsApp link.
  - D-005: "edit past" covers any user's past entries.
