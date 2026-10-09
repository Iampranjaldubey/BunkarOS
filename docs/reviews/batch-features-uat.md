# Bunkar OS — Completion batch (SPEC-014..018 + B1/B2 GPS) — Features + UAT review

**Reviewer:** `rev_features` (fresh, independent). Read-only on the repo except this file.
**Date:** 2026-10-09 (IST). **Node:** v24.21.0.
**Scope:** every acceptance criterion in SPECS.md SPEC-014..018, the B1/B2 GPS wiring, and a
regression check of the 19 P0 features (SPEC-001..013).

Nothing was committed. The hosted instance on ports **4180/8790** and
`server/data/{bunkar-local.db,.local-secret}` were never touched. All E2E ran under
`/tmp/bunkar-e2e.lock` (acquired, released on success).

## Verification evidence (re-run independently this session)

| Check | Command | Result |
|---|---|---|
| App type check | `npx tsc -p tsconfig.app.json --noEmit` | **exit 0** |
| App unit/property | `npx vitest run` | **200 passed / 23 files** |
| Server | `cd server && node --test` | **72 pass / 0 fail** |
| App build (PWA) | `npx vite build` | exit 0, precache **107 entries / 1372.92 KiB** |
| Full E2E (under lock) | `npx playwright test` | **54 passed / 0 failed** (19 spec files) |
| Slip-audio route only | `node --test test/slip-audio-route.test.mjs test/slip-audio.test.mjs` | **8 pass** — engine installed → real 200/RIFF/2-60 s path, not the 503 skip |
| Scripted domain UAT (speech/jobs/monthly/owner) | `/tmp/uat-batch.mts` via Node type-strip | **ALL UAT PASS** (18 assertions) |

Independent scripted-UAT numbers (not just "tests pass"):
- speech: `decimalSpoken(79.33)` = `उन्यासी दशमलव तैंतीस`; `rupeesSpoken(301454)` = `तीन हज़ार चौदह रुपये चौवन पैसे`; `rupeesSpoken(195500)` = `एक हज़ार नौ सौ पचपन रुपये`.
- jobs: `computeJob(kg,12500g,₹7)` → amount 8750, paid 8800, rounding +50; `computeJob(day,1.5,₹350)` → 52500; day=1.3 throws (must be ×0.5); piece flat → 800000.
- monthly: sqft 79.33, wage 301454, short 613 g, loss% = 2.7 (613÷22900); reversed bazaar → count 0 / sqft 0.
- owner: dues ₹4,000+₹2,000 → total 600000; staff entries Ramesh 2 / Owner 1.

---

## SPEC-014 — One device per login + remote sign-out (N2)

| AC | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | munshi on phone A, login on phone B online → Hindi "दूसरे फ़ोन पर चालू है" notice, no session | **PASS** | `routes.mjs:345` 409 `device_bound {boundAt}`; `e2e/13-n2-devices.spec.ts:86` AC1/AC2 green |
| 2 | owner "इस फ़ोन से साइन आउट" → B logs in, A's next sync shows signed-out + logs out, A's unsynced records stay | **PASS** | `routes.mjs:242` signout + `:390`/`:476` 401 `device_revoked`; `e2e/13-...:86` green |
| 3 | owner login on new phone = takeover (old revoked, never locked out) | **PASS** | `routes.mjs:311` owner takeover (revoke old, `revoked_by` owner); `e2e/13-...:139` green |
| 4 | munshi token → device list/sign-out API → 403 | **PASS** | `routes.mjs:519-552` owner-only; `e2e/13-...:172` green |
| 5 | owner+munshi+thekedar on ONE shared phone all log in and sync | **PASS** | binding is per `(unit,user)`, same device shared; `e2e/13-...:198` green |

Device binding is server-authoritative (`devices` table, token carries `deviceId`), `/api/sync` and photo APIs enforce the active binding, client id from `localStorage bunkar.device`. All 5 ACs pass.

## SPEC-015 — Hindi voice slip as a real audio clip (C9)

| AC | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | `speechHi` contains "उन्यासी दशमलव तैंतीस", "तीन हज़ार चौदह रुपये चौवन पैसे", "एक हज़ार नौ सौ पचपन रुपये" | **PASS** | `domain/speech.ts` + `slip.ts:108`; scripted UAT confirms all three; `speech.test.ts` 60 tests |
| 2 | `/api/slips/<token>/audio` → 200 audio/wav, valid RIFF, 2–60 s; unknown 404; expired 410 | **PASS** | `slip-audio.mjs` + `routes.mjs:260`; `slip-audio-route.test.mjs`/`slip-audio.test.mjs` (200/RIFF/duration, 404, 410, cache, 503) all green with the real engine |
| 3 | public page ▶ plays the clip, falls back to device TTS when the clip request fails | **PASS** | `PublicSlipPage.tsx` `playClip()` + `onerror`→`speakFallback()`; `e2e/14-c9-audio.spec.ts:57,80` green |
| 4 | bazaar receipt "आवाज़ भेजें" → preview (recipient+clip) + Web-Share-with-files `slip-<piece>.wav`; unsupported → send-the-link fallback | **PASS** | `BazaarDetailPage.tsx` `openVoiceShare`/`doVoiceShare` (preview Sheet + `nav.canShare({files})`, else `setShare(true)`); `e2e/14-...` green |

Engine (GPL-3.0 espeak-ng) is isolated in `server/tts/` with its own package.json, spawned as a separate child process, 10 s timeout, 60 s/MAX_WAV_BYTES caps, per-token cache; 503 `tts_unavailable` never blocks sync. All 4 ACs pass.

## SPEC-016 — More rate units + ancillary job payments (kg / day / piece) (C2)

| AC | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | piece rate ₹8,000 → bazaar gross = ₹8,000 regardless of size | **PASS** | `wage.ts`/`amounts.mjs computeWage` piece = flat ratePaise; `e2e/15-c2-jobs.spec.ts:35` green |
| 2 | straightening ₹7/kg, 12.500 kg → ₹87.50 → paid ₹88 (+₹0.50), roker cash/UPI out | **PASS** | `jobs.ts computeJob`; scripted UAT 8750/8800/+50; `e2e/15-...:65` green |
| 3 | helper ₹350/day, 1.5 days to "other" (name required) → ₹525 | **PASS** | `JobP.workerName` required for 'other'; scripted UAT 52500; `e2e/15-...:102` green |
| 4 | no job rate for the work → save blocked (owner link / munshi "मालिक से रेट डलवाएँ") | **PASS** | `jobRateFor` returns undefined → `JobNewPage` blocks; `e2e/15-...:134` green |
| 5 | tampered job amount → server rejects `invalid_amounts` | **PASS** | `amounts.mjs validateJobAmounts` wired at `rules.mjs:149`; `server/test/jobs.test.mjs` green |

Job qty rules enforced both sides (kg→grams int>0, day→×0.5>0, piece→int≥1); amount=round(qty×rate), paid half-up, cash+upi=paid. Jobs post to roker, digest, weaver passbook. All 5 ACs pass.

## SPEC-017 — Full owner home / loom board (K2)

| AC | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | demo board 17 on-track / 3 slow / 3 idle / 1 no-wool; legend matches | **PASS** | `board.ts` `no_wool` precedence; `HomePage.tsx:42,51,55` grey #d8dbe3/#1f2430 + Package; `e2e/16-k2-k1.spec.ts:47` + `smoke`/`07-exporter-mock` legends green |
| 2 | order filter EX-118 → only looms carrying EX-118 pieces | **PASS** | `HomePage.tsx:91-97,173-178` orderFilter chips; `e2e/16-...:71` green |
| 3 | pace 2 in/day, 20 in remaining → free in ~10 days | **PASS** | `owner.ts loomsFreeSoon` ceil(remaining/pace); `e2e/16-...:96` green |
| 4 | peshgi ₹4,000+₹2,000 → dues tile ₹6,000 | **PASS** | `owner.ts peshgiOutstanding`; scripted UAT 600000; `HomePage.tsx:288` dues-tile; `e2e/16-...:120` green |
| 5 | today's entries list each author with counts (Ramesh 12 / owner 3) | **PASS** | `owner.ts todayEntriesByUser` (excludes weaver/system); scripted UAT 2/1; `e2e/16-...:150` green |

no_wool = on_loom piece with no wool ever issued OR estimated remaining ≤ 0 (norm×area×remaining-fraction), precedence no_wool>idle>slow>on_track. Material-outside also shown. All 5 ACs pass.

## SPEC-018 — Monthly summary (K1)

| AC | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | demo month: sqft includes 79.33, wage bill includes ₹3,014.54, short 0.613 kg, loss% = short÷used | **PASS** | `monthly.ts monthlySummary`; scripted UAT sqft 79.33 / wage 301454 / short 613 / loss 2.7; `e2e/16-...:182` green |
| 2 | reversed bazaar excluded from the month | **PASS** | `recsOfType` drops reversed/rejected; scripted UAT count 0; `e2e/16-...:219` green |
| 3 | share preview lists every number on its own Hindi line | **PASS** | `monthlyTextHi` 11 lines; `DigestPage.tsx:16,64-65,338-346` prev/next selector + PreviewShareSheet; `e2e/16-...:244` green |

Monthly card ("इस महीने") on `/digest`: bazaars, sq ft, wage bill (bazaar gross + job amounts), paid, peshgi given/recovered, wool used/short, yarn-loss %, rejects "— (अभी दर्ज नहीं)" per scope-out, month prev/next (next disabled at current month). All 3 ACs pass.

## B1/B2 GPS (SPEC-003 / SPEC-010)

| Case | Result | Evidence |
|---|---|---|
| loom saves lat/lng on permission granted | **PASS** | `features/looms/*`; `e2e/17-gps.spec.ts:42` green |
| check-in saves lat/lng on permission granted | **PASS** | `features/checkin/*`; `e2e/17-...:74` green |
| loom still saves (no coords) on permission denied | **PASS** | graceful fallback; `e2e/17-...:131` green |

## P0 regression (SPEC-001..013)

Full E2E (54 passed, 19 files) includes the P0 specs — `01-setup-roles`, `02-masters`,
`03-demo-loop`, `04-slip-public`, `05/05b-offline`, `06-edge-cases`, `07-exporter-mock`,
`08-settings-thekedar`, `09-m5-photo-guards`, `10-r2-ui-fixes`, `11-two-device-join`,
`12-r3-roker-labels`, `smoke` — all green. The board-legend change (17/3/3/1 no_wool) was
propagated into `smoke.spec.ts` and `07-exporter-mock.spec.ts` and both pass. Vitest (200)
covers every P0 domain module (wage/tauli/money/roker/board/digest/slip/peshgi/pieces/rates).
No P0 regression observed.

---

## Scores

- **Features = 10** — every AC of SPEC-014..018 and the B1/B2 GPS cases is implemented in real
  code (verified by reading the modules, not just by passing tests) and independently
  re-verified: tsc 0, vitest 200/200, server 72/72, build OK, 54 E2E green, plus 18 scripted-UAT
  assertions on the exact demo numbers. Server-authoritative device binding, isolated optional
  TTS with graceful 503 fallback, defence-in-depth amount recompute, and correct Indian-system
  Hindi number words are all present and correct.
- **UAT = 10** — real user-journey coverage end to end: two-phone N2 (bind / block / owner
  sign-out / takeover / shared phone), voice-clip playback + Web-Share-with-files on the receipt
  with preview-and-confirm and link fallback, piece-rate bazaar + kg/day/piece job payments with
  correct rounding into roker/passbook, full owner home (no_wool tile, order filter, free-in-30,
  dues, staff entries), monthly summary numbers + per-line Hindi share, and GPS on loom + check-in
  (granted and denied). Hindi-first, ≥48 px targets, ≥4.5:1 contrast on the new no_wool tile.

## Blockers to 10

None. All acceptance criteria pass with cited evidence; no file:line fix is required.

SCORES: features=10 uat=10
BLOCKERS: 0

---

## Batch fix log — `fix_ui` (2026-10-09)

No UI blockers originate from this features/UAT review (BLOCKERS: 0 — every
SPEC-014..018 AC and the B1/B2 GPS cases pass). The single UI blocker came from
`batch-ui-ux.md` (negative "free in −N days") and was fixed there; see that
file's Batch fix log. For completeness, after that fix the app still verifies
green: `npx tsc` exit 0 · `npx vitest run` 200 passed · `npx vite build` exit 0
(precache 107 entries) · `npx playwright test` **55 passed / 0 failed** (one new
spec, `e2e/18-free-soon-days.spec.ts`). Nothing committed; hosted 4180/8790 and
`server/data/*` untouched.

---

## Batch fix log — `fix_core` (core fixer), 2026-10-09, Node v24.21.0

**Outcome: no fix required — this review reported `BLOCKERS: 0` and no `file:line` fix.**

The core fixer owns `server/**`, `app/src/domain/*` (per the architecture contract, the
core-fixer subset of `domain/`: units, money, ids, wage, tauli, peshgi, rates, roker,
slip, permissions, projections, jobs, speech), `app/src/db/{db,repo,hooks,photos}.ts`,
`app/src/sync/*`, `app/src/app/session.tsx`, `app/src/lib/*`, `app/vite.config.ts`,
`app/playwright.config.ts`, `app/scripts/*`, `README.md`, `app/e2e/fixtures.ts`.

Every non-UI acceptance criterion of SPEC-014..018 and the B1/B2 GPS cases is marked
**PASS** above with cited evidence, and the companion `batch-security-code.md` is also
**BLOCKERS: 0**. The only open blocker in the batch is a UI/UX item
(`batch-ui-ux.md` Blocker 1 — owner home negative "free in N days") in
`app/src/domain/owner.ts`, which the architecture contract assigns to agent **k**
(the `board,owner,monthly,digest.ts` split), not the core fixer. It is therefore out of
scope for this role and left for the k/UI owner. No core-owned file required a change;
no files were edited this session except this log and the matching log in
`batch-security-code.md`.

Independent re-verification (full suite re-run this session):

| Check | Command | Result |
|---|---|---|
| Server | `cd server && node --test` | **72 pass / 0 fail** |
| App type check | `npx tsc -p tsconfig.app.json --noEmit` | **exit 0** |
| App unit/property | `npx vitest run` | **200 passed / 23 files** |
| App build (PWA) | `npx vite build` | exit 0, precache **107 entries / 1372.99 KiB** |
| Full E2E (under lock) | `npx playwright test` | **54 passed / 0 failed** (19 spec files) |
| Slip-audio real engine | `node --test test/slip-audio-route.test.mjs test/slip-audio.test.mjs` | **8 pass** |

Safety: nothing committed; the e2e lock was acquired then released on every path; shared
ports 5173/8787/8788/4173 were left clear; the hosted instance on 4180/8790
(PIDs 151337/151174) stayed up and `server/data/bunkar-local.db` was untouched
(mtime 2026-10-09 09:09:58).
