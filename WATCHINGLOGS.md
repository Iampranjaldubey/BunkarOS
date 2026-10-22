# Bunkar MVP — Watching Logs (newest at bottom)

## 2026-10-23 — Project created; spec drafted for approval
- What: created `bunkar-mvp/` beside `BunkarOS/` with SPECS.md (SPEC-M00..M06 + decisions D1..D13), TASKS.md, AGENTS.md. No code yet.
- Why: user chose a fresh build limited to attendance, wages, inventory, orders, monthly analysis; MCQ answers recorded as decisions.
- Evidence: `ls bunkar-mvp` → AGENTS.md SPECS.md TASKS.md WATCHINGLOGS.md. Docker daemon OK (29.8.1), Node v24.22.0, remote Iampranjaldubey/BunkarOS reachable (main = ef25255).
- Next: user approves spec/assumptions → task 1 (scaffold + foundation).

## 2026-10-23 — M00 foundation built and verified; pushed to origin/mvp
- What: `app/` (React 19 + Vite 8 + TS + Tailwind v4 PWA, Dexie, 3-language i18n hi/hin/en, new teal/amber palette with dark scheme, responsive shell: bottom bar < lg, side rail ≥ lg), `server/` (Node 24 + pg, Postgres schema per env, rules: owner-only types, forged author, locked months, duplicate payment, staff reversal own-same-day, staff cannot change pay fields; static serving of app/dist), `docker-compose.yml` (Postgres 16). Screens: setup, login (PIN keypad), home stub, More, entry log (reverse with reason), settings (unit, language, theme, users, join code). Stand-in pages for M01–M05 routes.
- Why: SPEC-M00 approved; copied only PIN/session/sync/UI-kit foundation from BunkarOS (D1).
- Evidence: `npx tsc -p tsconfig.app.json --noEmit` → exit 0 · `npx vite build` → precache 53 entries / 1052 KiB · `cd server && node --test` → 12 pass / 0 fail · `npx playwright test` → 3 passed (mobile foundation ×2, desktop shell ×1). Fixed during verification: pg search_path race (now `options=-c search_path`), e2e schema reset moved into server boot (`PG_RESET=1`).
- Next: M01 workers + attendance.

## 2026-10-23 — M01 workers + attendance
- What: `domain/attendance.ts` (latest mark per worker/day, month summary with unmarked working days, Sundays/holidays excluded, pieces), `domain/advances.ts`; screens `/workers` (search, inactive toggle, table at lg), `/workers/new|:id/edit` (pay type monthly/daily/piece, OT default = salary ÷ W ÷ 8, staff cannot change pay fields), `/workers/:id` (month grid P/H/A/OT, advances, balance), `/attendance` (one screen, P/H/A toggles + OT stepper, all-present, piece entry sheet, re-mark = reverse + new with "edited" badge, locked-month guard). Dictionaries workers.{hi,hin,en}.
- Evidence: `npx vitest run src/domain` → 9 passed (attendance 4 + wage 5) · `npx playwright test e2e/02-workers-attendance.spec.ts` → 2 passed · tsc exit 0.
- Next: M02 wages screens (advance, wage sheet, pay + slip, lock).

## 2026-10-23 — M02 wages
- What: `domain/wage.ts` (computeGross monthly/daily/piece, settle with capped advance recovery + ₹1 rounding, wageSheet/sheetTotals), screens `/advances/new` (photo above limit, locked-month guard), `/wages` (month picker, tiles, cards/table, owner lock/unlock with confirm), `/wages/:month/:workerId` (line-by-line breakdown, deduction lines, recovery amount, mode, date, photo rule, confirm → wage_payment with snapshot; paid state shows slip text, WhatsApp preview-and-confirm, print). Fixed a real defect found by the run: copied ResponsiveTable called a hook after an early return (React "static flag" error when a list went 0 → n).
- Evidence: `npx vitest run src/domain` → 9 passed (AC1: ₹12,000, W=26, 2A 1H 3h OT @ ₹58, ₹1,000 advance → paid ₹10,020, rounding −15 p) · `npx playwright test e2e/03-wages.spec.ts` → 1 passed (same numbers on the real screens, slip "दिया: ₹10,020", lock refuses attendance) · tsc exit 0.
- Next: M03 inventory.

## 2026-10-23 — M04 orders + M05 dashboard/monthly/export
- What: `domain/orders.ts` (views with delivered/pending, auto-delivered, overdue/due-soon, amount pending, timeline, counts), screens `/orders` (open/all, overdue first, table at lg), `/orders/new|:id/edit` (buyer sheet inline, auto ORD-nnn, price total), `/orders/:id` (start/finish/deliver qty with over-delivery guard and finished-stock link, notes, WhatsApp status preview), `/buyers`. `domain/dashboard.ts` (dashboard + monthReport incl. usage evidence D13), `/` owner home tiles that each open their records, `/month` (attendance grid, wage sheet, stock movement, orders, cash/UPI out, usage per user; Excel export via exceljs with 4 sheets; print). Fixed: month toolbar overflowed on 390 px (export button unreachable) → toolbar wraps below the title; exceljs pre-bundled (`optimizeDeps.include`).
- Evidence: `npx vitest run` orders 2/2, export 1/1 (workbook re-read, 4 sheets, row 2 = worker) · `npx playwright test e2e/05-orders.spec.ts e2e/06-dashboard-month.spec.ts` → 2 passed (20 → deliver 12 → pending 8 → deliver 8 → delivered; ₹40,000 pending; overdue first; tiles; `Bunkar_Ideal_Carpet_YYYY-MM.xlsx` downloaded) · tsc exit 0.
- Next: M06 deploy files + full verification.
