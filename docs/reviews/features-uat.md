# Bunkar OS P0 — Feature / PRD-Compliance + UAT Review

**Reviewer:** `review_features` (independent, read-only on code; writes only this file)
**Date:** 2026-10-09
**Build under review:** `app/` (React 19 + Vite 8 PWA) · `server/` (zero-dep Node 24 API)
**Method:** PRD P0 features (19) + A2 mock checked against SPEC-000..013 acceptance criteria and TASKS.md decisions D1–D9, then a live UAT walkthrough of the 6-step demo across personas.

## How this was verified (evidence base)

| Check | Command | Result |
|---|---|---|
| Domain unit tests | `npx vitest run` | **74 passed / 14 files** (0 fail) |
| App typecheck + build | `npm run build` (`tsc -b && vite build`) | **BUILD EXIT 0**, PWA SW generated, 102 precache entries |
| Server API tests | `node --test` in `server/` | **17 passed / 0 fail** |
| Demo bazaar math (SPEC-007) | temp vitest over `domain/{units,wage,money,tauli}` | area 79.33, gross **301454**, net **195454**, paid **195500**, rounding **46** — exact |
| Demo tauli (D1) | temp vitest `computeTauli` | used **22900**, allowed **687**, short **613**, extra **0** — exact |
| Live UAT (owner) | Playwright `/tmp/rev-feat/uat.mjs` on dev :5192 + API :8787 | All 19 screens reached; screenshots `01..19` in `/tmp/rev-feat/shots/` |
| Live UAT (munshi) | Playwright `/tmp/rev-feat/persona.mjs` | munshi created, logged in, gating confirmed |
| Public slip 404s | `curl /api/slips/short` and `/api/slips/AAA…22` | both **404** (SPEC-009 AC-6) |
| Language toggle (M1) | Playwright `/tmp/rev-feat/lang2.mjs` | HI→EN switches all strings; `html lang` → `en` |

Servers were started on the brief-assigned ports (dev **5192**, API **8787** since nothing else held it) and **killed on exit** (see Cleanup).

> **Scope note:** the live roker/digest for "today" show ₹0 / 0 bazaars because the demo seed is fully **backdated** (opening cash ₹42,500 is the only "today" figure). The 6-step *live* numbers (₹3,014.54 / ₹1,955 etc.) are proven by the domain math above and the seeded completed bazaars, not by a same-day live entry. This is expected for a backdated seed but means the "8 pm digest reflects ₹34,500 closing" (SPEC-012 AC-5) is **not** reproduced by the shipped seed — see K1/O1 gaps.

---

## Per-feature compliance table (19 P0 + A2)

Legend: **AC met** = yes / partial / no. Evidence cites test, screen (`shots/NN`), or `file:line`.

| ID | Feature | AC met | Evidence | Gap → exact fix |
|----|---------|--------|----------|-----------------|
| **M1** | Hindi-first low-literacy UI | **yes** | Default `hi` (`html lang=hi`, UAT `M1.lang`); EN toggle flips every string (lang2.mjs: होम→Home, सुप्रभात→Good morning, Synced); big tabular numerals, red/green tokens in `index.css`; 48px taps in `Button`/keypad (`LoginPage.tsx:150` `min-h-16`) | None material. Minor: a few mixed Hi/En labels on exporter mock are intentional (bilingual). |
| **N1** | Append-only audit log | **yes** | `/audit` renders every record with author/role/time + type filter (shot `15`, `AuditPage.tsx`); append-only model enforced in `db/repo.ts` + `domain/records.ts` (reversed/rejected ignored by projections); tests `records.test.ts` (4), `domain/*` | None. Hash-chaining is explicitly deferred (PRD "later"). |
| **N2** | Locked roles + device binding | **partial** | `can()` correct (`permissions.ts`; `permissions.test.ts` 5 pass); munshi rates **read-only** live ("सिर्फ़ मालिक रेट बदल सकते हैं", `persona` munshi.rates.editBtns=0); server rejects non-owner `rate` (`server/test/rules.test.mjs`). Munshi reverse-own-today vs owner-any implemented in `repo.reverse`. | **Device binding (one device per login) is not implemented** — PRD N2 says "one device per login"; no device-lock exists (only a generated `device` id stamp). Fix: on login, bind `session.device` to a server-stored device token per user; reject sync from a second device until owner re-approves (add `deviceId` check in `server/routes.mjs` sync auth). |
| **M3** | Offline entry queue + badge | **yes** | `addRecord` writes `sync:'pending'` (`db/repo.ts`); header badge shows "N बाकी"/"सिंक हो गया" (UAT home "152 बाकी" after seed, "सिंक हो गया" when clear); `sync/client.ts` + `useSyncState`; server idempotent-by-id + cursor (`server/test/sync.test.mjs` pass) | None. |
| **M5** | Photo on entries; required for high-risk | **partial** | Deduction photo mandatory enforced: `BazaarNewPage.tsx:125` `deductions.every(d => … && d.photoId)` blocks step; threshold wired `helpers.photoThresholdPaise` (`BazaarNewPage.tsx:110`); default `photoRequiredAbovePaise=200000` (D4) in `session.tsx:97`. | **Not independently exercised live** that a > ₹2,000 *payment/peshgi* without photo is blocked (only deduction path was observed). The seed even stores a deduction with `photoId:''` (`seed.ts` bazaar b===1) — a **demo record that violates the M5 rule** the UI enforces. Fix: (a) add a save-guard for payment/peshgi above threshold in `PeshgiNewPage`/`BazaarNewPage` and assert in an E2E; (b) give the seeded deduction a real `photoId` so demo data obeys its own rule. |
| **B1** | Loom registry | **yes** | `/looms` lists 24 looms with photos (UAT `B1.looms imgs=24`, shot `17`); `LoomP` has code/village/widthIn/thekedarId/weaverIds/photo; `listLooms` (`domain/pieces.ts`); CRUD-as-version in `looms/*` | GPS lat/lng optional and not captured in `LoomNewPage` UI (PRD B1 lists GPS). Fix: add optional lat/lng capture (navigator.geolocation) in `LoomNewPage.tsx`. |
| **C1** | Weaver register w/ photo ID | **yes** | `/weavers` 24 weavers each with photo (UAT `C1.weavers hasPhotos=24`, shot `16`); father/village/phoneType/upi in `WeaverP`; name-collision demo (3× "Mohammad Rafiq" different fathers) present | None material. |
| **A1** | PO → piece split | **yes** | `/orders` shows EX-118/121/125 (UAT `A1.ordersList` all true); EX-118 detail shows pieces 01..12 (UAT `A1.EX118detail` piece01/03/12 true, shot `07`); `listPieces` lifecycle tests `pieces.test.ts` (7 pass: not_started→on_loom→off_loom, on_hold/resume) | **Seed/SPEC drift:** SPEC-004 says demo order EX-118 count **5**, 8'0"×9'11" (96×119), piece 03 **off_loom**. Shipped seed makes EX-118 **count 12**, 96×**120**, piece 03 **on_loom** (`seed.ts` makeOrder EX-118 … 12; lenIn 96 widIn 120). Not a code defect in A1 engine, but the **demo narrative no longer matches SPEC-000/004/007** (79.33 sqft needs 96×119, seed uses 96×120 → 80.00). Fix: set EX-118 to 96×119 and reconcile the SPEC count (5 vs 12) with the controller. |
| **E1** | Yarn issue/return by loom | **yes** | `/yarn` shows "कुल बाहर 173.500 किलो" grouped by holder+shade+lot with oldest-issue age (UAT `E1.yarnPage`, shot `08`); loom 07 shows 24.000 kg Red·L-214 (the demo piece's two 12 kg lots); `yarnBalances`/`pieceYarn` | None. (3-dp kg formatting correct.) |
| **C2** | Rate card engine | **yes** | `/rates` shows current ₹40 (from 10-03) + old ₹38 (from 08-09) + norm 300 g (UAT `C2.rates`, shot `13`); owner-only edit, munshi read-only live; D2 lock `rateForPiece` (`rates.test.ts` 4 pass incl. lock to first-issue day) | PRD C2 mentions sqft/gaj/piece/kg/day + ancillary work; shipped supports **sqft/sqgaj only** (SPEC-006 scoped out piece/kg/day). Acceptable per SPEC lite-cut; flag for P1. |
| **C3** | Bazaar entry | **yes** | `/bazaar/new` 6-step wizard, piece picker with % woven (UAT `C3.bazaarNew`, shot `10`); wage auto from C2; exact demo math proven (gross 301454/net 195454/paid 195500); split cash/upi; `wage.test.ts`+`money.test.ts` pass; server rejects 2nd bazaar/piece (`rules.test.mjs`) | None material. |
| **E2** | Tauli variance | **yes** | D1 formula (used = given−returned; 3% on used) in `domain/tauli.ts`; demo tauli exact (used 22900/allowed 687/short 613/extra 0); size×norm shown as reference line (`tauli.ts` expectedG); `tauli.test.ts` 7 pass incl. extra>0 and no-wool flag | None. |
| **C5** | Peshgi ledger | **yes** | `/peshgi/new` reachable (UAT `C5.peshgiNew`); seeded ₹5,000 to Rafiq shows on weaver list (UAT `C1.weavers` "₹5,000"); `peshgiBalance`/`peshgiLedger`; recovery netted in bazaar; `peshgi.test.ts` 3 pass (balance 0 after recovery, no negative) | Live block of recovery > balance / give > ₹2,000 without photo not exercised live (logic present). Fix: add E2E assertions. |
| **C8** | Hindi wage slip + agree/dispute + history | **yes** | `/s/:token` public page renders slip (UAT `C8C9.publicSlip`: "मजदूरी पर्ची … कुल/Gross +₹2,660 … दिया/Paid … सही है/गलत है", shot `18`); server `GET /api/slips/:token` returns view-only (no key) and 404 on bad/short token (curl 404×2); `PreviewShareSheet` gates sharing; `slip.test.ts` 9 pass; `server/test/slips.test.mjs` pass | **Slip only reaches the public page after sync** (page fetches `/api/slips/:token`; seeded slips are local-pending until auto-sync pushes them). Fully offline weaver view is impossible by design (acceptable: weaver is remote). Minor: slip "history" per weaver (passbook) exists via `weaverPassbook` but no dedicated history screen was observed. |
| **C9** | Voice wage slip | **partial** | Public slip has "सुनें" (Play/TTS) button using `window.speechSynthesis` Hindi (`PublicSlipPage.tsx` Volume2 + speak); D3 = wa.me text + web page TTS (not a generated audio file) | PRD C9 says "short Hindi **audio clip** … shared on WhatsApp". Shipped = **on-page browser TTS**, no shareable audio file (D3 reframed it). This satisfies D3 but **not the literal PRD C9** ("audio clip generated automatically and shared"). Also TTS depends on device voices (fallback flag `noVoice` exists). Fix (if PRD-literal needed): generate an audio blob server-side; otherwise document D3 as the accepted deviation. |
| **B2** | Loom check-in (any role) | **yes** | `/checkin/new` form (UAT `B2.checkinPage hasForm`, shot `09`); thekedar-scoped loom picker via `visibleLoomIds`; `CheckinP` wovenIn + pct in `listPieces`; feeds board; photo optional (per SPEC-010) | See thekedar-binding gap under N2/B2 personas below — a **created** thekedar sees **no looms** because the add-user sheet never sets `thekedarId`. |
| **O1** | Daily roker (cash book) | **partial** | `/roker` shows opening ₹42,500, cash/UPI in/out, closing (UAT `O1.roker`, shot `11`); auto-post net-paid only (D7) + peshgi-give out; `rokerDay` (`roker.test.ts` 3 pass: opening=settings, closing=opening+in−out, day2 opening=day1 closing) | **Demo closing ₹34,500 (SPEC-011 AC-1 / SPEC-012 AC-5) is NOT reproduced**: all seed activity is backdated so "today" shows ₹42,500 opening and ₹0 movement; the seeded bazaars/peshgi are on past days, not aggregated into a single demo day that nets −₹8,000. Fix: seed the demo bazaar + peshgi + kharcha on the **same (today) day** so roker closes at ₹34,500, matching the SPEC/digest. PRD "bank" split: only cash/UPI implemented (bank deferred). |
| **K2** | Owner home + loom board | **partial** | Owner home board renders colour counts + per-loom days (UAT `home.K2.boardTextSample`: **15 ठीक / 5 धीमा / 3 रुका / 1 खाली**, shot `05`); filter by thekedar present ("सभी ठेकेदार Salim Shamim"); `loomBoard` (`board.test.ts` 6 pass: free/on_track<4/slow≥4/idle≥7/custom thresholds) | **Board-vs-source-of-truth mismatch (the exact D-resolution bug).** SPEC-000 line 61, SPEC-012 line 325, SPEC-013 lines 343/346/351 declare the board source of truth is **17/3/3/1**. The shipped **seed targets 15/5/3/1** (`seed.ts:8,323,325`) and the **live board shows 15/5/3/1**, while the **A2 mock hardcodes 17/3/3/1** (`ExporterMockPage.tsx:36`). So the two surfaces still disagree — the "15/5 vs 17/3" inconsistency SPEC-013 was created to kill. Fix: make the seed produce **17 on_track / 3 slow / 3 idle / 1 free** (change `onTrackLoomIdx.slice(0,15)`→`17`, `slowLoomIdx.slice(0,5)`→`3`, and the comments) so board == mock == spec. "Looms becoming free in next N days" (PRD K2) not shown. |
| **K1** | 8 pm WhatsApp digest | **partial** | `/digest` renders today's summary + a ready-to-share Hindi text + PreviewShareSheet (UAT `K1.digest`: "दैनिक सार … बाज़ार 0 … बंद कर␤घे 3 … मालिक को भेजें …", shot `12`); `digest()` (`digest.test.ts` 3 pass) | Same backdating issue: digest for "today" shows **0 bazaars / ₹0 / 0 area** because seed activity is in the past; SPEC-012 AC-5 wants it to reflect **₹34,500 closing + the day's bazaars**. "बंद करघे 3" (idle looms) does surface. Monthly summary (PRD K1 "sq ft woven/month") not present. Fix: same seed-on-today fix as O1; add monthly rollup to `digest()`. |
| **A2** | Static exporter status mock | **partial** | `/o/EX-118` renders header + 5 pieces + % woven + board legend, no login (UAT `A2.exporterMock`, shot `19`); unknown orderId → friendly "not found" (`ExporterMockPage.tsx:51 notFound`) | **Mock is 100% hardcoded and contradicts the seed** (`ExporterMockPage.tsx:16-33`): exporter **Obeetee Exports** (seed: Sharma Exports), design **Ziegler 1842** (seed: Kashan 14), size **8'0"×9'11"** (seed: 8'0"×10'0"), **5 pieces** (seed: 12). SPEC-013 AC-1 requires reading **seeded `OrderP` + `listPieces`**, which it does not. Its 17/3/3/1 legend also mismatches the live 15/5/3/1 board (see K2). Fix: drive `ExporterMockPage` from the real projection for order EX-118 (import `listPieces`/`listOrders` read-only), and align the legend to whatever the board emits. |

---

## UAT walkthrough — 6-step demo story, per persona

**Owner (Imtiaz Ansari, PIN 1234):** setup → login → seed → full loop reachable.
- Create order → pieces (A1): EX-118 opened, pieces 01–12 visible. ✓
- Issue yarn (E1): loom 07 holds 24.000 kg (two 12 kg lots). ✓
- Check-in (B2): `/checkin/new` form present. ✓
- Bazaar + tauli (C3/E2): 6-step wizard, piece picker w/ % woven; math exact (domain). ✓
- Roker/slip (O1/C8): roker opening ₹42,500 shown; seeded slip renders on `/s/:token` with Play + Agree/Dispute. ⚠ roker "today" is ₹0-movement (backdating).
- Loom board (K2) + digest (K1): board 15/5/3/1; digest shares Hindi text. ⚠ counts/closing don't match SPEC 17/3/3/1 & ₹34,500.

**Munshi (Munshi Ram, PIN 2222):** home = big action tiles (ऊन दें/बाज़ार/पेशगी/चेक-इन/रोकड़) ✓; rates **read-only** ✓; roker/digest/audit reachable ✓; cannot edit rates/settings (owner-only) ✓.

**Thekedar:** `can('thekedar','checkin.create')` only (verified `permissions.test.ts`), home shows own looms via `visibleLoomIds`. **Blocking defect for live use:** the Settings "Add user" sheet creates a thekedar with **no `thekedarId`** (`SettingsPage.tsx:88-91` payload omits it; `persona` users.now shows `thekedarId:null`). `visibleLoomIds` then matches `l.thekedarId === undefined` → returns **0 looms**, so a real thekedar sees an empty board and cannot pick a loom to check in. Fix: add a thekedar-entity picker to the add-user sheet and set `payload.thekedarId`.

**Weaver (public, no login):** `/s/:token` renders the Hindi slip, "सुनें" TTS, and सही/गलत (agree/dispute); bad/short tokens 404. ✓ (Requires the slip to have synced to the server first.)

**Exporter (public, no login):** `/o/EX-118` renders read-only status. ✓ surface, ⚠ data is a hardcoded mock disconnected from the seed (A2 gap above).

---

## Scores

### Feature compliance: **7.5 / 10**
Engines are strong and well-tested (74 domain + 17 server tests green; build clean). Every P0 surface exists, is Hindi-first, offline-first, and the hard money/tauli math is **exact**. Points off for: the **board 15/5/3/1 vs spec/mock 17/3/3/1 inconsistency still live** (the one thing SPEC-013 was meant to resolve), the **A2 mock being hardcoded and contradicting the seed**, **roker/digest demo targets (₹34,500) not reproducible** due to backdated seed, **thekedar user cannot be bound to looms**, **device-binding (N2) absent**, and **C9 being on-page TTS rather than a shareable audio clip**.

### UAT (demo-story) readiness: **7 / 10**
Owner and munshi journeys are smooth and legible on a 390px phone; the weaver public slip and offline queue work. The demo "story" breaks cohesion because the two headline numbers an evaluator will look at — the **loom board counts** and the **₹34,500 roker/8 pm digest** — don't line up with the written SPEC, and the exporter page shows a different order than the one just demoed. These are seed/wiring issues, not engine bugs, so they're low-effort/high-impact fixes before a live demo.

---

## Top fixes before demo (ranked)

1. **Unify the loom board to 17/3/3/1** (seed) so board == A2 mock == SPEC. (`app/src/features/demo/seed.ts:325-330`)
2. **Make A2 read real data** for EX-118 (`ExporterMockPage.tsx`) instead of the Obeetee/Ziegler hardcode.
3. **Seed the demo bazaar + peshgi + kharcha on *today*** so roker closes at **₹34,500** and the 8 pm digest shows the day's bazaars (SPEC-011/012). (`seed.ts`)
4. **Bind thekedar users to a thekedar entity** in the add-user sheet (`SettingsPage.tsx` add-user payload) so `visibleLoomIds` works.
5. **Reconcile EX-118 geometry** to 96×119 (79.33 sqft) and the count (5 vs 12) with the controller; give the seeded deduction a real photo so demo data obeys M5.
6. **Decide N2 device-binding** scope (implement or formally defer) and **C9** (accept D3 TTS or add server audio).

---

## Cleanup
Both servers I started (dev vite :5192, API node :8787 on `/tmp/rev-feat.db`) are terminated at end of review. No repo files modified except this report. All Playwright scripts live under `/tmp/rev-feat/` (not in the repo). No commits made.


---

## Fix log — `fix_features_uat` (features/UAT fixer, 2026-10-09)

Role scope (files owned & edited): `app/src/features/demo/seed.ts`,
`app/src/features/exporter/ExporterMockPage.tsx` (already fixed by the prior interrupted
run; verified, not re-edited), `app/src/features/settings/SettingsPage.tsx` (verified),
`SPECS.md`, `TASKS.md`, `app/e2e/{01,03,07,08,09}*.spec.ts`. Did **not** touch
`app/src/db/types.ts`, `app/src/sync/*`, bazaar/peshgi/yarn feature code, or fixtures auth.

### Findings → fixes → evidence

1. **Board 15/5/3/1 vs spec/mock 17/3/3/1 (K2/A2).**
   → `seed.ts` targets **17 on-track / 3 slow / 3 idle / 1 free** (onTrack slice 17, slow 3, idle 3, loom 24 free); `ExporterMockPage.tsx` reads the live `loomBoard` for its legend.
   → **Evidence:** `e2e/07-exporter-mock.spec.ts` asserts `legend-on_track`=17, `slow`=3, `idle`=3, `free`=1 — **passes**.

2. **A2 mock hardcoded / contradicted the seed.**
   → `ExporterMockPage.tsx` now projects from real `listOrders`/`listPieces` for the orderNo: finished, on-loom, avg % woven, **est dispatch from pace**, **latest check-in photos via `PhotoThumb`**, **J2 consent note**, **"Demo mock" label**; unknown order → friendly not-found that **never echoes the raw id**.
   → **Evidence:** `e2e/07-exporter-mock.spec.ts` both cases (seeded EX-118 = Sharma Exports/Kashan 14/8'0"×10'0"/12 pieces; bogus `ZZ-999-DROP-TABLE` → not-found, raw id count 0) — **pass**.

3. **Roker ₹34,500 / 8 pm digest not reproducible (O1/K1); deduction had empty photoId (M5).**
   → `seed.ts` seeds **TODAY**: Salim thekedar peshgi ₹2,000 cash + dyer roker ₹6,000 cash → opening ₹42,500 chains to closing ₹34,500; the live demo bazaar pays ₹1,955 via UPI (does not move cash). Seeded deduction now carries a **real `dedPhotoId`**. **Critical sub-fix:** the two TODAY records are stamped at the true current instant (`nowISO`), not the day-normalised `daysAgoISO(0)` 05:00-UTC slot, which rewound across the IST-midnight boundary and pushed them to the previous day (making opening show ₹34,500).
   → **Evidence:** `e2e/03-demo-loop.spec.ts` asserts roker opening=4,250,000, closing=3,450,000, a UPI bazaar entry present, and `digest(today).bazaarCount=1`, `upiPaidPaise=195500` — **passes**.

4. **Thekedar add-user had no `thekedarId` → saw 0 looms (N2/B2).**
   → `SettingsPage.tsx` add-user sheet shows a thekedar-entity `Select` (testid `user-thekedar-select`) when role=thekedar, requires it (`valid.required`), and sets `payload.thekedarId` (verified; implemented by prior run).
   → **Evidence:** `e2e/08-settings-thekedar.spec.ts` (save blocked until entity picked; created user `thekedarId` = Shamim's id; `visibleLoomIds` = exactly his 12 looms; thekedar login renders a scoped loom option) — **passes**. Also `e2e/01-setup-roles.spec.ts` updated to seed a thekedar entity before binding — **passes**.

5. **M5 payment/peshgi photo guard not exercised live.**
   → New `e2e/09-m5-photo-guards.spec.ts`: a bazaar whose paid > ₹2,000 cannot leave the payment step without a photo (Next disabled; enabled after upload); a peshgi give of ₹2,500 is blocked (photo error, confirm sheet hidden) while exactly ₹2,000 saves. (Guard logic lives in bazaar/peshgi feature code — not owned, verified present.)
   → **Evidence:** `e2e/09-m5-photo-guards.spec.ts` a + b — **pass**.

6. **SPECS alignment with the PRD demo.**
   → `SPECS.md`: SPEC-004 EX-118 **ordered 12 pieces at 8'0"×10'0" (96×120)**, piece **03 measured 8'0"×9'11" (96×119)** at bazaar; SPEC-013 rewritten to the real-data mock (12 pieces, legend from `loomBoard`, est dispatch, consent, Demo-mock, safe not-found); SPEC-000 adds the ordered-vs-measured reconciliation and board-source-of-truth note; **N2 device-binding = P1** (SPEC-001 Scope-Out) and **C9 = D3 on-page Hindi TTS, not an audio file** (SPEC-009 Scope-Out) documented.

7. **TASKS.md honesty.**
   → All 12+A2 steps marked **DONE** with cited Vitest files and Playwright spec names; a "Remaining — honest (post-P0/P1)" list captures N2 device-binding, C9 audio file, B1 GPS UI, C2 piece/kg/day, K1 monthly rollup, K2 "free in N days".

### E2E spec selector fixes (my specs, to match real DOM/i18n)
- `08`: "Add a user" / "Save user" button labels; PIN fields matched by regex (Field labels carry a trailing " *").
- `09a`: set measured width 9'11" so area=79.33 and gross=₹3,014.54 (the ordered 10'0" default gives 80.00); `09b`: weaver `PersonPicker` tiles are buttons (not `role=option`) — pick by name; confirm sheet title "Confirm peshgi" asserted by visibility.
- `01`: creating a thekedar user now requires an existing thekedar entity — seed one, then bind.

### Operational note
A stale `vite` process on :5173 from the interrupted prior run caused Playwright's
`reuseExistingServer:false` webServer to abort → cascading login timeouts in a batched
run. Killing stray :5173/:4173/:8787/:8788 processes before `npx playwright test` restored
green. No code cause.

### Cross-fixer note (server agent)
Earlier `tsc` failed only in `app/src/sync/client.ts` (initial `state` literal missing
`authState` from the extended `SyncStateView` in `app/src/sync/types.ts`). Both files are
server-agent-owned; **now resolved** — `tsc` exits 0. No action taken by this fixer.

### Final verification (final lines)
- **tsc** (`cd app && npx tsc -p tsconfig.app.json --noEmit`): `TSC_EXIT=0` (no diagnostics).
- **vitest** (`npx vitest run`): ` Test Files  15 passed (15)` · `      Tests  83 passed (83)`.
- **server tests** (`cd server && node --test`): `ℹ tests 37` · `ℹ pass 37` · `ℹ fail 0`.
- **playwright** (`npx playwright test`, with `/tmp/bunkar-e2e.lock`): `26 passed (1.1m)` (25 mobile + 1 offline preview build).
