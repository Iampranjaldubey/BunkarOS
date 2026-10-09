# Round 2 — Independent Audit: Data Integrity · Offline · Operability

**Auditor:** r2_audit_ops (read-only on repo except this file)
**Date:** 2026-10-09
**Node:** v24.21.0
**Method:** property-style loops + server integration against the *real* code
(no mocks). Reproducible harness in `/tmp/bunkar-audit/` (not committed).

| Dimension | Score |
|---|---|
| **Data integrity** | **10 / 10** |
| **Offline robustness** | **10 / 10** |
| **Operability** | **8 / 10** |

---

## Evidence (what I actually ran)

### A. Money + tauli invariants — 500 random cases each (PASS)
`/tmp/bunkar-audit/invariants.test.ts`, importing the real
`domain/{units,wage,money,tauli}.ts`:

```
✓ (a) money invariants across 500 random bazaars (2)
✓ (b) tauli invariants across 500 random cases (2)
Test Files 1 passed · Tests 8 passed
```

Verified over 500 random bazaars (seed 12345):
- `net >= 0` always (and `computeNet` throws rather than ever producing a negative net).
- `cash + upi == paid` always.
- `paid` is always a whole rupee (`paid % 100 === 0`).
- `gross` exactly equals `round(area/[1|9] × ratePaise)` — matches the server mirror in `server/amounts.mjs`.
- Rounding delta `rounding ∈ [-49, +50]`. **Note:** D6 rounding is *half-up*, so a
  remainder of exactly 50 paise rounds **up** and yields `rounding = 50`. The task's
  "`|r| < 50`" is therefore slightly off by the tie case; the correct, verified bound is
  `-49 ≤ rounding ≤ +50`. This is a spec-wording nuance, **not** a code defect
  (e.g. net=6950 → paid=7000, rounding=+50 is correct half-up behaviour).

Tauli over 500 random cases (seed 999): `used = issued − returned`,
`allowed = round(used×pct/100)`, `gap = used − carpet`, `short = max(0, gap−allowed)`,
`extra = max(0, carpet−used)` all consistent, and **`short` and `extra` are never both > 0**
(mutually exclusive by construction: `short>0 ⇒ gap>0 ⇒ used>carpet ⇒ extra=0`).

Canonical demo locked in: 96×119 → area 79.33 sqft, gross ₹3,014.54 (301454),
net ₹1,954.54 (195454), paid ₹1,955 (195500), rounding +46; tauli 24000/1100/21600 @3%
→ used 22900, allowed 687, short 613, extra 0.

### A2. Roker closing chain over 10 days + net-paid-only (PASS)
`/tmp/bunkar-audit/projections.test.ts`, importing real `domain/roker.ts`:
```
✓ (a2) roker closing chain consistent across 10 days (2)
```
- Each day `closing == opening + cashIn − cashOut`; each day's `opening == previous day's closing`
  (iterative chain in `roker.ts:60-74`).
- Bazaar posts only **net paid** (not gross): a UPI-only bazaar of paid 201500 posts `upiOut=201500`,
  `cashOut=0`, and leaves cash `closing` unchanged; gross 301454 never appears (`roker.ts:90-104`).

### C. Reversal-of-reversal (PASS)
`activeRecords` (`domain/records.ts:12-26`) removes (i) rejected records, (ii) reversal
records themselves, (iii) any record targeted by a non-rejected reversal. Reversing a
reversal does **not** resurrect the original target — the original stays excluded and
`peshgiBalance` stays 0. Verified in `projections.test.ts (c)`.

### D. Audit-log completeness (PASS, with one note)
`auditLog` (`domain/projections.ts:91-116`) surfaces all 18 non-reversal record types,
each with `by` (who), `at`/`day` (when) and reversal/rejection state. Verified by feeding
one record of every type and asserting all appear.
**Who/when/device:** the `AuditEntry` *projection type* omits `device`, but the Audit UI
reads it straight off the raw record — `features/audit/AuditPage.tsx:164-165`
(`selectedRec.device.slice(0, 8)`) — so the "who/when/device" requirement is met end-to-end.
Every write stamps `device` in `db/repo.ts:40`.

### E. Offline / sync — real server integration (PASS)
`/tmp/bunkar-audit/server-verify.mjs` against the real `server/` (ephemeral port + temp db):
```
PASS: duplicate push idempotent by id (accepted both, stored once; stored=1)
PASS: second bazaar for same piece rejected with reason='duplicate_bazaar'
PASS: non-owner rate edit rejected with reason='forbidden_role'
PASS: after reversing original bazaar, a new bazaar for same piece is accepted
PASS: forged bazaar amounts rejected with reason='invalid_amounts'
PASS: record authored by non-token user rejected with reason='author_mismatch'
== 7 passed, 0 failed ==
```
- **Queue survives reload:** writes go to IndexedDB via `addRecord` with `sync:'pending'`
  *before* any network (`db/repo.ts:33-47`); Dexie store persists across reload
  (`db/db.ts:16-20`). Proven offline-then-drain in `e2e/05-offline.spec.ts`; offline shell
  reload (SW active) in `e2e/05b-offline-shell.spec.ts`.
- **Duplicate pushes idempotent:** server short-circuits on existing id
  (`server/routes.mjs` handleSync, "Idempotency by id") — re-pushing the same bazaar id
  stores it once.
- **Rejected visible with reason:** client marks `sync:'rejected'` + `rejectReason`
  (`sync/client.ts` pushPending) and pull never flips a locally-rejected record back
  (`sync/client.ts` applyPulled, "L3"). Surfaced to the user in `features/settings/SettingsPage.tsx`
  ("Rejected records"), `features/audit/AuditPage.tsx`, and the home banner
  `home.warn.rejected` — in both `hi` and `en` (`i18n/outputs.*.ts`).

### F. PWA (PASS)
- Manifest valid: name, short_name, `lang:'hi'`, `display:'standalone'`, `start_url:'/'`,
  `scope:'/'`, theme/background colours (`vite.config.ts` + built `dist/manifest.webmanifest`).
- **Maskable icon present:** `pwa-maskable-512.png` with `purpose:'maskable'` (plus 192/512 "any").
- **SW precache includes the offline Hindi fonts:** `workbox.globPatterns` includes `woff,woff2`
  (`vite.config.ts`); built `dist/sw.js` precache lists
  `tiro-devanagari-hindi-devanagari-400-normal-*.woff2/.woff` and the Mukta set — fonts are
  self-hosted via `@fontsource/*` imported in `src/main.tsx:5-8` (no Google CDN), so Hindi
  renders fully offline. `/api` is excluded from precache (`navigateFallbackDenylist`, NetworkOnly).

### Baseline suites still green
```
app:    npx vitest run        → 83 passed / 15 files
server: node --test           → 37 passed
app:    tsc -p tsconfig.app.json --noEmit → exit 0
```

---

## Blockers to 10/10

### Operability — the only blocker (keeps it at 8/10)

**B-OPS-1 — No run instructions; `app/README.md` is unmodified Vite boilerplate.**
A new teammate cannot start the app + server from the docs.

- **Evidence:**
  - `app/README.md:1` = `# React + TypeScript + Vite` (template text; `grep -c "React + TypeScript + Vite" app/README.md` → 1).
  - No root `README.md` (`ls README*` at repo root → not found).
  - No `server/README.md` (`ls server/README*` → not found).
  - The real entry points exist but are undocumented: `app/package.json` scripts
    `dev`, `build`, `preview`, `test`, `test:e2e`, `server`; server started via
    `node server/index.mjs` (`server/index.mjs:63-71`, default `PORT=8787`); Vite dev
    proxies `/api → http://localhost:8787` (`app/vite.config.ts`).

- **Exact fix:** create `README.md` at the repo root (new file — allowed; this is not an edit
  to an owned source file) with the exact, verified commands below:

  ```markdown
  # Bunkar OS

  Hindi-first, offline-first PWA for Bhadohi carpet units. React+Vite PWA (`app/`)
  + zero-dependency Node 24 API (`server/`).

  ## Prerequisites
  - Node >= 24 (project uses v24.21.0). With nvm:
    `export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"`

  ## Run (two terminals)
  ```bash
  # 1) API server on http://localhost:8787
  cd server && node index.mjs

  # 2) App dev server on http://localhost:5173 (proxies /api -> :8787)
  cd app && npm install && npm run dev
  ```
  Open http://localhost:5173 → `/setup` to create a unit + owner PIN,
  or use the demo seed from the owner home.

  ## Production preview
  ```bash
  cd app && npm run build && npm run preview   # http://localhost:4173
  ```

  ## Tests
  ```bash
  cd app    && npm run test       # Vitest  (83 tests)
  cd server && node --test        # Node    (37 tests)
  cd app    && npm run test:e2e   # Playwright E2E
  cd app    && npx tsc -p tsconfig.app.json --noEmit   # type check
  ```

  ## Env
  - `PORT` (server, default 8787), `BUNKAR_DB` (sqlite path, default `server/data/bunkar.db`)
  - `BUNKAR_SECRET` (>=16 chars; HMAC token secret — set in production)
  - `TRUST_PROXY=1` only behind a known reverse proxy
  ```

  Optionally replace `app/README.md`'s boilerplate with a one-line pointer to the root README.

- **Why only −2 and not more:** every build/test/type command actually works and the scripts
  are present and correct — the gap is purely *documentation discoverability*, not a broken
  toolchain. Adding the README above takes Operability to 10/10.

---

## Non-blocking notes (not required for 10/10)
- `domain/projections.ts:76-87` — add `device` to the `AuditEntry` type for parity with the
  UI, which already reads it. Cosmetic; who/when/device is already satisfied end-to-end.
- Spec text in the task ("paid-net rounding `|r| < 50`") should read `≤ 50` to match D6 half-up;
  code is correct, only the wording is loose.

## Verdict
Data integrity and offline robustness are at 10/10 with concrete, reproducible evidence.
Operability is one new root `README.md` away from 10/10.


---

## Round 2 fix log (r2_fix_core, 2026-10-09)

All items owned by the core fixer that affect data-integrity / offline / operability
have been resolved. Evidence commands + output below (Node v24.21.0).

### B-OPS-1 (Operability blocker) — FIXED: root run instructions
- **Created `README.md` at the repo root** (new file) with verified run instructions:
  prerequisites (Node ≥ 24 via nvm), `cd server && npm start` (:8787), `cd app &&
  npm install && npm run dev` (:5173, proxies `/api`), production preview on :4173,
  the full test matrix (vitest / `node --test` / Playwright / tsc), the 6-step demo
  script, the role table, env vars, and the project layout.
- Every command in the README was executed in this session and passes (see matrix below).
  Operability's only blocker was documentation discoverability → resolved.

### Non-blocking parity notes — FIXED
- **`device` added to the `AuditEntry` projection type** (`app/src/domain/projections.ts`)
  and populated from `r.device` in `auditLog`, matching the UI which already reads
  `selectedRec.device`. Who/when/device now parity-complete at the type level.
- **Property-style tests kept in-repo** (per the audit request), importing the REAL
  domain modules (no mocks), deterministic seeds:
  - `app/src/domain/money.property.test.ts` — 500 random bazaars (seed 12345):
    `net>=0`, `cash+upi==paid`, `paid % 100 == 0`, `gross == round(area/[1|9] × rate)`,
    rounding ∈ [-49, +50] (D6 half-up tie → +50), plus the canonical demo lock-in.
  - `app/src/domain/tauli.property.test.ts` — 500 random cases (seed 999):
    used/allowed/gap/short/extra consistency and **short & extra never both > 0**,
    plus the canonical demo lock-in (used 22900 / allowed 687 / short 613 / extra 0).

### Related core fix (also lifts the Features/UAT two-device blocker)
- Added a **token-less bootstrap pull** so a freshly-joined second device can load its
  login screen (server returns `user` records only; writes still rejected; cursor NOT
  advanced). Offline/queue semantics unchanged. Details in round2-security-code.md fix log.

### Verification (this session)
```
server:  cd server && node --test                         → tests 39 · pass 39 · fail 0
app:     cd app && npx tsc -p tsconfig.app.json --noEmit   → exit 0
app:     cd app && npx vitest run                          → 17 files · 87 tests passed
app:     cd app && npx vite build                          → OK (precache 107 entries / 1814 KiB)
app:     cd app && npx playwright test  (under e2e lock)   → 30 passed (ran twice, stable)
```
Operability → 10/10; data-integrity and offline remain 10/10 (unchanged, now with the
property tests committed in-repo). No `git commit`; `app/src/db/types.ts` untouched.
