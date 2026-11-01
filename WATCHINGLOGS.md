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

## 2026-10-23 — M06 deploy files, seed, full verification
- What: `render.yaml` (web service builds app + runs server which serves app/dist; Postgres; TRUST_PROXY, generated secret), `server/seed-demo.mjs` (demo unit via the public API: owner + staff logins PIN 1234, 4 workers of each pay type, 5 items, 3 orders incl. one overdue, month of attendance, advances, stock moves, deliveries; pushes each author's records with that author's token), `README.md`. Precache trimmed: exceljs chunk excluded from the service worker (fetched on first export). New sweeps: `e2e/20-desktop.spec.ts` (17 routes, no overflow, no page errors, tables at lg) and `e2e/21-phone-overflow.spec.ts` (17 routes × 3 languages).
- Evidence: `npx playwright test` → **11 passed** (9 mobile + 2 desktop, 42.7 s) · `npx vitest run` → 5 files / 15 passed · `cd server && node --test` → 12 / 0 · `npx vite build` → precache 90 entries / 1205.50 KiB · seed against a throwaway server → accepted 93, rejected 0 (first run rejected 78 `forged_author` → fixed by per-author tokens).
- Next: user connects Render; real-phone check; open PR mvp → main when they want the contribution graph to count.

## 2026-10-23 — Screenshot review fixes; final verification; pushed
- What: reviewed phone + desktop screenshots on seeded data (`docs/screenshots/`). Fixed: (1) language switch truncated the unit name on phones → short labels हिं / Hin / EN below md (aria-labels keep the full names); (2) after a joined phone logs in, the full pull waited for the 30 s timer → `loginWithPin` now runs `syncNow()` right after the token; (3) **shared-phone bug** surfaced by (2): records written by user A and still pending were pushed under user B's token → server rejected them as `forged_author` and they vanished from every screen → the sync client now pushes only the token holder's pending records; others stay pending until their author logs in (`src/sync/client.test.ts`, 2 tests); (4) a delivery linked to finished stock could exceed what is on hand → guarded; (5) demo seed finished 14 (was 6) so the 12 delivered do not go negative. Screenshot helper moved out of the suite (`app/scripts/screenshots.spec.ts.txt`).
- Evidence: `npx playwright test` → **11 passed** (40.8 s) · `npx vitest run` → 6 files / **17 passed** · `npx tsc --noEmit` → exit 0 · `npx vite build` → precache 90 / 1206.45 KiB · `cd server && node --test` → 12 / 0 · seed → accepted 93 / rejected 0 · home screenshot after fresh join+login shows live data (3/4 marked, ₹26,315 due, staff entries).
- Next: user connects Render (render.yaml); real Android check; PR `mvp` → main when wanted.

## 2026-10-23 — Round 2: worker page (SPEC-M07), one-year logins + UI polish (SPEC-M08)
- What: server `units.short_code` (6 digits), `worker_links` table, `GET /api/units/me`, `POST /api/worker-links` (+ `/revoke`), public `GET /api/w/shop/:code`, `POST /api/w/claim`, `GET /api/w/:token` (worker's own records only, access code never exposed; 410 when revoked; rate-limited). App: `/w/:token` (remember on phone), `/w` (4 tabs: इस महीने with expected pay, पगार grouped by year with slip lines, एडवांस, मेरी जानकारी with "मालिक से पूछें" wa.me and "यह मेरा फ़ोन नहीं है"), `/w/join` (shop code → name → 4-digit code, 3 big steps). Owner side: worker code on the record (`accessCode`, "नया कोड"), "लिंक भेजें / कॉपी / बंद करें" card, shop code in Settings. Tokens 365 d. Sync: push ~0.8 s after every local write (was: next 30 s tick) and the header badge now reads the live pending count. Polish: home hero with status chips, taller inputs + sticky save bar on phones, photo avatars, zebra month tables, login shop-name line + role chips + bigger PIN pad. Harness moved to API :8795 so the local demo on :8791 keeps running.
- Evidence: `cd server && node --test` → 16 / 0 · `npx vitest run` → 17 passed · `npx playwright test` → 11 passed + 02 spec re-run 2/2 after a selector fix (12/12 total) · `npx vite build` → precache 101 / 1248 KiB · screenshots (home, login, workers, worker page) reviewed.
- Next: restart the local demo server on the new server code; commit + push.

## 2026-10-23 — SPEC-M09 platform admin (founders)
- What: server `ADMIN_KEYS="name:key,…"` (admin disabled → 403), `POST /api/admin/login` (rate-limited, constant-time compare) → separate HMAC admin token (30 d, no unitId, refused by every unit endpoint), `GET /api/admin/units` (per-unit owner, shop code, logins, workers, records, entries + days this month, last activity), `GET /api/admin/units/:unitId` (all records, PIN hashes stripped). App: `/admin` (login, all-units table with totals + search), `/admin/units/:unitId` (overview tiles, logins, usage per user, workers incl. worker code and advance due, wage sheet, stock, orders, last 50 entries; month picker). English-only, read-only. README section; `server/.env.local-demo` (git-ignored) holds the local demo keys.
- Evidence: `cd server && node --test` → 20 / 0 (admin.test: wrong key 401, list + detail, admin token refused by /api/sync and /api/worker-links, 403 when unset) · `npx playwright test` → **13 passed** (08-admin: wrong key alert, units table, unit page, reload keeps session, log out) · `npx vitest run` → 17 passed · `npx vite build` → precache 107 / 1271 KiB · local demo restarted with ADMIN_KEYS, `/api/admin/login` → 200.
- Next: commit + push; user sets ADMIN_KEYS on Render when deploying.

## 2026-10-23 — Stale bundle after deploy (user screenshot: /admin showed the setup page)
- What: the browser served the previous build from the service-worker cache; the old bundle had no `/admin` route, so the router fell through to setup. Root cause: the plugin's auto-injected `registerSW.js` only registered the worker and never reloaded the page when a new worker took control, so every deploy needed a second manual reload. Fix: explicit `registerSW({ immediate: true })` from `virtual:pwa-register` in `main.tsx` (auto mode reloads on `activated`/`controlling` with `isUpdate`) plus an hourly `registration.update()` for long-open tabs; `vite-plugin-pwa/client` types referenced.
- Evidence: `dist/index.html` no longer references `registerSW.js`; the main chunk contains the reload-on-update logic. Scripted proof against the local demo: page loaded bundle `index-DHBJYhV2.js` → rebuilt with a change → `registration.update()` → page reloaded itself onto `index-a37VPJI3.js` ("UPDATE FLOW OK"). `npx playwright test` → 13 passed · tsc exit 0. Demo dist restored to the real build afterwards.
- Next: user reloads the stale tab once more (old page has no reload hook); after that updates apply automatically.

## 2026-10-31 — `main` replaced by `mvp` (old architecture removed from main)
- What: `main` now points at the `mvp` tip 7a1cc1a. The old main (ef25255: SQLite `node:sqlite` server, looms/thekedars/tauli/voice) is no longer on any branch. The user ran `git reset --hard origin/mvp` and `git push --force-with-lease origin main` themselves because the agent config denies `git reset --hard` and `git push`.
- Why: the user said the old main architecture was not the team's idea and chose Option 1 (make main identical to mvp, no archive branch).
- Evidence: `git ls-remote origin` shows HEAD, refs/heads/main and refs/heads/mvp all at 7a1cc1a90da0…; `git status -sb` → `## main...origin/main`; `git diff --stat origin/main origin/mvp` → empty. Push output: `+ ef25255...7a1cc1a main -> main (forced update)`.
- Recovery: the old main is reachable only through the local reflog (`git reset --hard ef25255`) until git garbage-collects it. GitHub may also keep it for a while.
- Leftovers (git-ignored, untouched): `server/data/` (1.7 MB, old SQLite DB), `server/tts/` (18 MB, old espeak TTS), and `app/node_modules` from the old dependency set. `server/node_modules` is missing, so the server needs `npm ci`.
- Next: `npm ci` in `app/` and `server/`, then run the tests on the new main. The user decides whether to delete the leftovers and whether to keep the `mvp` branch.

## 2026-10-31 — New main running locally
- What: `docker compose up -d db` (Postgres 16, healthy), `npm ci` in `server/` and `app/`, API `npm start` on :8791 (log /tmp/bunkar-server.log), app `npm run dev -- --host 0.0.0.0` on :5174 (log /tmp/bunkar-app.log). No ADMIN_KEYS set, so `/admin` answers 403.
- Why: user asked to start the servers and get the app link.
- Evidence: `/api/health` → 200 `{"ok":true,"status":"healthy"}` directly and through the :5174 proxy; `http://192.168.31.250:5174/` → 200; browser shows the MVP setup screen (हिंदी / Hinglish / EN, "नई यूनिट बनाएँ") with 0 console errors.
- Caution: :8791 also serves `app/dist`, which is a leftover build from the old main. Use :5174 until `npm run build` is rerun.
- Next: user creates a unit or asks for the demo seed.

## 2026-11-01 — Old-version leftovers deleted
- What: deleted `server/data/` (old SQLite DBs + old `.local-secret`), `server/tts/`, `app/dist/` (10 Oct old build), `app/test-results/`, `app/playwright-report/`, and on the Desktop `Bunkar_OS_Demo_Guide.html`, `Bunkar_OS_Demo_Photos/`, `Bunkar_OS_TEMP_Login.txt`. Ran `git reflog expire --expire=now --all && git gc --prune=now`. Rebuilt `app/dist` from the new main.
- Why: user chose option 3 ("3 yes"): remove everything from the old version, including local git history.
- Evidence: `ls` on all eight paths → "No such file or directory"; `git cat-file -t` on 962d754, f6d5c64, 1cb2470, ef25255 → "Not a valid object name"; refs all at 7a1cc1a. `npm run build` → precache 107 entries / 1277.77 KiB; 0 old-page markers in dist; :8791 serves `index-DHBJYhV2.js` (= new dist) and shows the MVP setup screen; :5174 200.
- Kept on purpose: SPECS.md out-of-scope mentions, `Responsive.tsx` / `useIsDesktop.ts` (in use; only comments say SPEC-019), Docker volume `startup_bunkar-mvp-pg`.
- Not possible from here: GitHub may still keep the old commits by SHA until it garbage-collects; a full purge needs GitHub Support.
- Next: user's choice (demo seed, admin keys, commit TASKS/WATCHINGLOGS).

## 2026-11-01 — Task 1: full test suite on the new main (branch `desktop-first`)
- What: created branch `desktop-first` from main 7a1cc1a. Ran typecheck, Vitest, server tests and Playwright. Fixed a date bug in two e2e tests: `03-wages` mixed local month (`getMonth`) with the UTC date (`toISOString`), so at 01:17 IST on 1 Nov every attendance mark was skipped and pay showed ₹11,000 instead of ₹10,020. It now runs AC1 in the previous IST month (always fully past) via new `istToday()` / `istPrevMonth()` helpers in `e2e/fixtures.ts`; `07-worker-page` uses `istToday()` too. App code unchanged.
- Why: user asked to complete task 1 (run all tests on the new main) before the desktop-first work.
- Evidence: `npm run typecheck` exit 0 · `npx vitest run` 6 files / 17 passed · `cd server && npm test` 20 pass / 0 fail · `npx playwright test` before fix 12 passed + 1 failed (03-wages, "Received ₹11,000"); after fix **13 passed** (11 mobile + 2 desktop, 53.3 s).
- Next: SPEC-M10 (gaps) and SPEC-M11 (security).

## 2026-11-01 — SPEC-M10 gaps + SPEC-M11 security (branch `desktop-first`)
- What: wrote SPEC-M10/M11 in SPECS.md (approved by the user's goal message). M10: Settings "छुट्टियाँ" card (owner adds/removes dates → new `setting` version, staff read-only), attendance shows "छुट्टी" / "रविवार" for the picked day (it showed nothing before), `monthOrders()` + `MonthReport.orderList`, 5th Excel sheet "Orders" with a bold total row, TASKS M03 → DONE. M11: server strips `pinHash`/`pinSalt` from every `/api/sync` response (bootstrap + authenticated + echo); a `user` push without them copies the stored ones, unknown user without them → `invalid_user`; photos PUT/GET need a user token once the unit has users. App: drops hashes locally after the server accepts (push and pull paths), one-time start-up scrub (`scrub.pin.v1`, pending records untouched), login asks the server when online (401 → wrong PIN + lockout, 429 → "बहुत ज़्यादा कोशिशें"), offline/no answer → this phone's own verifier (`bunkar.pin.<userId>`, stored after each good login and at unit creation), none → "इस फ़ोन पर पहली बार लॉगिन के लिए इंटरनेट चाहिए"; photo uploads send the token. Sub-agent dispatch was unavailable (`sp-implementer`/`sp-reviewer` not installed; `kiro_default` refused for crew stages), so I implemented directly.
- Why: user goal — finish the 4 follow-up tasks before the desktop-first work.
- Evidence: `cd server && npm test` 26 pass / 0 fail (new security.test 6/6: bootstrap + authenticated pull have no hash, edit without hash keeps login, invalid_user, photos 401 needs_login without token, other unit's token refused, bootstrap unit still unit-key-only) · `npm run typecheck` exit 0 · `npx vitest run` 8 files / 29 passed (new session.test 8, dashboard.test 4, export 5 sheets + totals) · seed against a throwaway server → accepted 31 / rejected 0 · `npx playwright test` **14 passed** (12 mobile + 2 desktop; new 09-holidays). Fixed test-only races found on the way: 09 used unscoped dialog selectors (now dialog-scoped + asserts the staff row), 08 read the admin page once before the owner's push landed (now reloads until the worker appears).
- Behaviour change to know: a phone that has never logged in a user online cannot log that user in offline (by design). The setup phone's owner can.
- Next: docs/ARCHITECTURE.md, then SPEC-M12 desktop-first.

## 2026-11-01 — docs/ARCHITECTURE.md + SPEC-M12 desktop-first UI (branch `desktop-first`, not committed)
- What: wrote `docs/ARCHITECTURE.md` (features, Dexie + Postgres schema, record types, API, server rules, login/PIN, sync, formulas, layouts, commands, limits). SPEC-M12 in SPECS.md from a screenshot review (`docs/screenshots/m12/before/`). Built: desktop shell (collapsible side menu remembered per device, "नई एंट्री" quick-entry menu filtered by role, user + logout in the menu, top bar with today's date, content up to 88rem); attendance roll-call table with keyboard (P/H/A or 1/2/3 mark and move down, + / − OT, ↑ / ↓), previous/next day, "आज", "सिर्फ़ बाकी"; entry log table + type filter (type filter on phones too); home panels "देने वाले ऑर्डर" and "कम स्टॉक"; context panels on the advance and stock forms. Phones keep their markup; P/H/A buttons now announce the full word ("हाज़िर (P)"). Fixes found on the way: (1) the log flagged almost every entry made after midnight IST as back-dated (compared the IST day with the UTC date) → compares IST days; (2) dark theme had white text on light fills at 2.37–3.01:1 → new `--color-on-fill` token (dark ink in dark mode), three light-theme soft backgrounds lightened to reach 4.5:1, info toast text fixed; (3) home "N एंट्री" link was 27×20 px → 44 px; (4) a login added on this phone but not yet synced was refused online (server said 401 before it knew the user) → its own pending hash is checked; (5) logout now pushes the user's pending entries first (≤ 4 s), so they are not stranded on a shared phone.
- Why: user goal — desktop-first UI that still works on phones, on a new branch, after the four follow-up tasks.
- Evidence: `npm run typecheck` exit 0 · `npm run build` exit 0 (precache 106 / 1315.38 KiB) · `npx vitest run` 9 files / 33 passed (new: theme contrast light + dark, pending-login case) · `cd server && npm test` 26/26 · `npx playwright test` **27 passed**, twice (12 mobile + 15 desktop: 01–09 now run in both projects; new 22-desktop-ux covers keyboard roll call, log table + type filter, quick entry + Esc, collapse survives reload, context panel, home panels, side-menu logout; desktop sweep 1024/1440/1920 × 3 languages with content clear of the menu; phone sweep 390/768 × 3 languages; 44 × 44 px target audit). Screenshot harness `app/scripts/shots.*` on seeded demo data: `docs/screenshots/m12/after/` at 390/768/1280/1440 × 19 routes → report 80 entries, 0 overflow, 0 page errors; dark + collapsed set checked by eye. Secret scan of the diff: 0 hits.
- Not done: independent sub-agent review — `sp-final-reviewer` / `sp-implementer` / `sp-reviewer` are not installed here and `kiro_default` is refused for crew stages; I reviewed the diff myself.
- Local servers: API :8791 restarted on the new code (serves the new `app/dist`, bundle index-DQtZphKl.js), dev app :5174 started; both health 200.
- Next: user reviews; commit `desktop-first` only after an explicit "yes".

## 2026-11-01 — Branch `desktop-first` committed (push pending)
- What: committed all M10/M11/M12 work, docs and screenshots as fcacb46 on `desktop-first` (190 files, +2974 / −233; author Pranjal Dubey). Ignored folders (dist, node_modules, test-results, playwright-report, .playwright-mcp) stay out.
- Why: user said "commit and push everything to the branch".
- Evidence: `git log --oneline -1` → fcacb46; `git status -sb` → `## desktop-first`, clean; staged-diff secret scan printed no matches. Push not run: `.kiro/agents/superpowers.json` denies `git push.*`.
- Next: user runs `git push -u origin desktop-first`; then a PR into main when wanted.

## 2026-11-01 — Product brief moved into steering
- What: moved the untracked root `PRODUCT.md` (CarpetOps product brief, 223 lines) to `.kiro/steering/product.md`. Content unchanged.
- Why: user asked to put it in `.kiro/steering/product.md`.
- Evidence: `ls .kiro/steering` → product.md 21354 bytes; `ls PRODUCT.md` → No such file; `git status` → `?? .kiro/` (not committed).
- Next: user decides whether to commit `.kiro/` and how to resolve the brief's out-of-date items (holidays screen, security, orders sheet now built; overtime still shown although the brief says hide it).

## 2026-11-01 — Audit of the code against the product brief
- What: wrote `docs/audit.md` (367 lines): every module and rule in `.kiro/steering/product.md` marked yes / partial / no with file:line references, conflicts with SPECS.md, data-model differences for docs/decisions.md, probe results, and a fix list in the brief's §9 order with new items slotted in. No code changed.
- Why: user asked for a full comparison of the codebase against the brief.
- Evidence: typecheck exit 0; `npm run lint` 0 errors / 53 warnings; vitest 9 files / 33 passed; server 26/26; e2e 27/27 cited from fcacb46 (`git diff fcacb46 -- app server` empty). A throwaway-schema probe (`/tmp/audit-probe.mjs`, not in the repo) confirmed: a reversal of an entry in a locked month is accepted; a back-dated staff reversal is accepted; a negative net is stored when rounding fills it; stock out with zero balance is accepted; another unit can take over a photo id (unit A then gets 404).
- Main gaps (P0): daily workers not paid for Sundays/holidays; overtime still shown everywhere; slip content wrong + no signature line; paid month's lines rebuilt from current data; locked month changeable via the log; not deployed.
- Next: user decides the three SPECS-vs-brief conflicts (overtime, paid off days, slip content), then specs for the P0 items.

## 2026-11-01 — Owner decisions recorded; specs and brief updated (docs only)
- What: created `docs/decisions.md` with D-001 overtime as an owner setting (default off), D-002 paid Sundays/holidays for daily workers (provisional business rule), D-003 short A4 slip with a signature line, all "decided by owner"; plus DM-001 (migrations run at server start), DM-002 (photo upsert overwrites ids), DM-003 (paid month's lines rebuilt from live data), each "needs confirmation". Details the agent had to assume are listed under each decision as "needs confirmation". SPECS.md: D2 (daily pay includes paid off days), D12 (overtime optional, off by default), M02 (formulas, screens, A4 slip, new AC5–AC7). `.kiro/steering/product.md`: §7 sizes (8,000 / 950 lines), auth model and test counts (26 / 33 / 27); holidays screen, security, Orders sheet, TASKS and desktop layout marked done; decisions written into 8.2, 8.3, 8.4 and §9. No code changed.
- Why: user gave the three decisions and asked for docs to match, then a local commit without push.
- Evidence: AC5 and AC6 checked by script (paid ₹9,846; Nov 2026 off days 8, 9, 15, 29 → ₹9,000); stale-phrase grep on the brief → none left.
- Next: plan and implement D-001..D-003 (TASKS row 21) after the user approves the plan.

## 2026-11-01 — Product direction: settings, overrides, operator toggles, carpet catalogue (docs only)
- What: brief `.kiro/steering/product.md` gets a "Product direction" section at the top (digital register; owner sees and edits everything; the unit chooses owner or operator; calculations are suggestions the owner can override with a logged reason; rules are per-unit settings with defaults; not yet custom fields or WhatsApp cards), a settings table, principles 8–9, operator role and toggles in §5, off-day policy setting in 8.3, slip sections and owner override in 8.4, new 8.10 finished carpet catalogue, backlog items 10a–10c. `docs/decisions.md` rewritten: P-000 direction; D-001 overtime setting; D-002 off-day policy (none / Sundays / Sundays and holidays, default Sundays and holidays, provisional); D-003 slip sections (fixed list, 8 on by default); D-004 owner override; D-005 operator toggles (defaults = today's staff limits); D-006 catalogue; DM-001…DM-003 kept, DM-004 added (finished items vs catalogue). Every assumed detail is marked "needs confirmation". SPECS.md: new D15; D2 and M02 point to the settings (AC4 changed, AC8–AC9 added); M00 roles, M03, M04, out-of-scope and A3/A6 updated; new SPEC-M13 (settings + permissions, AC1–AC8), SPEC-M14 (override, AC1–AC6), SPEC-M15 (catalogue, AC1–AC10). No code changed.
- Why: owner gave the product direction and asked for the documents to match, with a local commit and no push.
- Evidence: example amounts checked by script — off-day policy none / Sundays / Sundays and holidays → ₹7,400 / ₹8,600 / ₹9,000; override of the absence deduction ₹923.08 → ₹500 → gross ₹11,269.23, paid ₹10,269; `git status -- app server` empty.
- Next: owner confirms the assumptions marked in docs/decisions.md (most affect pay or privacy), then a plan for SPEC-M13, M14 and M15.

## 2026-11-01 — Local servers stopped
- What: stopped the API (:8791), the Vite dev app (:5174) and the Postgres container `bunkar-mvp-db` (`docker compose stop`, not `down`; volume `startup_bunkar-mvp-pg` kept).
- Why: user asked to stop the servers and continue later.
- Evidence: ports 8791, 5174 and 5432 free; container status "Exited (0)"; volume still listed.
- Next: to resume, `docker compose up -d db`, `cd server && npm start`, `cd app && npm run dev -- --host 0.0.0.0`. Open work: owner confirms the assumptions in docs/decisions.md, then a plan for SPEC-M13, M14, M15. Branch `desktop-first` still not pushed.

## 2026-11-02 — Local servers started again
- What: `docker compose up -d db` (healthy, same volume `startup_bunkar-mvp-pg`), API `npm start` on :8791 (log /tmp/bunkar-server.log), dev app `npm run dev -- --host 0.0.0.0` on :5174 (log /tmp/bunkar-app.log). Branch `desktop-first`.
- Why: user asked to start the servers.
- Evidence: `/api/health` 200 directly and through the :5174 proxy; `http://192.168.31.250:5174/` 200; :8791 serves bundle index-DQtZphKl.js (the desktop-first build).
- Next: owner confirms the assumptions in docs/decisions.md, then a plan for SPEC-M13, M14, M15.

## 2026-11-02 — Owner answers recorded: server-side price hiding, correction steps, catalogue exits (docs only)
- What: `docs/decisions.md` D-004 (overrides only before payment; a paid month is changed by unlock → reverse payment → pay again → lock, each with a reason), D-005 (toggles apply to all operators together; hidden values are removed by the server; stage 1 = "See prices" for orders and catalogue; no "See wages" toggle until server-side wage redaction exists; changing a toggle forces operator devices to resync), D-006 (exits: delivered, sold directly, written off, each with a date and a required note; status values extended), DM-004 decided (catalogue is the one place for new finished carpets; finished kind hidden in the item form; legacy label; no migration), D-002 notes on monthly pay. SPECS.md: M13 rewritten (stage 1 AC1–AC10, stage 2 described), M14 (correction steps, AC7–AC9), M15 (`carpet_out`, AC11–AC15 incl. sold directly, written off, limits, reversal, legacy), M02 AC5/AC6/AC8 point to the examples, M03 and A6 updated. Brief: direction bullets, settings table, §5 operator row, 8.4 override steps, 8.5 legacy items, 8.10 exits, backlog 10b–10d. New `docs/wage-examples.md` with exact inputs and expected values (Examples A, B, C). No code changed; no implementation plan written (user asked not to).
- Why: owner answered the open questions and asked for the documents to match.
- Evidence: example values recomputed by script with the formulas of `src/domain/wage.ts`: AC5 paid 984600 (rounding −15); AC6/AC8 gross 740000 / 860000 / 900000 (off days none / 8, 15, 29 / 8, 9, 15, 29); M14 gross 1126923, net 1026923, paid 1026900 (rounding −23); 1–4 Oct 2026 are Thu–Sun and 9 Nov 2026 is a Monday. Stale-phrase search across the three documents found nothing left.
- Next: implementation of M13 stage 1, M14 and M15 in a later session (TASKS rows 23–25); "See wages" is row 27 (later).

## 2026-11-02 — SPEC-M16 server integrity + paid month from the saved payment (branch `desktop-first`, local commit)
- What: (1) payments save a fuller snapshot; `paidView()` drives the pay screen, slip text, worker page and paid wage-sheet rows, so a paid month no longer moves when rates or attendance change; (2) reversals of entries in a locked month refused for everyone (`period_locked`), unlock first; log shows a lock mark instead of undo; (3) server refuses `negative_net`, `invalid_rounding` (> 50 paise), `negative_paid`; pay screen blocks negative net; (4) server keeps item balances and refuses stock out / negative adjust / finished delivery below zero (`insufficient_stock`) unless owner + `allowNegative` + `overrideReason`; owner form asks for the reason; (5) staff same-day undo compares with the server's IST date, so a back-dated undo is refused; (6) photo ids belong to the first unit: other unit → 409 `photo_id_taken`, other bytes → 409 `photo_exists`, nothing overwritten; client marks 409 photos rejected. Spec SPEC-M16 added; DM-002 and DM-003 marked resolved; ARCHITECTURE §7 updated; docs/run-summary.md written.
- Why: user goal 2026-11-02 (six criteria, each with a test; no push; no real-data database changes).
- Evidence: `cd server && npm test` 30 pass / 0 fail; `npx vitest run` 10 files / 40 passed; `npx playwright test` 27 passed on three full runs; typecheck exit 0; lint 0 errors / 53 warnings; build exit 0 (precache 108 / 1320.72 KiB); seed against a throwaway schema accepted 34 / rejected 0. All tests on throwaway schemas; local `public` untouched. Local API :8791 and dev app :5174 restarted on the new code (bundle index-lMfOqypx.js).
- Next: user review; push when the user asks (run by the user); owner confirmations still open in docs/decisions.md.

## 2026-11-02 — Owner-controlled settings and wage behaviour (D-001…D-005, SPEC-M13 stage 1, SPEC-M14, M02 AC5–AC9), branch `desktop-first`
- What:
  - Settings "पगार के नियम": overtime on/off (default off), off-day policy none / Sundays / Sundays and holidays (default the last), slip-section checklist with a live A4 preview.
  - Settings "ऑपरेटर क्या कर सकते हैं": 4 toggles (add entries, edit past, see prices, export). No "see wages" toggle.
  - Overtime is hidden on 8 screens while off and not paid in unpaid months.
  - Daily workers get paid off days (paid once; an explicit Absent removes the day).
  - Real A4 slip from the chosen sections, with an automatic Rounding row. The WhatsApp text has the same rows plus the worker-page link.
  - Owner override on any wage line before payment, with a reason. The four logged correction steps for a paid month.
  - The server enforces the operator toggles, strips prices for operators, keeps stored prices on operator edits, and returns a `view` that forces a resync.
  - Two bugs found by the new e2e tests and fixed: (1) the sync client pushed pending records in random id order, so an unlock / reverse / pay-again batch was refused (`period_locked`, `duplicate_payment`); it now pushes in written order, with a unit test; (2) the pay button was enabled without a required correction reason.
- Why: user goal (8 criteria, each with a test; local commit, no push, throwaway schemas only).
- Evidence:
  - typecheck exit 0; lint 0 errors / 53 warnings;
  - vitest 12 files / 61 passed; server 36/36;
  - Playwright 35 passed, twice (mobile and desktop; new specs 10, 11, 12);
  - build exit 0 (precache 112 / 1368.36 KiB); seed on schema `seedcheck` accepted 34 / rejected 0;
  - every docs/wage-examples.md example: actual = expected (new "Actual results" section).
  Details: docs/run-summary.md.
- Next: user review; owner confirms D-001 / D-002 / D-003 / D-005 assumptions; SPEC-M15 catalogue (TASKS 25); "see wages" stage 2 later (TASKS 27). Push is run by the user.
