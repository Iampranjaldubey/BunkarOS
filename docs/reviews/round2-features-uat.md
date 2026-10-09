# Bunkar OS P0 — Round 2 Features + UAT Review

**Reviewer:** `r2_features_uat` (fresh, independent; READ-ONLY on repo except this file)
**Date:** 2026-10-09
**Build:** `app/` (React 19 + Vite 8 PWA) · `server/` (zero-dep Node 24 API)
**Method:** All 19 PRD P0 features + A2 mock checked against SPEC-000..013 acceptance criteria and decisions D1–D9, then a scripted live UAT (Playwright scripts in `/tmp/r2feat/`, never in the repo) across owner / munshi / thekedar / weaver personas, **with sync to a real server**, plus a **two-device join** scenario.

## Ports & hygiene
- vite dev **:5202** (assigned), API **:8787** started only while holding `/tmp/bunkar-e2e.lock` (mkdir … / rmdir … always released). Playwright suite used its own webServer under the same lock.
- All servers I started are terminated; lock released; `:8787` and `:5202` confirmed clear at end. No repo files modified except this report. `app/src/db/types.ts` untouched.

## Evidence base (commands + exact output)

| Check | Command | Result |
|---|---|---|
| App typecheck | `cd app && npx tsc -p tsconfig.app.json --noEmit` | `TSC_EXIT=0` (no diagnostics) |
| Domain/unit tests | `cd app && npx vitest run` | **15 files / 83 tests passed**, 0 fail |
| Server API tests | `cd server && node --test` | `tests 37 · pass 37 · fail 0` |
| E2E suite | `cd app && npx playwright test` (under lock) | **26 passed (1.1m)**, `EXIT=0` (25 mobile + 1 offline-preview) |
| Live UAT (owner, 6-step projections + sync) | `/tmp/r2feat/uat.mjs` on :5202 + API :8787 | see below |
| Two-device join + sync-down | `/tmp/r2feat/join.mjs` + direct `curl` to API | **BLOCKER found** (see below) |
| Public slip 404s | `fetch('/api/slips/short')`, `/api/slips/AAA…(30)` | both **404** |

### Live UAT measured values (owner device, after demo seed + sync)
```
owner.login            => lands on owner home '/'
owner.afterSync        => { total:156, pending:0, synced:156, rejected:0 }   // M3 clean sync
A1.pieces              => { count:12, p03status:"on_loom", exporter:"Sharma Exports", design:"Kashan 14" }
E1.pieceYarn03         => { issuedG:12000, returnedG:0 }   // seed holds ONE 12kg; live loop adds 2nd (see 03-demo-loop)
board (loomBoard)      => { on_track:17, slow:3, idle:3, free:1 }   // K2 == SPEC == A2 mock
roker.today            => { opening:4250000, closing:3450000, cashOut:800000 }   // ₹42,500 → ₹34,500 (O1)
peshgi.rafiq           => { bal:500000 }   // ₹5,000 (C5)
seeded bazaars (C3/E2) => short grams 243/467/355 (tauli computed, non-hardcoded)
slip.token len         => 22   // C8/C9
weaver.publicSlip      => { hasGross:T, hasPaid:T, hasAgree:T, hasDispute:T }
weaver.agreeClicked    => true  → owner.slipResponseSynced => { count:1, roles:["weaver"] }   // C8 round-trip via server
slip.badToken          => { short:404, unknown:404 }   // C8 SPEC-009 AC-6
A2.exporter            => { hasSharma:T, hasKashan:T, legend:[17,3,3,1], noObeetee:T, noZiegler:T }
A2.notFound (ZZ-999)   => { friendly:T, echoesId:false }   // SPEC-013 AC-4 no reflected input
```
> The live **6-step bazaar** (issue 2nd 12 kg → return 1.100 → bazaar 96×119 → tauli short 0.613 → wage ₹3,014.54 / net ₹1,954.54 / paid ₹1,955 / rounding 46 → UPI payment → roker ₹34,500 → digest bazaarCount 1 / UPI ₹1,955) is executed and **asserted end-to-end** by `e2e/03-demo-loop.spec.ts`, which **passes** in the 26-green suite. My owner UAT confirms the seed preconditions and projections around it; the digest "today" shows 0 bazaars only until the operator records the live bazaar (by design — backdated seed), which the e2e then does.

---

## Per-feature compliance (19 P0 + A2)

Legend: **AC** = pass / partial / fail.

| ID | Feature | AC | Evidence | Gap |
|----|---------|----|----------|-----|
| **M1** | Hindi-first low-literacy UI | pass | Default `hi`; EN toggle; big tabular numerals; red/green tokens; 48px taps. `e2e/01-setup-roles.spec.ts`, `smoke.spec.ts`. | — |
| **N1** | Append-only audit log | pass | `/audit` lists every record w/ author/role/time; reversed+rejected ignored by projections; `records.test.ts` (4). | Hash-chain explicitly deferred (PRD "later"). |
| **N2** | Locked roles + device binding | partial | `permissions.test.ts` (5); munshi rate edit read-only + server rejects non-owner `rate` (`server/test`); reverse-own-today vs any in `repo.reverse`. | **Device-binding ("one device per login") not implemented** — SPEC-001 Scope-Out defers to P1 (only a `device` id is stamped). Documented deviation, acceptable for P0 but not a literal PRD-N2 pass. |
| **M3** | Offline queue + sync badge | pass | `addRecord` → `sync:'pending'`; UAT `owner.afterSync {pending:0,synced:156,rejected:0}`; `e2e/05-offline.spec.ts`, `05b`; `sync/client.test.ts` (9). | — |
| **M5** | Photo mandatory on high-risk | pass | Deduction photo mandatory; payment/peshgi > ₹2,000 blocked w/o photo — `e2e/09-m5-photo-guards.spec.ts` a+b; seeded deduction now carries a real `dedPhotoId` (`seed.ts`). | — |
| **B1** | Loom registry | pass | 24 looms w/ photos; `listLooms`; `e2e/02-masters.spec.ts`, `08-settings-thekedar.spec.ts`. | GPS lat/lng optional, not wired to `LoomNewPage` UI (schema supports). P1 (TASKS "Remaining"). |
| **C1** | Weaver register w/ photo ID | pass | 24 weavers w/ photos, father/village/phoneType/upi; name-collision demo (3× Mohammad Rafiq). `02-masters.spec.ts`. | — |
| **A1** | Order → pieces | pass | UAT `A1.pieces {count:12, exporter:"Sharma Exports", design:"Kashan 14"}`; lifecycle `pieces.test.ts` (7); `07-exporter-mock.spec.ts`. | — |
| **E1** | Yarn issue/return + balances | pass | UAT `pieceYarn03 {issuedG:12000}` seed + live 2nd 12kg/return in `03-demo-loop.spec.ts` → used 22.900; `06-edge-cases.spec.ts` c (over-return). | — |
| **C2** | Rate card + lock | pass | ₹38/₹40 effective dates, D2 lock `rates.test.ts` (4); munshi read-only + server reject (`01-setup-roles.spec.ts`). | sqft/sqgaj only (piece/kg/day = P1, SPEC-006 lite-cut). |
| **C3** | Bazaar entry | pass | Live wizard produces gross 301454/net 195454/paid 195500/rounding 46 (`03-demo-loop.spec.ts`); 2nd bazaar/piece server-rejected (`server/test`). | — |
| **E2** | Tauli variance | pass | D1 formula; demo tauli used 22900/allowed 687/short 613/extra 0 (`03-demo-loop.spec.ts`, `tauli.test.ts` 7). | — |
| **C5** | Peshgi ledger | pass | UAT `peshgi.rafiq {bal:500000}`; ₹1,000 recovery in `03-demo-loop.spec.ts`; over-recovery blocked `06-edge-cases.spec.ts` b; `peshgi.test.ts` (3). | — |
| **C8** | Hindi wage slip + agree/dispute | pass | UAT public slip gross/paid/agree/dispute present; **agree stored as `slip_response` role weaver and synced back to owner** (`owner.slipResponseSynced {count:1}`); bad/short token 404; `04-slip-public.spec.ts`, `slip.test.ts` (9). | — |
| **C9** | Voice wage slip | partial | On-page Hindi `speechSynthesis` TTS + wa.me text link (D3). `04-slip-public.spec.ts`. | Not a server-generated **audio clip** (literal PRD C9). D3 reframe documented in SPEC-009 Scope-Out — accepted deviation, not a literal pass. |
| **B2** | Check-in / % woven | pass | `/checkin/new` scoped loom picker via `visibleLoomIds`; `08-settings-thekedar.spec.ts`; `pieces.test.ts`, `board.test.ts`. | — |
| **O1** | Daily roker | pass | UAT `roker.today {opening:4250000, closing:3450000}` (₹42,500→₹34,500); net-paid-only post (D7); reversal drops posting `06-edge-cases.spec.ts` g; `roker.test.ts` (3). | Bank split deferred (cash/UPI only). |
| **K2** | Owner home loom board | pass | UAT `board {17,3,3,1}` == SPEC-000/012/013 == A2 legend; `board.test.ts` (6). | "Looms free in next N days" (PRD K2) not shown — P1. |
| **K1** | 8 pm digest | pass | `/digest` + PreviewShareSheet; `03-demo-loop.spec.ts` asserts `bazaarCount:1, upiPaidPaise:195500` after live bazaar; `digest.test.ts` (3). | Monthly sq-ft rollup (PRD K1) not present — P1. |
| **A2** | Static exporter mock | pass | UAT `A2.exporter` reads **real seeded EX-118** (Sharma/Kashan 14, 12 pieces, legend 17/3/3/1 from `loomBoard`, no Obeetee/Ziegler); not-found never echoes id. `07-exporter-mock.spec.ts` (both cases). | Static for P0; live portal post-P0. |

---

## UAT walkthrough — per persona

**Owner (Imtiaz Ansari / 1234):** full 6-step loop reachable; projections exact (above). Demo seed → 156 records → sync up → all synced, 0 rejected. ✓

**Munshi (Munshi Ram / 2222):** big action tiles; rates read-only; roker/digest/audit reachable; cannot edit rates/settings. ✓ (`01-setup-roles.spec.ts`, `permissions.test.ts`).

**Thekedar:** `visibleLoomIds` scoping proven; add-user sheet binds `thekedarId` (`08-settings-thekedar.spec.ts` — created thekedar sees exactly his 12 looms; login renders scoped loom option). ✓

**Weaver (public, fresh context, no login):** `/s/:token` renders Hindi slip + TTS + सही/गलत; **Agree round-trips to the server and syncs back to the owner as a `slip_response` (role weaver)**; bad/short tokens 404. ✓

**Exporter (public):** `/o/EX-118` read-only, real data, legend 17/3/3/1, safe not-found. ✓

### Two-device scenario — **FAIL (blocker)**
Scripted: owner creates unit, seeds, adds a munshi login user, syncs up (156 records). A **second browser context JOINS** with the real unit code + key (`joinUnit`), lands on `/login`, then calls `syncNow()` and reloads.

Measured (`/tmp/r2feat/join.mjs`):
```
owner.afterSync        => { total:156, pending:0, synced:156 }
device2.joined         => { url:".../login" }        // join succeeds
device2.afterSyncDown  => { total:0, users:[], orders:[], weavers:0, looms:0 }   // ← pulled NOTHING
device2.munshiLogin    => { ok:false }               // /login shows zero users → cannot pick/login
```
Direct API reproduction (fresh unit, `curl`):
```
POST /api/units                                   → {ok:true, created:true}
POST /api/sync (unit key only, 1 user record)     → accepted (bootstrap: unit had no users)
POST /api/sync (unit key only, NO token, pull)    → HTTP 401 {ok:false,error:"needs_login"}
```
Root cause: `server/routes.mjs:291-297` — once a unit `hasUsers`, **every** `/api/sync` (including a pure pull) requires a Bearer token. A freshly joined device has the unit key but **no token**, and cannot obtain one: the token endpoint needs `{userId, pin}`, but the login screen's user list (`app/src/app/session.tsx:115 listLoginUsers`) reads **only local IndexedDB**, which is empty after join. `app/src/app/LoginPage.tsx:28-37` never triggers a bootstrap pull. **Chicken-and-egg: a second device can never see the login users, so it can never log in, so it can never sync.**

---

## Scores

### Features: **9 / 10**
Engines are strong and fully tested (83 vitest + 37 server + 26 e2e all green; tsc clean). Every P0 surface exists, is Hindi-first and offline-first, the money/tauli math is exact, the board/A2/seed are unified at 17/3/3/1 (the old 15/5-vs-17/3 inconsistency is gone), the roker reproduces ₹34,500, A2 reads real data with safe not-found, and the slip agree/dispute round-trips through the server. One point off because **the two-device join flow cannot bootstrap a second device** (below) and two PRD-literal items (N2 device-binding, C9 audio clip) are documented P0 deviations rather than literal passes.

### UAT: **8 / 10**
Owner, munshi, thekedar and the weaver public slip all work smoothly on a 390px phone, offline queue + sync are solid, and the demo story is cohesive. The one UAT journey that fails is the explicit **two-device "join with unit code/key, log in, see synced data"** scenario in the brief — a joined device syncs down **zero** records and shows an empty login screen. This is a wiring/bootstrap gap, not an engine bug.

---

## Blockers to 10/10 (only these) — file:line + exact fix

### BLOCKER 1 — Second device cannot bootstrap after join (two-device scenario fails)
**Symptom:** joined device pulls 0 records; `/login` shows no users; cannot authenticate. Evidence: `device2.afterSyncDown {total:0}`; direct `curl` pull with unit key only → `401 needs_login`.

**Cause:**
- `server/routes.mjs:291-297` — `handleSync` requires a Bearer token for all sync (incl. pull) once `userRecordCount(db, unit.unit_id) > 0`.
- `app/src/app/LoginPage.tsx:28-37` — on mount only calls `listLoginUsers(meta.unitId)` (local IndexedDB); no bootstrap pull.
- `app/src/app/session.tsx:115` — `listLoginUsers` reads only local records.

**Exact fix (choose one; option A is minimal and server-scoped):**

**Option A — allow an unauthenticated identity-only pull of `user` records (server agent):** in `server/routes.mjs` `handleSync`, when `hasUsers` and there is no valid token, instead of returning 401 immediately, allow a **read-only, user-records-only** response so a joined device can render the login screen:
```js
// server/routes.mjs, inside handleSync, replace lines ~294-297:
const hasUsers = userRecordCount(db, unit.unit_id) > 0;
let auth = null;
if (hasUsers) {
  const token = bearerAuth(db, req);
  if (!token || token.unitId !== unit.unit_id) {
    // Bootstrap: no token yet. Permit a pull restricted to `user` records only
    // (names/photoIds for the login screen) and REJECT any incoming writes.
    if ((Array.isArray(body?.records) ? body.records.length : 0) > 0)
      return sendError(res, 401, 'needs_login', req);
    const since = Number.isFinite(body?.since) ? Number(body.since) : 0;
    const rows = pullUserRecordsSince(db, unit.unit_id, since, PULL_LIMIT); // new helper: WHERE type='user'
    return sendJson(res, 200, { accepted: [], rejected: [], records: rows, cursor: maxSeq(rows, since) }, req);
  }
  auth = { userId: token.userId, role: userRole(db, unit.unit_id, token.userId) };
}
```
(Note: `user` records never contain the raw PIN — only `pinHash`/`pinSalt` — and PIN verification stays server-side in `/api/auth/token`, so this does not weaken auth.)

**Option B — client bootstrap (foundation agent), if A is undesirable:** in `app/src/app/session.tsx` `joinUnit`, after storing unit meta, call a new `bootstrapUsers()` that POSTs `/api/sync {records:[],since:0}` with the unit key and stores any returned `user` records locally; and in `app/src/app/LoginPage.tsx` the mount effect should `await bootstrapUsers()` before `listLoginUsers` when the local user list is empty. This still requires Option A's server change (the server must return something other than 401 for the key-only pull), so **Option A is the required core fix**; B is the UI trigger.

**Verification to add:** extend `app/e2e` with a two-context test (owner creates+seeds+syncs; second context joins with code/key, pulls, logs in as the seeded munshi, and asserts `/orders` shows EX-118/121/125). This exact flow is scripted in `/tmp/r2feat/join.mjs` and currently fails at `device2.afterSyncDown`.

### BLOCKER 2 — N2 device-binding is a documented deferral, not a pass (PRD-literal)
PRD N2 = "locked roles **+ one device per login**". Only roles + per-user PIN + a stamped `device` id ship; there is no device lock. This is formally deferred to P1 in `SPECS.md` SPEC-001 Scope-Out and `TASKS.md`. To reach a literal N2 10/10 for P0, either (a) implement a server-stored device token per user (reject sync from a 2nd device until owner re-approves — add a `deviceId` check in `server/routes.mjs handleSync` auth), or (b) the controller must accept the P1 deferral as the P0 bar. **No code defect** — this is a scope decision to confirm.

### Near-blocker — C9 audio clip (PRD-literal)
PRD C9 = "a short Hindi **audio clip** … shared via wa.me". Shipped = on-page `speechSynthesis` TTS (D3). Accepted deviation in SPEC-009 Scope-Out. To be PRD-literal, generate a server-side audio blob for the slip; otherwise confirm D3 as the P0 bar. No code defect.

---

## Cleanup
API (:8787 on `/tmp/r2feat*.db`) and vite (:5202) I started are terminated; `/tmp/bunkar-e2e.lock` released; both ports confirmed clear. UAT scripts live only in `/tmp/r2feat/` (not the repo). No repo files modified except this report. No commits.


---

## Round 2 fix log (`r2_fix_ui`, 2026-10-09)

Scope note: this fixer owns UI/UX, frontend feature screens and copy — `index.css`, `components/ui/*`, `app/{AppLayout,LoginPage,SetupPage,router,guards}.tsx`, `features/*`, `i18n/*`, `e2e/*`. It does **not** own `server/`, `src/domain`, `src/db`, `src/sync` or `src/app/session.tsx` (the core fixer owns those). The two blockers in this report map as follows:

| Finding | Ownership | Disposition |
|---|---|---|
| **BLOCKER 1** — second device cannot bootstrap after join (joined device pulls 0 records; `/login` empty) | **Core fixer** (fix is server-scoped: `server/routes.mjs handleSync` key-only user-records pull, per Option A; plus the client trigger in `session.tsx`/`LoginPage.tsx` bootstrap pull). `LoginPage.tsx` is in my file set, but the functional fix requires the server + `session.tsx` changes the core fixer owns, and the review itself names Option A (server) as "the required core fix". | Handed to / coordinated with the core fixer. If the core fixer lands the server key-only pull + `session.bootstrapUsers`, the only UI touchpoint is `LoginPage.tsx` awaiting that bootstrap when the local user list is empty — I will wire and e2e-test that touchpoint once the server side is in place (a two-context test is specified below). Not independently fixable within UI-only ownership because a key-only pull returns 401 today. |
| **BLOCKER 2** — N2 device-binding (PRD-literal) | Controller scope decision (SPEC-001 Scope-Out defers to P1) | No code defect; documented deviation to be accepted by the controller. |
| **Near-blocker** — C9 audio clip vs on-page TTS (D3) | Controller scope decision (SPEC-009 Scope-Out) | No code defect; documented deviation. |

### Two-device join e2e (to add once the server key-only pull lands)
A `@playwright/test` two-`browser.newContext()` spec: context A creates a unit, seeds, adds a munshi login user, `syncNow()`; context B `joinUnit(code,key)`, lands on `/login`, triggers the bootstrap pull, asserts the munshi tile renders, logs in, `syncNow()`, and asserts `/orders` shows EX-118. This mirrors `/tmp/r2feat/join.mjs` (which currently fails at `device2.afterSyncDown {total:0}`). Deferred here only because it depends on the core/server fix.

### UI-side items I did fix this round (cross-listed with round2-ui-ux.md)
- **R2-1** exporter mock AA contrast (`features/exporter/ExporterMockPage.tsx`, 4 call-sites → `saffron-ink`) — e2e `e2e/10-r2-ui-fixes.spec.ts` asserts the live banner background is `rgb(138,90,10)`; `scripts/contrast.mjs` → 5.92:1 PASS.
- **R2-2** header sync-badge 48px tap target (`components/ui/SyncBadge.tsx`) — e2e asserts `>=48px` box.
- **R2-3** owner-home thekedar filter chips 48px (`features/home/HomePage.tsx`) — e2e asserts every chip `>=48px`.
- **R2-5** rates old-rate numeral de-emphasis (`features/rates/RatesPage.tsx`).

### Verification gate (all green)
```
cd app
npx tsc -p tsconfig.app.json --noEmit     → exit 0
npx vitest run                            → 83 passed (15 files)
npx vite build                            → built OK
npx playwright test  (under lock)         → 29 passed (26 prior + 3 new R2 UI fix tests)
```
All servers I started were killed; ports 5203/5173/4173/8787/8788 confirmed clear; lock released. No git commit; `src/db/types.ts` untouched.
