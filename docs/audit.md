# Audit: codebase vs product brief

- **Brief:** `.kiro/steering/product.md` (CarpetOps product brief, 223 lines).
- **Code audited:** branch `desktop-first` at `b908edb`. The app and server code are identical to `fcacb46` (`git diff fcacb46 -- app server` is empty).
- **Date:** 2026-11-01. No code was changed for this audit.
- **Match:** **yes** = the code does what the brief says · **partial** = some of it, or only in the browser and not enforced by the server · **no** = missing or different · **n/a** = not a code item.
- **Paths:** file references are relative to the repo root; `app/src/…` is shortened to `src/…`.

## 0. Summary

Most of what the brief marks **Built** is built. Most items it marks **Gap** or **Planned** are still missing, except for four that are now done: the holidays screen, the security hardening, the Orders sheet and the TASKS update. The brief is also out of date in the other direction: it calls several finished things gaps.

The problems that matter most for partners are all about pay:

1. **Sundays and holidays are not paid to daily workers.** Daily pay is present days × rate, so an unmarked Sunday earns nothing.
2. **Overtime is still everywhere** (worker form, attendance, wage sheet, slip, export, worker page). The brief marks it [Confirmed] as not used.
3. **The wage slip has the wrong content.** It lists attendance, piece and overtime lines, has no gross line for monthly workers and no signature line. There is no A4 slip layout.
4. **A paid month can show numbers that do not match what was paid.** The pay screen rebuilds the line items from today's rates and attendance, not from the saved snapshot.
5. **A locked month can be changed through the entry log.** Undoing an entry dated inside a locked month is accepted.

A probe against a throwaway test server also confirmed four server-side gaps (§16):
- the server stores a negative net when the rounding field makes the sum add up;
- it does not check stock balances;
- staff can undo their own old entries by back-dating the undo;
- a photo id can be taken over by another unit.

## 1. Name

| Item | Brief | Code | Match | Evidence |
|---|---|---|---|---|
| Product name | "CarpetOps" is the working name; [Open] pick one | "Bunkar" / "बुनकर" everywhere; "CarpetOps" appears nowhere | n/a (open decision) | `src/i18n/hi.ts:3`, `src/i18n/en.ts:3`, `app/vite.config.ts:16-17`, `app/index.html:10`, env `BUNKAR_SECRET` |

## 2. Partner practice [Confirmed]

| Practice | Code | Match | Evidence |
|---|---|---|---|
| Wages paid monthly | Monthly settlement per calendar month, one payment per worker and month | yes | `src/domain/wage.ts` (`wageSheet`), `server/rules.mjs:67` |
| Mix of daily-wage and piece-rate workers | Pay types monthly / daily / piece | yes | `src/db/types.ts:57` |
| **Overtime is not used** | Overtime hours and rate are entered, paid and shown on 8 screens | **no** | see §8.2 |
| **Sundays and holidays are paid** | Daily workers get nothing for off days | **no** | see §8.3 |
| Tracks wool, cotton/jute yarn, dye, other raw material, finished carpets | Generic items, kind raw / finished, units kg / pcs / litre / metre | yes | `src/db/types.ts:73-76` |
| Order stages New → In production → Finished → Delivered | Same four statuses | yes | `src/db/types.ts` (`OrderStatus`), `src/domain/orders.ts:24` |
| Wages handed out by printed sheet, WhatsApp, cash with signature | Print of the screen; WhatsApp after preview; **no signature line** | partial | `src/features/wages/WagePayPage.tsx:90`, `:120`; no signature string in `src/i18n` |
| Hindi and English matter equally | हिंदी (default), Hinglish, English everywhere except the founders' admin | yes | `src/i18n/*.{hi,hin,en}.ts` |

## 3. Value proposition

| Item | Match | Evidence / note |
|---|---|---|
| Correct monthly wage, shows how each number was calculated | partial | The breakdown exists (`WagePayPage.tsx:81-88`), but after payment it is rebuilt from current data (see §8.4). |
| Prevents silent changes | partial | Append-only records with reversals; but photos can be overwritten (§16 P5) and locked months can be changed by reversal (§16 P1). |
| Tracks advances and recovers them correctly | yes | `src/domain/advances.ts`, `src/domain/wage.ts:46-47` |
| Shows stock and due / overdue orders | yes | `src/features/stock/StockPage.tsx`, `src/domain/orders.ts:34` |
| Phone, offline, proper PC layout with tables and printing | partial | Phone, offline and PC layout: yes (SPEC-M12). Printing: screen print only, no A4 slip or sheet layout (`src/index.css:133-137`). |
| Hindi by default, simple for a munshi | yes | default `hi`; 48 px targets on phones, 44 px on desktop (e2e `20-desktop` target audit) |

## 4. Business context

These are not code items. What the code provides toward them:

| Item | Match | Evidence |
|---|---|---|
| Link faculty can open | no | Not deployed. `render.yaml` exists. |
| Usage evidence | yes | Usage records for owner opens of `/` and `/log` (`src/app/AppLayout.tsx`), per-user entries in the month report (`src/features/month/MonthPage.tsx:119`) and in the admin pages |
| Feedback log, pricing conversation, written confirmations | n/a | outside the code |
| Billing not built; invoices manual | yes | No billing code (as the brief intends) |

## 5. Users and roles

| Role | Brief | Code | Match | Evidence |
|---|---|---|---|---|
| Owner | Everything | All actions | yes | `src/domain/permissions.ts:10-18` |
| Staff | Add entries; cannot change settings, users or pay rates, lock or export; undo own same-day entries | App: yes. Server: settings, users, lock and pay rates enforced; export is in the browser only; same-day undo can be bypassed by back-dating the undo | partial | `server/rules.mjs:28`, `:33`, `:39`; probe P2 in §16 |
| Worker | Read-only page by link or shop code + name + code | Built | yes | `server/routes.mjs` (`handleWorkerData`), `src/worker/*`, e2e `07-worker-page` |
| Founders' admin | Read-only, only with `ADMIN_KEYS` | Built; 403 without keys | yes | `server/routes.mjs:362`, e2e `08-admin` |
| Faculty / demo viewer | Gap; demo unit for now | No viewer role (`Role = 'owner' \| 'staff'`); demo seed script exists | no (as the brief says) | `src/db/types.ts:7`, `server/seed-demo.mjs` |

## 6. Product principles

| # | Principle | Match | Evidence |
|---|---|---|---|
| 1 | Wage correctness first; pure, tested, explainable | partial | Pure engine with tests (`src/domain/wage.ts`, `wage.test.ts` 5 tests). Gaps: a paid month's lines are rebuilt live (§8.4); a negative net is not blocked in the app (§16 P3). |
| 2 | Nothing silently changed; append-only | partial | Records are insert-only on the server, and edits become a reversal plus a new record (`AttendancePage.tsx:68`). Gaps: photos can be replaced under the same id (`server/db.mjs:187`, §16 P5); locked-month entries can be reversed (§16 P1). One deliberate exception: the phone strips PIN fields from its own copy of `user` records (SPEC-M11, `src/sync/client.ts:366`). |
| 3 | Hindi first; no hard-coded user-facing strings | partial | Almost every string comes from `src/i18n`. Hard-coded: the OT stepper labels "+0.5h" / "−0.5h" (`AttendancePage.tsx:198,200,265,267`), the "P/H/A/OT" column heads in the export (`src/features/month/export.ts:26`), and the admin pages, which are English-only by design (SPEC-M09). |
| 4 | Works with bad connectivity | yes | Dexie first, sync later (`src/db/repo.ts`, `src/sync/client.ts`) |
| 5 | Simple for the munshi; big targets | yes | 48 px phone / 44 px desktop targets checked by e2e `20-desktop` ("targets are at least 44 × 44 px") |
| 6 | PC is first-class; wage sheets, reports and printing on desktop | partial | Desktop layout, tables and keyboard attendance (SPEC-M12, e2e `22-desktop-ux`). No print-specific layout for the slip or wage sheet (`src/index.css:133-137`). |
| 7 | Nothing beyond the MVP list | yes | Nothing from §10 or §11 is in the code (case-insensitive grep for invoice, gst, thekedar, loom, tauli, barcode, razorpay, stripe in `app/src` and `server`: only a false hit inside `setLangState`) |

## 7. Architecture (as built)

| Claim | Code today | Match | Evidence |
|---|---|---|---|
| App about 4,000 lines in `app/src` | 8,031 lines of non-test `.ts`/`.tsx` | partial (out of date) | `find app/src … \| grep -v .test. \| xargs cat \| wc -l` |
| Server about 700 lines | 951 lines in `server/*.mjs` (including `seed-demo.mjs`) | partial (out of date) | `cat server/*.mjs \| wc -l` |
| Bottom bar on phones, side menu and tables from 1024 px; three languages; light / dark / auto | yes, plus a collapsible menu, quick entry and dark-mode contrast fix | yes | `src/app/AppLayout.tsx`, `src/components/ui/SideNav.tsx:12,37`, `src/theme.contrast.test.ts` |
| Unit key stored as scrypt hash; 6-digit shop code | yes | yes | `server/auth.mjs:9`, `server/db.mjs:62` |
| 4-digit PIN; tokens 365 days; issued by the server | yes; since M11 the server also checks the PIN when online | yes | `server/token.mjs:7`, `src/app/session.tsx:120` |
| Worker pages by revocable link or shop code + worker code | yes | yes | `server/db.mjs` (`createWorkerLink`, `revokeWorkerLinks`) |
| Tables: units, records, photos, worker_links, meta | yes | yes | `server/db.mjs:26-41` |
| Append-only `records`; edits = new version; corrections = reversal; `seq` cursor | yes. The server also runs one UPDATE right after insert to write `serverSeq` into the JSON | yes | `server/db.mjs` (`insertRecord`) |
| Record envelope fields | All listed fields present | yes | `src/db/types.ts:24-39` |
| Money in paise, quantities in thousandths | yes | yes | `src/db/types.ts:1-4`, `src/domain/qty.ts` |
| Server rules (author, owner-only, staff limits, locked month, one payment, wage arithmetic, validation, idempotent) | All present. Gaps: reversals bypass the lock; the arithmetic check allows a negative net; no stock check | partial | `server/rules.mjs:14-81`; §16 |
| API list | Matches, and adds `GET /api/units/me` | yes | `server/routes.mjs:93-119` |
| Tests on record: server 20, Vitest 17, Playwright 13 | Now server 26, Vitest 33, Playwright 27 | partial (out of date) | §17 |

## 8. Features and rules by module

### 8.1 Setup and login

| Rule | Match | Evidence |
|---|---|---|
| Owner creates unit (shop name, own name, 4-digit PIN) | yes | `src/app/session.tsx:39`, `src/app/SetupPage.tsx`, e2e `01-foundation` |
| Another phone joins with unit code + key | yes | `src/app/session.tsx:55`; screenshot harness joins this way (`app/scripts/shots.spec.ts`) |
| PIN keypad login; explicit logout | yes | `src/app/LoginPage.tsx`; logout on the More page and in the desktop side menu (`SideNav.tsx`, e2e `22-desktop-ux`) |

### 8.2 Workers and attendance

| Rule | Match | Evidence |
|---|---|---|
| Worker record: name, phone, job, pay type + rate, OT rate, joining date, photo, active, 4-digit code | yes | `src/db/types.ts:59-68` |
| One-screen daily attendance P / H / A, "all present", piece entries | yes | `src/features/attendance/AttendancePage.tsx:71` (all present), piece sheet; desktop keyboard table (`:89`) |
| Re-marking a day replaces the earlier mark, shown as edited | yes | `AttendancePage.tsx:68` (reverse + `replaces`), e2e `02-workers-attendance` |
| Worker page: month grid, advances, last payment, balance | yes | `src/features/workers/WorkerDetailPage.tsx` + `MonthGrid.tsx` |
| Whole-shop month grid with fast editing | **no** | The month report grid is read-only (`src/features/month/MonthPage.tsx:68`). The desktop attendance table edits one day at a time. |
| **Hide overtime; default OT rate zero; keep code and data** | **no** | OT is entered and shown in `WorkerFormPage.tsx:55,108-109` (default = salary ÷ W ÷ 8 at `:54`), `AttendancePage.tsx` (stepper, column, `+`/`−` keys), `WagesPage.tsx:49,75-76`, `WagePayPage.tsx:85,103`, `MonthPage.tsx:74,89`, `export.ts:26-34`, `WorkerDetailPage.tsx:140`, `src/worker/WorkerHomePage.tsx:89,124,150`. SPECS.md D2/D12 still say overtime is paid; see §14. |

### 8.3 Paid Sundays and holidays

| Rule | Match | Evidence |
|---|---|---|
| Owner-only screen to edit the holiday list | yes (new, SPEC-M10) | `src/features/settings/SettingsPage.tsx:91,96,122`; staff read-only; e2e `09-holidays` |
| Sundays are the default weekly off | yes | Sundays are skipped when counting unmarked days (`src/domain/attendance.ts`, `monthAttendance`) |
| **Daily workers: each paid off day counts as one paid day (from joining date, unless marked Absent)** | **no** | `src/domain/wage.ts:30-33`: gross = present × rate + half × ½ rate. `monthAttendance` does not count off days. |
| Piece-rate workers get nothing for off days | yes (by accident: nothing is added for anyone) | `src/domain/wage.ts:34` |
| Show paid off days distinctly in month grid, wage sheet and slip | no | Off days are a grey "·" (`src/features/workers/MonthGrid.tsx:17`). No paid-off-day line in the wage sheet or slip. |
| Pure functions with tests | n/a until built | |
| [Open] mid-month joiners; absence around an off day | open | not decided |

### 8.4 Advances and wages

| Rule | Match | Evidence |
|---|---|---|
| Advances any day, cash / UPI, photo above limit | yes | `src/features/wages/AdvanceNewPage.tsx:40-41` |
| Month wage sheet with totals | yes | `src/features/wages/WagesPage.tsx`, `src/domain/wage.ts` (`sheetTotals`) |
| Monthly formula: salary − absent × (salary ÷ W) − half × ½ of that | yes | `src/domain/wage.ts:25-27`; AC1 in `wage.test.ts` and e2e `03-wages` (₹10,020) |
| Daily formula: present × rate + half × ½ rate | yes (but see 8.3) | `src/domain/wage.ts:30-31` |
| Piece: Σ count × rate | yes | `src/domain/wage.ts:34`, `src/domain/attendance.ts` (`monthPieces`) |
| Overtime: hours × rate | yes, but the brief says hide it | `src/domain/wage.ts:23` |
| Net = gross + OT − deductions − advance; paid = net rounded to ₹1 | yes | `src/domain/wage.ts:48-49`, `src/domain/money.ts:42-48` |
| Advance recovery ≤ what remains of the pay | yes in the app; the server does not check recovery against the outstanding advance | partial | `src/domain/wage.ts:46-47`; `server/rules.mjs:58-66` checks arithmetic only |
| Pay screen: breakdown, deduction lines, adjustable recovery, WhatsApp after preview, print | yes | `WagePayPage.tsx` |
| Owner locks / unlocks; locked month refuses new entries | partial | New entries are refused (`server/rules.mjs:47-48`, probe P1). **Reversals of entries dated in a locked month are accepted**, and the owner can do this from the entry log (`src/features/log/LogPage.tsx:48` has no lock check). |
| One payment per worker per month | yes | `server/rules.mjs:67`, `rules.test.mjs:47` |
| **Paid history from the stored snapshot; never recompute a paid month from current rates** | **partial** | Totals use the saved payment. But on the pay screen the line items, the P/H/A/OT line and the monthly "base" line are rebuilt from live `inputs` / `breakdown` (`WagePayPage.tsx:50-51,81-88`). The `snapshot` saved at `:75` is read only by the worker page (`src/worker/WorkerHomePage.tsx:150`). The month report and export also take P/H/A from live attendance (`export.ts:33`). |
| [Open] Never store a negative net | **partial** | The pay screen does not stop deductions from exceeding gross. The server rejects the record the app builds (`invalid_amounts`), so the payment fails only after sync. A crafted record whose rounding fills the gap **is stored** (probe P3). |
| [Open] advance recovery style, half day = ½, piece rates by design | open | current behaviour as the brief describes |
| **Wage slip content: business, worker, month, gross, advance recovered, deductions, net, signature line; no attendance or piece details; A4 print first** | **no** | Slip text `src/i18n/wages.hi.ts:14` + lines `WagePayPage.tsx:81-88`: monthly shows base + absence / half-day deductions instead of a gross line; daily and piece show days or pieces × rate; OT and rounding lines are included; no signature line (no such string in `src/i18n`). Print is `window.print()` of the screen page (`:120`), with no A4 slip layout (`src/index.css:133-137`). |

### 8.5 Inventory

| Rule | Match | Evidence |
|---|---|---|
| Items: name, kind, unit, low-stock level, active | yes | `src/db/types.ts:73-76` |
| Quantities in thousandths | yes | `src/domain/qty.ts` |
| Stock in with quantity, rate, supplier | yes | `src/features/stock/StockMovePage.tsx` (`stock_in`) |
| Stock out with reason, linked to worker or order | yes | same file (`stock_out`) |
| Adjustment with reason and mandatory note | partial | The app requires the note. The server only checks that `note` is a string, so `""` passes (`server/rules.mjs:73`). |
| Finished carpets in | yes | route `/stock/move/finished` (`StockMovePage.tsx`) |
| **Over-issue blocked; only the owner can override** | **partial** | App only (`StockMovePage.tsx:60,69`). The override records no reason. **The server does not check the balance** (probe P4), so two phones offline, or a modified client, can go below zero. |
| Photo required for stock-in above the limit | yes | `StockMovePage.tsx:61-62` (also always for wastage) |
| Corrections by undo with reason; staff own same-day only | partial | App: yes (`LogPage.tsx:48`). Server: back-dated undo slips through (probe P2). |
| Live balance + low-stock flag | yes | `src/domain/stock.ts:19`, `stockRows` |
| Monthly ledger per item | yes | `src/domain/stock.ts:27`, `ItemDetailPage.tsx` |
| Low stock on Home, stock in month report and Excel Stock sheet | yes | `HomePage.tsx:56` + "कम स्टॉक" panel (`:132`), `MonthPage.tsx:103`, `export.ts:39` |
| Delivery can take from finished stock, not more than on hand | yes (app only) | `src/features/orders/OrderDetailPage.tsx:53` |
| Finished carpets by design + size | partial (as the brief says) | items only, no fields |
| Opening stock import | no (Planned) | no import code |

### 8.6 Buyers and orders

| Rule | Match | Evidence |
|---|---|---|
| Buyer, design, size, qty, due date, price, notes | yes | `src/db/types.ts` (`OrderP`, `BuyerP`) |
| Order numbers `ORD-001`, editable | yes | `src/domain/masters.ts:34-36`, `OrderFormPage.tsx` |
| Status flow; partial deliveries; auto Delivered | yes | `src/domain/orders.ts:24`, e2e `05-orders` |
| Delivery ≤ pending and ≤ finished stock on hand | yes (app only) | `OrderDetailPage.tsx:52-53` |
| Overdue and due-within-7-days flags, overdue first | yes | `src/domain/orders.ts:7,34` |
| Notes timeline; WhatsApp status after preview | yes | `orderTimeline`; `OrderDetailPage.tsx:14,59` |
| Money tracking: keep only optional price | yes | only `pricePaise` and the derived amount pending |

### 8.7 Home, month report, log and export

| Rule | Match | Evidence |
|---|---|---|
| Home tiles open their records | yes | `HomePage.tsx:53-58`, e2e `06-dashboard-month` |
| Pending-delivery **quantity** tile (Planned) | partial | The tile counts *orders* that are finished with pending quantity (`src/domain/orders.ts:50`), not carpets. |
| Month report: attendance grid, wage sheet, stock, orders, cash / UPI out, usage | yes | `MonthPage.tsx:68,83,103,119` |
| Entry log: who, when, **old value**, filter by user, undo with reason | partial | Who, when, user filter (plus a type filter) and undo are built (`LogPage.tsx:63,94`). The old value appears only as a separate struck-through row; `log.old` / `log.new` strings exist but are unused. |
| Excel export (brief: 4 sheets; Orders sheet Planned) | yes, now **5 sheets** including Orders with totals | `export.ts:17,23,28,39,44`; `export.test.ts` |
| CSV export (Planned) | no | no CSV code |
| Print layouts | partial | `.no-print` + basic print CSS only (`src/index.css:133-137`). The phone bottom bar has no `no-print` class (`src/components/ui/BottomNav.tsx:13`). |
| Photos: JPEG, long edge ≤ 1280 px; required above the limit for advances, payments, stock-in | yes | `src/db/photos.ts:6-7`; `AdvanceNewPage.tsx:41`, `WagePayPage.tsx:58`, `StockMovePage.tsx:62` |

### 8.8 Worker's own page

| Rule | Match | Evidence |
|---|---|---|
| Link or shop code + name + 4-digit code; this month, pay history with slip lines, advances, ask the owner; owner can send, copy, cancel, regenerate | yes | `src/worker/WorkerHomePage.tsx:27-28,88-90`, `server/routes.mjs` (`handleWorkerShop`, `handleWorkerClaim`, `handleWorkerData`), e2e `07-worker-page` |
| Note | — | The worker page's slip lines also show OT (`WorkerHomePage.tsx:89`); see 8.2. |

### 8.9 Founders' admin

| Rule | Match | Evidence |
|---|---|---|
| Read-only English view of every unit and unit page; only with `ADMIN_KEYS` | yes | `server/routes.mjs:100,362,371`, `src/admin/*`, e2e `08-admin` |

## 9. Backlog status (section 9 of the brief)

| # | Item | Status in code | Match |
|---|---|---|---|
| P0-1 | Paid Sundays and holidays for daily workers | Holiday list editable; pay unchanged | no |
| P0-2 | Hide overtime; default OT rate 0 | Not done | no |
| P0-3 | Verify wage slip content + signature line | Verified: content differs and there is no signature line | no |
| P0-4 | Rerun all tests on the deploy machine | All pass locally (§17); no deploy machine yet | partial |
| P0-5 | Deploy with HTTPS, backups, env vars; real phone + PC test | Not deployed. `render.yaml` uses free plans, and its database expires after 90 days (`render.yaml:27`). It deploys branch `mvp` (`:9`), which does not have this branch's work. No backup set-up. No `docs/DEPLOY.md`. | no |
| P0-6 | Demo unit with fake data | Seed script works (accepted 31 / rejected 0 on 2026-11-01); nothing hosted | partial |
| P1-7 | Security: PIN hashes, photos | Done (SPEC-M11): `server/db.mjs:231`, `server/routes.mjs:239`, `src/app/session.tsx:106,120`, `server/test/security.test.mjs` 6/6. Remaining: §16 P2 and P5. | yes (residual gaps) |
| P1-8 | Test offline sync with two phones and rejected-record cases | Server tests cover locked month and second payment (`server/test/rules.test.mjs:32,47`); client tests cover shared-phone push (`src/sync/client.test.ts`). No two-phone offline e2e, no e2e of how a rejected record looks. The offline Playwright project named in SPEC-M06 is not in `app/playwright.config.ts`. | partial |
| P1-9 | Read-only viewer role for faculty | `Role = 'owner' \| 'staff'` only | no |
| P1-10 | Update TASKS.md (stock built) | Done (`TASKS.md` row 4) | yes |
| P2-11 | Orders sheet, CSV export, pending-delivery tile | Orders sheet done; CSV no; tile counts orders, not quantity | partial |
| P2-12 | Design and size fields for finished carpets | No | no |
| P2-13 | Excel / CSV import | No | no |
| P2-14 | Editable whole-shop month grid | No (read-only grid) | no |
| P3-15 | Mixed pay type | No (`src/db/types.ts:57`) | no |
| P3-16 | Sync performance | Each sync reads all reversals, locks and payments of the unit (`server/db.mjs:154,173,180`, called at `server/routes.mjs:177-185`) | no |

## 10. Out of scope

| Item | Match | Evidence |
|---|---|---|
| No invoicing / GST, order payments, payment gateway, billing, multi-branch, AI, barcodes, supplier management, native apps | yes | none found (same grep as §6.7) |

## 11. Later ideas (do not build)

| Item | Match | Evidence |
|---|---|---|
| Thekedar, loom wool issue, loom check-ins, exporter link, voice slips, compliance | yes (none built) | The old architecture that had them was removed on 2026-10-31 (WATCHINGLOGS) |

## 12. Deployment and operations

| Rule | Match | Evidence |
|---|---|---|
| Node service + Postgres + HTTPS | partial | Server serves `app/dist` and `/api` (`server/index.mjs`); HTTPS comes from Render; not deployed |
| App can be hosted separately with CORS configured | partial | CORS origins are hard-coded to localhost:5174 / 4174 (`server/routes.mjs:37`), with no env setting |
| Set `BUNKAR_SECRET` explicitly | partial | `render.yaml:22` generates one; locally the server silently creates and stores its own secret when the variable is missing (`server/token.mjs:22-26`) |
| Document env vars in `docs/DEPLOY.md` | no | file missing; README and `docs/ARCHITECTURE.md` §12 list some |
| No automatic migration on push; a human applies migrations | **differs** | The server creates and alters tables on every start (`server/db.mjs:26-41`, `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`). See §15. |
| Backups + tested restore before real data | no | nothing configured or documented |
| Photos in Postgres `bytea`; watch size | yes | `server/db.mjs:34` |
| Paid database tier once partners enter data | no | `render.yaml:27` free plan |

## 13. Definition of done (section 14)

| Item | Match | Evidence |
|---|---|---|
| One full real month matches the partner's own calculation | not verifiable yet | blocked by P0-1, P0-2 and P0-3 |
| Daily workers paid for Sundays and holidays | no | §8.3 |
| Stock and order statuses correct after a week of real use | not verifiable yet | the logic is tested (`stock.test.ts`, `orders.test.ts`, e2e 04 and 05) |
| All tests, typecheck, lint and build pass | yes, with 53 lint warnings | §17 |
| Live link on phone and PC with HTTPS, backups, demo unit | no | not deployed |
| Three independent partners with confirmations and usage | n/a | outside the code |

## 14. Conflicts with SPECS.md (intended behaviour: needs your decision)

The brief says it wins on intended behaviour and asks to report disagreements. These three disagree with approved specs:

1. **Overtime.** Brief [Confirmed]: not used, hide it, rate 0. SPECS.md D2 and D12 (user, 2026-10-23): overtime in hours with a per-worker rate, added to pay.
2. **Paid off days.** Brief [Confirmed]: Sundays and holidays are paid. SPECS.md M02: daily pay = present × rate, and holidays do not change W.
3. **Wage slip.** Brief [Confirmed]: gross, advance, deductions, net and a signature line, with no attendance or piece details. SPECS.md M02 AC4: "slip text lists every line".

## 15. Data-model and operations differences (brief §0: record in `docs/decisions.md`)

The brief says code, tests and migrations are authoritative about the data model, and that differences should be recorded in `docs/decisions.md`. That file does not exist yet. Differences found:

1. **Migrations run automatically at server start** (`server/db.mjs:26-41`). They are additive only (no drops, except `PG_RESET=1`, which the code refuses on the `public` schema). The brief §12 says a human applies migrations.
2. **The photo store is an upsert** (`server/db.mjs:187`): the same id overwrites the bytes and even moves the photo to another unit (§16 P5).
3. **The `wage_payment.snapshot` is stored but is not the source for the pay screen's line items** (§8.4).

## 16. Server behaviour confirmed by probe

Method: a script in `/tmp` (not in the repo) started a test server on a throwaway Postgres schema, which it dropped afterwards, using `server/test/helpers.mjs`. Output, verbatim:

```
newEntryInLockedMonth        → ["period_locked"]   (refused, correct)
reversalOfLockedMonthEntry   → []                  (accepted)
staffReversalDatedToday      → ["forbidden_reversal"]
staffReversalBackDated       → []                  (accepted)
negativeNetAsAppBuildsIt     → ["invalid_amounts"]
negativeNetWithRoundingFill  → []                  (accepted: net −₹1,000 stored)
stockOutWithZeroBalance      → []                  (accepted)
unitBPutSameIdStatus         → 200, unitAGetAfterwards → 404
sameUnitReuploadStatus       → 200
```

| # | Finding | Cause |
|---|---|---|
| P1 | An entry dated in a locked month can be reversed, which changes that month's numbers. The owner can do this from the entry log. | `reversal` is not in `MONEY_TYPES` and the target's month is not checked (`server/rules.mjs:5,29-34`); `LogPage.tsx:48` has no lock check |
| P2 | Staff can undo their own entry from any past day by dating the undo on that day | the server compares the target's day with the undo's day, not with today (`server/rules.mjs:33`) |
| P3 | A negative net can be stored if the rounding field makes the sum add up; the app's own negative-net payment is rejected only after sync | `server/rules.mjs:58-66` allows a negative `netPaise`; `WagePayPage.tsx:143` has no guard |
| P4 | The server accepts stock out with no stock | no balance check in `server/rules.mjs` |
| P5 | Another unit (or any user of the same unit) can overwrite a photo by reusing its id; the original unit then gets 404 | `ON CONFLICT (id) DO UPDATE SET unit_id = …, bytes = …` (`server/db.mjs:187`). Photo ids are random UUIDs, so this needs the id, but it breaks both "nothing silently changed" and unit isolation. |

## 17. Checks run for this audit (2026-11-01)

| Check | Result |
|---|---|
| `cd app && npm run typecheck` | exit 0 |
| `cd app && npm run lint` (oxlint) | 0 errors, 53 warnings (39 `react(only-export-components)`, 11 `react(set-state-in-effect)`, 3 `eslint(no-unsafe-optional-chaining)`) |
| `cd app && npx vitest run` | 9 files, 33 passed |
| `cd server && npm test` | 26 pass, 0 fail |
| `cd app && npx playwright test` | 27 passed, run twice at `fcacb46` (code identical to this commit; WATCHINGLOGS 2026-11-01). Not rerun now because port 5174 is in use by the local dev server. |
| `cd app && npm run build` | exit 0 at `fcacb46` (precache 106 entries / 1315.38 KiB) |

## 18. Prioritised fix list (follows section 9)

Items keep the brief's numbers. **New** items come from this audit and sit in the band their impact puts them in. ✔ = already done.

**P0 — before partners rely on it**
1. **Paid Sundays and holidays for daily workers** (brief 8.3). Needs your decision on §14.2 and the two [Open] cases (mid-month joiners, absences around an off day). Then: count paid off days from the joining date in `monthAttendance`, add them in `computeGross` for daily pay, and show them in the month grid, wage sheet and slip. Pure functions with tests.
2. **Hide overtime and default the OT rate to 0** (brief 8.2). Needs your decision on §14.1. Keep the code and data; hide the fields and lines on the screens listed in §8.2; pay should be unchanged for anyone with no OT recorded.
3. **Wage slip content and signature line** (brief 8.4). Slip = business, worker, month, gross, advance recovered, deductions, net, signature line; an A4 print layout first and WhatsApp second. Needs your decision on §14.3.
   - **New 3a:** build a paid month's slip and breakdown from `wage_payment` + `snapshot`, never from current rates or attendance (`WagePayPage.tsx:50-51,81-88`; `export.ts:33`).
   - **New 3b:** stop a negative net in the pay screen, and have the server refuse `netPaise < 0` (§16 P3).
4. **Rerun all tests on the deploy machine.** All pass locally today (§17).
5. **Deploy with HTTPS, backups and env vars**, then test on a real phone and a real PC. Point `render.yaml` at the branch that has this work. Use a paid database tier before real data. Set `BUNKAR_SECRET` explicitly. Write `docs/DEPLOY.md` (env list, backup and restore steps, migrations happen at start, see §15.1). Make CORS origins configurable if the app is ever hosted separately.
6. **Hosted demo unit for faculty**, using `server/seed-demo.mjs` on the deployed server.
   - **New 6a (wage correctness):** refuse a reversal whose target is dated in a locked month, except the lock's own reversal (= unlock), on both server and entry log (§16 P1).

**P1**
7. ✔ Security hardening (SPEC-M11). Remaining:
   - **New 7a:** photo store must not overwrite an existing id or move it between units; refuse a re-upload with different bytes (§16 P5).
   - **New 7b:** check staff same-day undo against the server's current IST day (§16 P2).
   - **New 7c:** server-side stock check for stock out, negative adjustments and deliveries, with the owner override recorded with a reason (§16 P4; brief 8.5). Also require a non-empty adjustment note on the server.
8. **Two-phone offline sync and rejected-record tests**: an e2e with two browser contexts offline, then sync with a locked month and a second payment, and check how the rejection shows in the log.
9. **Read-only viewer role for faculty.**
10. ✔ TASKS.md updated.

**P2**
11. Orders sheet ✔. **CSV export**: not built. **Pending-delivery tile**: switch from counting orders to carpets (quantity).
12. Design and size fields for finished carpets.
13. Excel / CSV import for workers, items and opening stock.
14. Editable whole-shop month attendance grid.
   - **New 14a:** entry log shows the old and new value side by side for edits (the `log.old` / `log.new` strings already exist).
   - **New 14b:** move the remaining hard-coded strings into i18n ("+0.5h" / "−0.5h" labels, export column heads).
   - **New 14c:** clear the 53 lint warnings.

**P3**
15. Mixed pay type.
16. Sync performance: stop re-reading all reversals, locks and payments on each sync.

**Housekeeping**
- Update the brief: §7 sizes and test counts; mark the holidays screen, security, Orders sheet, TASKS and the desktop layout as Built; record the name decision (§1).
- Create `docs/decisions.md` with §15, marked "needs confirmation".
- **Proofread the Hindi strings added since 23 Oct** (brief §15): `login.needsInternet`, `login.rateLimited`, the five `settings.holiday*` strings (`src/i18n/hi.ts`), and all 38 strings in `src/i18n/desktop.hi.ts` (side menu, attendance table, log table, home panels, form context panels).
