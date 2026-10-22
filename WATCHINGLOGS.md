# Watching Logs

Append-only work log. **Newest at bottom.** Append an entry after every meaningful action.

Format:
```
## YYYY-MM-DD HH:MM IST — <title>
- **What**: what was done
- **Why**: the reason / trigger
- **Evidence**: command output, file paths, test results
- **Next**: the immediate next step
```

---

## 2026-10-09 01:15 IST — Environment setup
- **What**: Initialised the Bunkar OS workspace. `git init` on branch `main`; Node **v24.21.0** via nvm; installed **21 skills** into `.kiro/skills` sourced from obra/superpowers, anthropics/skills, addyosmani/web-quality-skills, google-labs-code/stitch-skills; vendor clones kept in `~/.kiro/vendor`.
- **Why**: Bootstrap the project so Kiro-driven, skill-routed development can begin.
- **Evidence**: `node -v` → v24.21.0; `.kiro/skills` contains 21 skill folders; vendor clones present under `~/.kiro/vendor`. Kiro CLI still reports **2.20.1**.
- **Next**: Create project steering + planning docs (AGENTS/TASKS/SPECS/routing/kiro-tools/product); upgrade Kiro CLI 2.20.1 → v3 from a normal terminal.

## 2026-10-09 01:40 IST — Agents, MCP, workflow docs configured and verified
- What: 8 workspace agents in .kiro/agents (superpowers controller, sp-implementer, sp-reviewer, sp-final-reviewer, sp-explorer, code-review, security-review, simplify); .kiro/settings/mcp.json (playwright, chrome-devtools, context7); steering routing.md / kiro-tools.md / product.md; AGENTS.md, TASKS.md, SPECS.md, WATCHINGLOGS.md.
- Why: replicate superpowers multi-agent workflow on Kiro for Bunkar OS P0 build.
- Evidence: `kiro-cli agent list` shows all 8 as Workspace; headless `kiro-cli chat --agent superpowers` reported "MCP servers: playwright, chrome-devtools, context7 — Skills available: 21"; subagent test "Invoking subagent: sp-explorer ... Completed in 9.950s", SUBAGENT_RAN=yes.
- Next: user upgrades Kiro to v3 from a normal terminal (`kiro-cli update`); set git user.name/email; resolve "Decisions needed" in TASKS.md; start SPEC-001 via brainstorming.

## 2026-10-09 01:36 IST — Kiro CLI updated 2.20.1 → 2.28.0
- What: backed up ~/.local/bin/kiro-cli* to ~/.kiro/backup-2.20.1/, ran `kiro-cli update -y` detached.
- Why: user asked to upgrade toward v3.
- Evidence: `kiro-cli --version` → 2.28.0. Re-test with superpowers agent: "MCP servers: playwright, chrome-devtools, context7 | skills: 21 | SUBAGENT_RAN=yes | .kiro/agents file count: 8".
- Next: v3 not offered on stable channel; optional `kiro-cli update --rollout`. Restart the open chat to run on 2.28.0.

## 2026-10-09 01:55 IST — Decisions D1–D9 recorded; Kiro V3 enabled
- What: user approved all recommended decisions (1A–9A) → TASKS.md "Decisions" table; SPEC-000 resolutions + formulas. V3 engine (`--v3`) tested: it rejects `allowedTools`/`toolsSettings`, so added `.kiro/agents/superpowers-v3.json` using `permissions.rules`; v2 `superpowers.json` restored (+ WATCHINGLOGS.md resource); sp-final-reviewer model pin removed; `.kiro/hooks/superpowers-session-start.json` added by /upgrade-agent.
- Why: user asked for v3 + recommended decisions.
- Evidence: v3 run → "MCP servers: playwright, chrome-devtools, context7; skills=21; SUBAGENT_RAN=yes; count=9; LOG_SEEN=yes". v2 run → "MCP servers: 3 … SUBAGENT_RAN=yes". `kiro-cli agent validate` superpowers.json → valid.
- Next: SPEC-001 (step 1: M1/N2/N1 app shell, roles, audit log) via brainstorming.

## 2026-10-09 02:15 IST — Server (API + rules) + sync client built
- What: created zero-dep Node 24 server in `server/` (index.mjs, db.mjs, routes.mjs, rules.mjs, auth.mjs, package.json + 5 test files) and the sync client in `app/src/sync/` (client.ts, types.ts, index.ts). Endpoints: `/api/health`, `/api/units`, `/api/sync` (idempotent push/pull + cursor), `/api/photos/:id` PUT/GET (unit auth), public `/api/slips/:token` GET + `/response` POST (one answer, 409 on second). Rules: duplicate_bazaar, forbidden_role (owner-guarded rate/setting/user with bootstrap exception), invalid (bad unitId/malformed/unknown reversal target). scrypt + timingSafeEqual key auth; 2.5 MB body limit; CORS; per-IP 30/min slip rate limit.
- Why: server + sync agent brief for Bunkar OS P0.
- Evidence: `cd server && node --test` → "tests 17 … pass 17 … fail 0". CLI smoke: `BUNKAR_DB=:memory: PORT=8799 node index.mjs` → "listening on http://localhost:8799" and `curl /api/health` → `{"ok":true,"status":"healthy"}`. `cd app && npx tsc -p tsconfig.app.json --noEmit` → 0 errors in `src/sync/*` (remaining 4 errors are in other agents' files: db/hooks.ts, domain/digest.ts, pieces.ts, projections.ts).
- Next: feature agents consume `useSyncState()` for the header sync badge; foundation agent writes meta 'unitId'/'unitKey'/'unitName' at setup so `registerUnitIfNeeded()` + `syncNow()` activate.

---

## 2026-10-09 — domain agent: pure business logic layer (src/domain/)

**What**: Implemented all pure-TS domain modules per architecture contract: `ids.ts units.ts money.ts wage.ts tauli.ts records.ts rates.ts peshgi.ts pieces.ts board.ts roker.ts digest.ts permissions.ts slip.ts projections.ts` plus thorough Vitest suites (`*.test.ts`) and a `_testutil.ts` record builder. Covers D1–D9: tauli (used/allowed/short/extra), D2 rate-lock to first yarn-issue day, sqgaj wage, half-up rupee rounding (195454→195500 +46), roker 3-day cash carry-over with peshgi-recovery as info-only `{kind:'adjusted'}`, D5 piece status (on_hold/resumed/off_loom/on_loom), D9 loom board thresholds at exactly 4 (slow) and 7 (idle) days, peshgi multi-give/recovery balances, reversal + rejected exclusion, digest counts, permissions matrix, waMeLink formats, Hindi (Devanagari) + English slip text with all key numbers.

**Why**: Domain layer is the shared contract-bound business core all feature agents depend on.

**Evidence**:
- `npx vitest run src/domain` → `Test Files 14 passed (14)`, `Tests 73 passed (73)`.
- `npx tsc -p tsconfig.app.json --noEmit` → zero errors in `src/domain` (grep "src/domain" → NONE). Remaining errors are in foundation-owned files (`src/db/hooks.ts`, `src/components/ui/index.ts`), not domain.

**Next**: Foundation agent wires `src/db/repo.ts` + hooks to these projections; feature agents consume `projections.ts` barrel. No changes needed to `src/db/types.ts`.

---

## Foundation agent — app shell, design system, data layer, i18n, auth (2026-10-09)

**What**: Built the foundation layer the feature agents build on top of.
- Tooling: `vite.config.ts` (React + Tailwind v4 + vite-plugin-pwa autoUpdate + `/api` proxy to :8787 + vitest `test` block node env); `index.html` (lang=hi, theme-color); `main.tsx` (self-hosted @fontsource Mukta 400/500/700 + Tiro Devanagari Hindi, no CDN); `src/vite-env.d.ts`.
- Design system: `src/index.css` (Tailwind v4 `@theme` tokens — PRD palette, 18px Mukta body / Tiro headings, tabular-nums, saffron focus rings, reduced-motion, visually-hidden). 24 UI components in `src/components/ui/` (Button, Card, Input/Textarea/Select/Label, Field, Badge/Pill, Money, BigNumber, FtInInput, KgInput, MoneyInput, SegmentedControl, Sheet, ConfirmSheet, PreviewShareSheet [F-3], PhotoCapture, PersonPicker, EmptyState, StatTile, Skeleton, Toast, SyncBadge, PageHeader, BottomNav) + barrel `index.ts`.
- i18n: `src/i18n/{index.ts,hi.ts,en.ts}` — `t`/`useT`/`setLang`/`LangProvider`; feature dictionaries merged via `import.meta.glob('./*.hi.ts'|'./*.en.ts')`.
- Data layer: `src/db/{db.ts,repo.ts,hooks.ts,photos.ts}` — Dexie `bunkar` (records/photos/meta), `addRecord`/`reverse` (session-filled, sync:'pending'), `useRecords`/`usePendingCount`/`useSession`, `savePhoto` (canvas 1280px JPEG 0.7) + `photoUrl`. `src/lib/{utils.ts,session-store.ts,pin.ts}` (cn, session accessor, PBKDF2-SHA256 100k PIN hashing).
- Auth/shell: `src/app/{session.tsx,SetupPage.tsx,LoginPage.tsx,router.tsx,AppLayout.tsx,guards.tsx,unit-name.ts}` — create/join unit, 4-digit PIN keypad login w/ 5-attempt→60s lockout, all architecture routes w/ React.lazy, role BottomNav, `RequireSession`/`RequireCan` (uses domain `can`). 26 placeholder feature pages created for feature agents to overwrite. PWA icons generated by `scripts/gen-icons.mjs` (dependency-free PNG encoder).

**Why**: P0 build sequence step 1-2 (M1/N2/N1/M3/M5) — shell, roles, offline queue, photo capture — plus the shared design system and i18n every feature depends on.

**Evidence**:
- `npx tsc -p tsconfig.app.json --noEmit` → `tsc OK` (zero errors).
- `npx vite build` → built; `PWA v2.0.0 generateSW precache 65 entries`; `dist/sw.js` + `dist/manifest.webmanifest` (name "Bunkar OS", lang hi, theme #26406B, 192/512/maskable icons); `/api` in navigateFallbackDenylist.
- `npx vitest run` → `14 passed (14) · Tests 73 passed (73)` — confirms the vitest `test` block wiring (domain tests, not foundation-owned).
- Browser smoke (vite preview): Setup (Hindi) → createUnit → routed /login → picked owner → PIN keypad → 1234 → PBKDF2 verify OK → routed `/` owner shell (unit name header + SyncBadge "2 बाकी" from pending records + हिं/EN toggle + owner BottomNav Home/Orders/Looms-Weavers/Roker/More + skip link). Zero console errors.

**Next**: Server agent adds `src/sync/` (`useSyncState` — SyncBadge currently uses local `useSyncStateFallback`, swap when ready) + `server/`. Feature agents overwrite `src/features/**` placeholders and add `src/i18n/<feature>.{hi,en}.ts`. No `src/db/types.ts` change required.

---

## 2026-10-09 — outputs area feature screens (home, roker, digest, audit, settings, slip, exporter)
**What**: Built the P0 "outputs" feature screens (SPEC-001 audit view, SPEC-011 roker, SPEC-012 K2/K1, SPEC-009 public slip, SPEC-013 A2 mock) + role-based home. Overwrote placeholders at `src/features/{home,roker,digest,audit,settings,slip,exporter}/*` and added `src/i18n/outputs.{hi,en}.ts`. Writes via `addRecord`; projections via `useRecords()` + domain; permissions via `can()`; no `src/db/types.ts` / `src/domain/*` / `src/components/ui/*` edits.
**Why**: Deliver the owner/munshi/thekedar dashboards, cash ledger, 8pm digest share, tamper-evident audit view, More-menu/settings, weaver-facing slip page, and exporter demo mock.
**Evidence**:
- `npx tsc -p tsconfig.app.json --noEmit` → `tsc exit 0` (whole app clean).
- `npx vite build` → `✓ built`; chunks incl. `HomePage`, `RokerPage`, `DigestPage`, `AuditPage`, `SettingsPage`, `PublicSlipPage`, `ExporterMockPage`; `PWA generateSW precache 102 entries`.
- Dev server on `:5176` (strictPort); screenshots via `scripts/shot.mjs` — zero page errors (only harmless `/api` 502s when backend was down). With `loadDemoData()`: owner home loom board renders 24 colour tiles numbered by loom code, legend 15/5/3/1, thekedar filter chips, digest card. Roker: date selector + opening/closing + totals + add sheet. Digest: Work/Money/Alerts sections + 8pm reminder toggle + share. Audit: type/user filters + rows + detail sheet. Settings: section grid + unit code/key reveal (owner) + users mgmt + prefs + sync/rejected + load-demo + logout. Exporter `/o/EX-118`: "डेमो नमूना" banner, 53% avg bar, legend 17/3/3/1, piece chips (EX-118/03 = उतरा/off_loom), J2 consent note. Slip `/s/:token` (server booted, real token): big "सुनें" TTS button, lines gross +₹3,014.54 / −₹60 / −₹1,000 / net ₹1,954.54 / paid ₹1,955, green सही है / red गलत है; invalid token → friendly "पर्ची नहीं मिली" (no crash).
**Next**: QA agent E2E; demo seed already present (`src/features/demo/seed.ts` exports `loadDemoData`).

---
## demo_and_qa_harness — demo data + E2E harness (2026-10-09)
- **What**: Built `src/features/demo/*` (seed.ts `loadDemoData`/`clearUnitData`, avatars.ts, DemoPanel.tsx, index.ts), `src/i18n/demo.hi.ts`/`demo.en.ts`, `playwright.config.ts`, `e2e/*` (fixtures, smoke.spec, shot-demo.mjs), and added `test`/`test:e2e`/`server` scripts to `app/package.json`.
- **Why**: Deliver a realistic, idempotent, fully-backdated demo unit for the P0 demo loop + a mobile Playwright smoke harness.
- **Evidence**:
  - `npx tsc -p tsconfig.app.json --noEmit` → zero errors (whole app clean).
  - `npx vite build` → success (dist/sw.js generated).
  - `npx vitest run` → 74 passed / 14 files.
  - `npx playwright test` → 4/4 passed (setup→home, wrong PIN error, bogus slip token friendly error, demo seed board 15/5/3/1).
  - In-page projection check: loomBoard = {on_track:15, slow:5, idle:3, free:1}; EX-118/03 on_loom (loom 07, Rafiq Ansari); Rafiq peshgi ₹5,000; openingCash ₹42,500 (settings record stamped at true now to win version race over setup record); 153 records, 50 avatar photos, 3 orders, 3 bazaars+slips.
  - Screenshots: /tmp/demo-{home,looms,weavers,orders,roker,settings}.png — no JS page errors (only expected API-offline 502 resource loads with no backend).
- **Notes**: Settings agent already imports my `loadDemoData` and exposes `data-testid="load-demo"`, so the official `scripts/shot.mjs --demo` path uses my seed. E2E `loadDemo` falls back to a dynamic import of the demo module so it never depends on Settings wiring.
- **Next**: none for this area; reviewers to score UI.

## 2026-10-09 03:25 IST — Waves 1–2 done (foundation, domain, server, all P0 screens, demo seed)
- What: specs SPEC-001..013 approved in SPECS.md; app/ (React+Vite PWA) with domain logic, Dexie data layer, sync client, 26 feature pages; server/ (node:sqlite) API; demo seed (24 looms, board 15/5/3/1); Playwright harness.
- Evidence: vitest 74 passed; server node --test 17/17; tsc 0 errors; vite build OK; playwright smoke 4/4 (per agent reports, controller re-ran vitest/tsc/build/server tests).
- Next: wave 3 — full end-to-end + edge-case E2E with integration fixes, plus independent UI/UX/feature/security reviews.

---
## 2026-10-09 — review_ui_ux: independent UI/UX review → docs/reviews/ui-ux.md
**What**: Independent UI+UX review of all P0 screens. Started own vite dev server on :5191 (strictPort), seeded demo via `e2e/shot-demo.mjs` (board 15/5/3/1 confirmed), screenshotted 20+ routes at 390×844, viewed every PNG, ran live-DOM audits (tap sizes, label association, fixed-nav clipping, computed text colours), WCAG contrast math on tokens, and `npx vite build` for bundle sizes. Wrote `docs/reviews/ui-ux.md` (overall 7.1/10, per-dimension + per-screen P0/P1/P2 with file paths). No app source modified. Dev server killed; :5191 free; tmp scripts removed.
**Why**: Wave-3 independent review to score the build and surface concrete, actionable fixes before wider rollout.
**Evidence**:
- `node e2e/shot-demo.mjs http://localhost:5191 /tmp/rev-ui` → `board {on_track:15, slow:5, idle:3, free:1}`, 6 shots, only expected 502s (no backend).
- Contrast math (own node calc): saffron `#c98a1c` on white = **2.94:1** (FAIL AA), on bg = 2.67:1; slow loom tile white-on-saffron = 2.94:1 (FAIL); madder 6.66:1 ✓, jute 5.30:1 ✓, indigo 10.35:1 ✓, muted 6.11:1 ✓.
- DOM audit: `unlabeledInputs:0` on all 15 routes; `<html lang=hi>`; 1×h1/page; lang toggle `हिं`=40×40px (< 48px product rule); after scroll-to-bottom `clippedCount:0` on every long page (nav does NOT clip content — `pb-20`=80px > nav 57px); yarn/bazaar submit order verified correct (inputs→photo→submit).
- `npx vite build` → entry index 247.78 kB (gzip 77.68), lucide 204.19 kB (gzip 61.35), Button 98.90 kB (gzip 32.94), css 38.40 kB (gzip 7.72), PWA precache 102 entries (1802.91 KiB).
- Verified two non-defects (nav clipping, form order) to avoid false findings.
**Findings headline**: P0 = saffron-as-text/numeral contrast fail (tokens + ~10 call-sites: Badge.tsx:13, HomePage.tsx:31/167/212, BazaarNewPage.tsx:320-323, YarnPage/YarnIssuePage/looms shared). P1 = status colour-only (add icons), 40px lang toggle, audit raw English type keys, slip 404-vs-offline branch, roker day-0 postings showing ₹0. P2 = weaver photos not shown, exporter raw-id echo, bundle trim (lucide).
**Next**: Foundation agent to add `--color-saffron-ink` (~#8a5a0a, 5.5:1) and swap `text-saffron`→amber-ink at the cited sites; feature agents for status icons + audit Hindi labels. Domain/demo owner to check roker day posting on seed date.

---

### 2026-10-09T04:18+05:30 — e2e_integrator: full P0 E2E suite + root-cause fixes

**What**
- Wrote 6 Playwright specs under `app/e2e/` covering the whole P0 loop + edge cases:
  `01-setup-roles`, `02-masters`, `03-demo-loop`, `04-slip-public`, `05-offline`
  (dev stack) + `05b-offline-shell` (production preview build), `06-edge-cases` (8 guards).
- Extended `app/e2e/fixtures.ts` with resilient helpers (resetLocal, forceEnglish,
  projection(), addRecordInPage, hashPinInPage, uploadPhoto + a verified decodable PNG).
- Added a second Playwright project `offline` on a `vite build && vite preview :4173`
  stack (service worker active) so the offline app-shell reload is proven for real;
  added `preview.proxy` to `vite.config.ts` (/api → :8788).

**Bugs fixed (root-cause, minimal)**
1. `app/src/features/demo/seed.ts` — the general-issue loop stray-issued a 2nd 12 kg to
   EX-118/03 (making issued 24 kg before the live loop), breaking the demo tauli. Now skips
   the demo loom so the piece keeps exactly one seeded 12 kg issue.
2. `app/src/features/demo/seed.ts` — EX-118/03 was assigned weaver[6], but the ₹5,000 peshgi
   is held by Rafiq Ansari (weaver[0]); assigned the demo piece to Rafiq so recovery works.
3. `app/src/features/yarn/YarnReturnPage.tsx` — a loom yarn-return carried no pieceId, so
   `pieceYarn` never attributed returns to the piece (tauli always ignored returns). Now
   stamps the on-loom pieceId onto the return holder (mirrors the issue path).
4. `app/src/features/slip/PublicSlipPage.tsx` — the "already answered" state never showed
   on reopen because the client read `response.payload.answer` but the server returns
   `{answer}`. Now reads `response.answer` (payload fallback kept).
5. `app/scripts/shot.mjs` — `--demo` was a brittle button-click + fixed 5 s wait; now seeds
   via the demo module and waits for the seed marker.
- Investigated the "roker today ₹0 opening on demo" report: NOT reproducible — opening cash
  chains correctly from openingCashDay (₹42,500). No change needed.

**Evidence**
- `cd app && npx playwright test` → `21 passed (51.6s)` (mobile project 20 + offline project 1).
- `cd app && npx vitest run` → `Test Files 14 passed, Tests 74 passed`.
- `cd server && node --test` → `pass 17, fail 0`.
- `cd app && npm run build` → `✓ built`, PWA `precache 102 entries`, `dist/sw.js` generated.
- `node scripts/shot.mjs http://localhost:5173 / /tmp/home-demo.png --demo` → `errors: []`,
  board renders 15/5/3/1 (screenshot verified).

**Next**
- Optional: `shot.mjs --lang=en` doesn't flip language (shell uses a radio "EN", not a button);
  out of scope here, worth a follow-up if screenshots in English are needed.


## 2026-10-09 05:15 IST — Security fixer: finished auth/token client wiring + lockout + L3 (RESUME)
- **What**: Completed the client half of the C1/H1 per-user auth design that the interrupted run left failing. Rewrote `app/src/sync/client.ts` to: initialise `SyncStateView.authState` (fixes the tsc error), request/store a Bearer token (meta `bunkar.auth`), attach `Authorization` on sync, treat 401 → `authState:'needs_login'`, drain pull pages until a short page (H2), and never flip a locally `rejected` record back to `synced` (L3). Reworked `app/src/app/session.tsx` login to (online) push bootstrap records token-lessly then `requestToken`, and replaced the global localStorage PIN lock with a per-user IndexedDB-persisted escalating lockout (M1); logout clears the token. Minimal `SyncBadge.tsx` edit surfaces `needs_login`. Added `app/src/sync/client.test.ts` (9 tests). Server side (token.mjs/rules.mjs/routes.mjs/amounts.mjs + 37 tests) was already in place from the interrupted run and verified. Appended the Fix log to `docs/reviews/security-code.md`.
- **Why**: Finish all Critical/High/Medium (and cheap Low) findings from `docs/reviews/security-code.md`; the resume note flagged the `authState` tsc failure and the half-written sync client.
- **Evidence**:
  - `cd server && node --test` → `tests 37  pass 37  fail 0`
  - `cd app && npx tsc -p tsconfig.app.json --noEmit` → `TSC_EXIT=0`
  - `cd app && npx vitest run` → `Test Files 15 passed (15)  Tests 83 passed (83)`
  - `npx playwright test --project=mobile` → `25 passed (1.1m)`; `--project=offline` → `1 passed`. (Full single-command run shows false ERR_CONNECTION_REFUSED failures only because the concurrent `vite build && vite preview` preview stack OOM-kills the dev server under ~1.9Gi free + parallel fixers; per-project runs are green = 26/26.)
- **Next**: Foundation agent may add a `sync.needsLogin` i18n key (hi/en) to replace the inline SyncBadge label; otherwise no further security work pending.

## 2026-10-09 04:30 IST — Wave 3 (E2E + reviews) and wave 4 (fixes) done; all suites green
- What: 26 Playwright E2E specs (roles, masters, PRD demo loop, public slip, offline queue + offline shell, 8 edge cases, exporter mock, thekedar binding, M5 photo guards); independent reviews (UI/UX 7.1, features 7.5/UAT 7, security 4 / code 8) in docs/reviews/*.md; all findings fixed (per-user server auth tokens + server-derived roles, server-side money recompute, slip expiry, CORS/MIME/CSP, AA contrast + status icons, 48px targets, real photos, A2 from live data, seed today roker 42,500 → 34,500, thekedar binding).
- Evidence (controller run): tsc exit 0; vitest "15 passed / 83 passed"; server "tests 37 pass 37 fail 0"; vite "✓ built"; playwright "26 passed (1.1m)".
- Next: re-review round by fresh independent reviewers targeting 10/10; fix loop until all ≥ 10 or remaining gaps documented.


---

## 2026-10-09 — r2_fix_core: round-2 core blockers fixed

**What.** Fixed the two round-2 core blockers and the parity notes.
1. Two-device JOIN bootstrap (Features/UAT BLOCKER 1): server `handleSync` now
   permits a token-less, `user`-records-only pull (writes still rejected; cursor not
   advanced) via new `userRecordsSince` helper; client `bootstrapUsers()` + `LoginPage`
   mount trigger; `loginWithPin` retries sync+token for reliable auth; `AUTH_RATE_MAX`
   made env-configurable (default 20) so the shared-IP e2e harness doesn't trip it.
2. Operability B-OPS-1: created root `README.md` with verified run/test/demo/role docs.
3. Parity: `device` added to `AuditEntry`; property tests kept in-repo
   (`money.property.test.ts` seed 12345, `tauli.property.test.ts` seed 999).

**Why.** Round-2 reviews required every dimension at 10/10; the join flow was the only
functional blocker and the missing README was the only operability blocker.

**Evidence.**
```
server  node --test                         → tests 39 · pass 39 · fail 0
app     tsc -p tsconfig.app.json --noEmit    → exit 0
app     vitest run                           → 17 files · 87 tests passed
app     vite build                           → OK (precache 107 / 1814 KiB)
app     playwright test (under e2e lock)     → 30 passed, stable across 2 runs
```
New tests: `server/test/sync.test.mjs` (+3 bootstrap), `app/e2e/11-two-device-join.spec.ts`.

**Next.** Controller to confirm the N2 device-binding and C9 audio-clip P0 deferrals
(documented scope decisions, no code defect). Lock released; ports 8787/8788/5173/4173
confirmed clear. No git commit; `app/src/db/types.ts` untouched.

## 2026-10-09 05:55 IST — Round 2 reviews/fixes verified; K1 digest fixed by controller
- What: round-2 scores — Security 10, Code 10, Data integrity 10, Offline 10, Operability 8→README added, Features 9, UAT 8 (two-device join fixed + e2e 11), UI/UX 8.2 (R2-1..R2-3 fixed). Controller review of screenshots found K1 bugs: digest cash/UPI ignored roker (PRD K1 says "cash paid (from the roker)"), "wool outside" counted only today's thekedar issues (showed 0.000 kg), no "orders at risk". Fixed in src/domain/digest.ts (+ new src/domain/dates.ts human dates), WhatsApp digest now one fact per line.
- Evidence: vitest "18 passed / 93 passed" (new tests: roker-derived cash ₹8,000/UPI ₹1,955, as-of-day wool balance, overdue/due-soon/idle-loom orders); tsc exit 0.
- Next: round 3 — UI polish (human dates, piece picker with photos/father name, labels, at-risk orders on home/digest), perf (fonts precache, chunking, measured LCP), seed realism; then fresh reviewers.

---

## r3_core — core/perf/seed fixes (2026-10-09)

**What**: (1) Seed realism — Rafiq Ansari now weaves ONLY on loom 07 (added
`weaverForLoom` swap: loom 07→Rafiq, loom 01→Jamil); EX-121 given a due date 7
days ahead so it shows as an "order at risk" in K1. (2) `03-demo-loop` digest
assertions extended: `cashPaidPaise===800000`, `upiPaidPaise===195500`,
`woolOutsideG>0`, `ordersAtRisk` contains EX-121 (roker still closes ₹34,500).
(3) Perf: font subsetting (devanagari+latin only, `main.tsx`), woff2-only
precache (`vite.config.ts` globPatterns/globIgnores), vendor chunk splitting
(react/router/dexie via `manualChunks` fn — rolldown form), new `scripts/perf.mjs`
(CDP 4× CPU + Slow 4G, cold/warm /setup), `perf` npm script. (4) README
Performance section + verified every README command.

**Why**: Make the demo faithful to the PRD narrative and tune the PWA for budget
Android (smaller precache + long-term-cacheable vendor chunks).

**Evidence**:
- `npx tsc -p tsconfig.app.json --noEmit` → exit 0
- `npx vitest run` → 93 passed / 18 files
- `npx vite build` → precache 97→(repeat)102 entries ~1312 KiB (before 108/1820.64 KiB); index chunk 246KB→36KB; react/router/dexie vendor chunks emitted
- `server/ node --test` → 39 pass / 0 fail
- `npx playwright test` (under /tmp/bunkar-e2e.lock) → 30 passed (full run; 3 transient flakes on a prior run all passed on re-run, isolated + full)
- `npm run perf -- http://localhost:4175` → `{cold:{lcpMs:1432,cls:0.001,transferKB:225},warm:{lcpMs:88,...}}` — cold ≤2500, warm ≤1200, CLS ≤0.1 all met
- Precache woff2=8, woff(non-2)=0 in `dist/sw.js`

**Next**: none for this role. Note for QA agent: `03-demo-loop` checkbox step
(`getByRole('checkbox').first().check()`) and `07`/`02` can flake under full-run
contention; consider `scrollIntoViewIfNeeded`/`force` or a settle wait.

---

## 2026-10-09 — r3_ui (UI/UX polish fixer, port 5221)

**What** — Landed the controller's round-3 UI/UX findings across owned files
(i18n, components/ui, features/* except demo, e2e selectors):
1. Human dates everywhere via `formatDay`/`formatTime` (domain/dates, re-exported
   by projections): home greeting, roker date selector, digest header, audit
   rows + detail, bazaar detail, weaver passbook, exporter est-dispatch, munshi
   today-entry times. (Public slip page shows no raw dates — slip text is
   server-generated; noted for server agent.)
2. Corrected K1 digest surfaced: owner home + /digest now label every number
   ("नकद खर्च", "कुल बाहर ऊन"), show idle/tauli-short looms by **code** not id,
   and render an **orders-at-risk** card (reason chips overdue/due_soon/idle_loom,
   tap → /orders/:id) on both the owner home and the digest Alerts section.
3. PiecePicker rebuilt: large loom number, weaver PhotoThumb + father's name
   ("पिता: …") so three "Mohammad Rafiq" are distinguishable, sorted by %woven
   desc, "बाज़ार के लिए तैयार" badge at ≥95%.
4. Weaver tiles label peshgi ("पेशगी बाक़ी ₹5,000"); icon-only "+" headers on
   weavers/looms/orders/thekedars now show text ("+ नया बुनकर", …).
5. New dismissible `PwaInstallCard` (owner+munshi home) on `beforeinstallprompt`,
   dismissal stored in localStorage.
6. English dictionaries lazy-loaded (Hindi eager) — `i18n/index.ts` code-splits
   base `en` + every `*.en.ts` into 5 chunks fetched only on English toggle/boot.

**Why** — Close the review dimensions to 10/10 (readability, K1 correctness,
weaver disambiguation, affordances, installability, cold-load weight).

**Evidence** (Node v24.21.0):
- `npx tsc -p tsconfig.app.json --noEmit` → exit 0
- `npx vitest run` → 18 files / 93 tests passed
- `npx vite build` → built, PWA precache 102 entries (1313.83 KiB); EN chunks
  (`en` 4.31, `masters.en` 6.37, `transactions.en` 8.39, `outputs.en` 8.78,
  `demo.en` 0.84 KB) now deferred off the Hindi critical path.
- `npx playwright test` (holding /tmp/bunkar-e2e.lock) → 30 passed; updated the
  `07-exporter-mock` est-dispatch assertion to a human date regex.
- Screenshots in /tmp/r3ui/{home,digest,bazaar,weavers,roker,audit-top}.png verify
  all of the above visually.

**Next** — Server agent: public slip text (domain/slip) could also format its
date line via formatDay if a date is ever shown. No action needed from this fixer.

---

## r3_rev_security (2026-10-09) — round-3 independent security + code review

**What:** Re-verified round-2 security/code-quality fixes and reviewed all code changed since
(git uncommitted). Read all of `server/*.mjs`, `app/src/sync/*`, `app/src/app/session.tsx`,
`app/src/domain/{digest,dates,slip}.ts`. Ran a 37-check live attack battery against a server I
started on :8799, plus full test suites. Wrote `docs/reviews/round3-security-code.md`.

**Why:** Round-3 security dimension must reach 10/10 with fresh independent evidence, not a trusted diff.

**Evidence (final lines):**
- `cd server && node --test` → ℹ tests 39 · pass 39 · fail 0
- `cd app && npx vitest run` → Test Files 18 passed (18); Tests 93 passed (93)
- `npx tsc -p tsconfig.app.json --noEmit` → tsc_exit=0
- `npm audit --omit=dev` → found 0 vulnerabilities
- XSS grep across app/src → 0 matches
- Live battery → 37/37 effective checks correct (forged role→forbidden_role, author_mismatch,
  token tamper/expiry→401, owner-only→forbidden_role, tampered gross/negative→invalid_amounts,
  duplicate_bazaar, two-device bootstrap leaks ONLY user records + rejects writes + no raw PIN,
  slip <22/unknown→404, view omits phone/id, double response→409, evil CORS not reflected,
  nosniff+CSP, photo MIME 415/forced-type, 3MB photo not stored, XFF no rate-limit bypass,
  SQLi token→404 + payload stored verbatim + table intact).
- Server killed (port 8799 free; left two unrelated `../server/index.mjs` procs owned by another agent). /tmp/r3sec.* removed.

**Result:** SCORES: security=10 code=10 · BLOCKERS: 0. Two carried non-blocking nits
(N1 413-socket-reset, N2 duplicate waMeLink) — cosmetic/correctness only, owned elsewhere.

**Next:** none from this reviewer; report is the deliverable.

---

## 2026-10-09 — r3_rev_audit (data integrity · offline · operability, round 3)

**What:** Fresh independent audit. Read architecture/SPECS/TASKS/README; ran all
in-repo tests; added scratch property loops (`/tmp/r3audit/prop1-3.mjs`); drove the
real server for idempotency/rejection; reproduced the full README from a clean
`cp -r` copy (`/tmp/r3audit-copy`, `npm ci`). Read-only on repo except the new
`docs/reviews/round3-audit.md`.

**Why:** Verify money/tauli/roker invariants, K1↔roker consistency, as-of-day wool,
reversal/audit completeness, offline queue durability + idempotent re-push +
rejected-record visibility, PWA font precache for offline Hindi, and operability.

**Evidence (final lines):**
- `prop1.mjs` → PROP1 OK (400k+ money+tauli iterations).
- `prop2.mjs` → PROP2 OK (3000 streams × 7 days: digest↔roker, as-of-day wool,
  closing identity, reversal/reject drop-out).
- `prop3.mjs` → PROP3 OK (idempotent re-push, duplicate_bazaar + forbidden_role +
  invalid_amounts rejection, reversal re-allow) vs real server.
- Fresh copy: `npm ci` 0 vulns; `tsc` exit 0; vitest 18/93; server 39/39;
  build precache 102 entries; sw.js 8 woff2 / 0 woff + Devanagari subsets;
  `npm start`→health {ok:true}; preview /setup 200; perf cold 1392/warm 92/CLS 0.001;
  `npm run test:e2e` → 30 passed (under /tmp/bunkar-e2e.lock, released).

**Result:** SCORES: integrity=10 offline=10 ops=10 · BLOCKERS: 0. No code changes
needed; the only diffs were in my own scratch recompute until aligned to the code's
documented as-of-day / holder-level contracts.

**Next:** none from this reviewer; `docs/reviews/round3-audit.md` is the deliverable.

## 2026-10-09 07:40 IST — Round 3 polish + reviews: 7 of 8 dimensions at 10/10
- What: r3_ui (human dates, K1 at-risk orders on home/digest, piece picker with photo + father's name, labelled numbers, install card) and r3_core (seed realism, EX-121 due soon, font subsetting, vendor chunks, scripts/perf.mjs, README perf) landed. Fresh reviews: Security 10, Code 10, Integrity 10, Offline 10, Ops 10, Features 10, UAT 10 (all BLOCKERS: 0). UI/UX review crashed on a >2000 px multi-image screenshot → scripts/shot.mjs now writes viewport tiles (780×1688).
- Evidence (controller): tsc 0; vitest 18 files / 93 tests; server 39/39; playwright "30 passed (1.3m)"; perf on preview (4× CPU + Slow 4G) cold LCP 1384 ms, warm LCP 88 ms, CLS 0.001; precache 102 entries / 1311.74 KiB (was 1817); digest screenshot shows cash ₹8,000, wool outside 173.500 kg, at-risk EX-121/EX-125, Hindi date.
- Next: rerun UI/UX review → fix → re-review loop until 10/10.

## 2026-10-09 08:15 IST — P0 complete: every review dimension 10/10, all suites green
- What: round-3 UI/UX review (B1: roker rows showed raw UUIDs/enums) → fixed (RokerPage + outputs i18n + e2e 12-r3-roker-labels) → fresh re-review 10/10 on all 7 dimensions. Files changed after the features/security/audit reviews: only RokerPage.tsx, outputs.{hi,en}.ts, the new e2e spec and screenshot helpers (UI-only). .gitignore now excludes test-results/, playwright-report/, server/data/, .playwright-mcp/, *.db.
- Evidence: SCORES security=10 code=10 (round3-security-code.md); integrity=10 offline=10 ops=10 (round3-audit.md); features=10 uat=10 (round3-features-uat.md); visual/usability/hierarchy/feedback/a11y/copy/perf/overall = 10 (round3b-ui-ux.md); all BLOCKERS: 0. Controller final run: tsc exit 0; vitest 93/93 (18 files); server 39/39; build OK (precache 102 / 1314.83 KiB); playwright 32 passed (14 specs); perf cold LCP 1384 ms / warm 88 ms / CLS 0.001; 0 XSS sinks; no servers left running; lock free.
- Next: user sets git identity and approves a commit; P1 backlog = "Remaining — honest" list in TASKS.md (N2 device binding, C9 audio file, etc.).

## 2026-10-09 08:25 IST — Completion batch started (remaining items)
- What: user asked to finish the remaining items. Controller extended the type contract (RateUnit piece/kg/day, WorkKind, RateP.work, 'job' record + JobP, SlipP.speechHi), wrote SPEC-014..018 in SPECS.md and the ownership/seam table in architecture.md, and marked the batch DOING in TASKS.md.
- Why: TASKS.md "Remaining" list (N2 device binding, C9 audio clip, C2 units, K2 full, K1 monthly, GPS check); git commit stays blocked on identity + explicit yes.
- Evidence: `npx tsc -p tsconfig.app.json --noEmit` → exit 0 after the type change.
- Next: 4 parallel implementers (n2, c9, c2, k) → controller wiring → independent reviews → fixes → full verification.

## 2026-10-09 09:26 IST — k_finish: SPEC-017/018 UI + e2e completion
- What: finished the K2/K1 UI + e2e surface on top of k's domain work.
  (1) DigestPage: added the "इस महीने" monthly card (monthlySummary/monthLabel/
  monthlyTextHi/En) with a prev/next month selector (48×48 px buttons, next
  disabled at the current month), every number on its own labelled row, a
  rejects line "— (अभी दर्ज नहीं)", on-screen Hindi share text + a second
  PreviewShareSheet to settings.ownerPhone; plus a no-wool alert row driven by
  digest.noWoolLoomCodes (new key digest.noWoolLooms in outputs.{hi,en}).
  (2) ExporterMockPage: legend now 5 columns incl. no_wool (grey #d8dbe3 tile +
  Package icon, #1f2430 ink ≈ 11:1 contrast ≥ 4.5:1), each status with its own
  icon, counts straight from the live loomBoard.
  (3) Updated existing board assertions to the PRD grid {on_track:17, slow:3,
  idle:3, no_wool:1, free:0}: smoke.spec.ts board.by + 07-exporter-mock.spec.ts
  legend (legend-no_wool=1, legend-free=0).
  (4) New e2e/16-k2-k1.spec.ts: SPEC-017 AC1..AC5 (board grid+legend, order
  filter narrows, free-soon pace 2in/day→~10d, dues ₹4,000+₹2,000=₹6,000,
  today's entries by author) and SPEC-018 AC1..AC3 (demo month incl. live
  bazaar 79.33 sqft/₹3,014.54/short 0.613kg + loss=short÷used, reversed bazaar
  excluded, Hindi share preview one fact per line).
- Why: SPEC-017/018 (K2 full owner home + K1 monthly) were DOING; the domain
  was built but the digest/exporter screens and the e2e coverage were missing.
- Evidence: `npx tsc -p tsconfig.app.json --noEmit` → exit 0; `npx vitest run`
  → 200 passed / 23 files; under the e2e lock `npx playwright test
  --project=mobile e2e/07-exporter-mock.spec.ts e2e/smoke.spec.ts
  e2e/16-k2-k1.spec.ts` → 14 passed (24.9s). outputs.{hi,en}.ts key counts match
  (275 each). Lock acquired via mkdir /tmp/bunkar-e2e.lock and released after
  each run (incl. the first run with 2 self-test failures I then fixed:
  loom-tile count race → wait for first tile; monthly AC1 → add the live bazaar
  record on top of the seed before reading the current month).
- Scope: edited only owned files — app/src/features/{digest,exporter}/*,
  app/src/i18n/outputs.{hi,en}.ts, app/e2e/{07-exporter-mock,smoke,16-k2-k1}.spec.ts.
  Did not touch home/* or domain/* (no defects found there). Note for k:
  seed.ts line 8 header comment still says "1 free" — stale vs the body
  (line 366: 1 no_wool / 0 free) and the actual output; cosmetic only.
- Next: none from k_finish; controller may re-run the full suite + reviews.

---

## 2026-10-09 09:30 IST — integrator: completion batch SPEC-014..018 + GPS verified green

**What** — Integrated and finished the completion batch (owning everything except the
k_finish files). Reviewed each area against its SPEC acceptance criteria by reading the
code, confirmed the server side (n2 device binding, c9 slip-audio route, c2 job rules)
was fully wired and passing, then ran the whole suite and fixed every failure at root cause:

1. **projections.ts barrel (controller request)** — added exports for `owner.ts`
   (`loomsFreeSoon`, `peshgiOutstanding`, `todayEntriesByUser` + types), `monthly.ts`
   (`monthlySummary`, `monthLabel`, `monthlyTextHi/En`, `MonthlySummary`), and `speech.ts`
   (`hindiNumber`, `rupeesSpoken`, `decimalSpoken`, `kgSpoken`, `ftInSpoken`, `pieceIdSpoken`).
   (jobs helpers were already exported.)
2. **e2e/15-c2-jobs.spec.ts (3 failures) — AC1/AC2/AC3 root causes:**
   - AC1/AC2 passed a bare arrow `"() => …"` to the `projection()` helper, which does
     `return (${body})` → it returned the *function* (serialised to `undefined`), not its
     result. Fixed to IIFE form `"(() => …)()"` to match every other spec's convention.
   - AC3 used `getByLabel('Name', { exact: true })` on a **required** field whose visible
     label is `Name *` (asterisk span) → exact match never fits. Switched to a non-exact
     `getByLabel('Name').first()` like the other required fields in the file.
3. **RatesPage.tsx (c2) regression broke e2e/02-masters (specs 01..12):** the new job-rate
   sheet reused `aria-label` "Rupees per unit", so `getByLabel('Rupees per unit')` (non-exact)
   matched two inputs → strict-mode violation. Gave the job-rate field a distinct label key
   `rate.field.rupeesJob` ("Rate (₹ per unit)" / "दर (₹ प्रति इकाई)") that does **not** contain
   "Rupees per unit" / "रुपये प्रति इकाई" as a substring (masters.{en,hi}.ts).
4. **Docs** — README: confirmed the optional voice-engine section (`cd server/tts && npm ci`,
   GPL-3.0-or-later espeak-ng isolated in a separate child process, 503 `tts_unavailable`
   fallback to on-device TTS), the `HOST` env row (bind 127.0.0.1 → loopback only), and a
   "Run locally (built app)" section (`HOST=127.0.0.1 PORT=8790 BUNKAR_SECRET=… node index.mjs`
   + `npm run build && VITE_API_TARGET=http://localhost:8790 npx vite preview --port 4180 --host 127.0.0.1`).
   Verified `HOST` (index.mjs) and `VITE_API_TARGET` (vite.config preview proxy) are real.
   TASKS.md completion-batch rows → DONE with cited specs; this log.

**Why** — Close SPEC-014 (n2 devices), SPEC-015 (c9 audio), SPEC-016 (c2 jobs) and the
B1/B2 GPS check; keep specs 01..12 green; add the controller-requested barrel exports; ship
operability docs. k_finish owns SPEC-017/018 code (home/digest/exporter/outputs) + specs
07/16/smoke + db/types.ts — not edited here; their e2e (16-k2-k1) passes in the full run.

**Evidence** (Node v24.21.0):
- `npx tsc -p tsconfig.app.json --noEmit` → exit 0.
- `npx vitest run` → **Test Files 23 passed (23); Tests 200 passed (200)**.
- `cd server && node --test` → **tests 72 · pass 72 · fail 0**.
- `npx vite build` → exit 0, PWA precache **107 entries / 1372.92 KiB**.
- `npx playwright test` (holding /tmp/bunkar-e2e.lock, released) → **54 passed (2.3m)**, 0 failed,
  19 spec files incl. 13-n2-devices (AC1..5), 14-c9-audio (3), 15-c2-jobs (4), 16-k2-k1, 17-gps (3).
- espeak-ng synth sanity: `echo … | node server/tts/synth.mjs` → 64 KB buffer starting `RIFF`.

**Transient note** — During the run the k agent was still editing `features/digest/DigestPage.tsx`
(unused-import / Badge-variant tsc errors appeared and cleared within ~90 s); once k settled,
tsc returned to exit 0. Not edited by this integrator (k_finish-owned).

**Next** — Nothing outstanding in my areas. Git commit stays BLOCKED (needs git identity +
explicit user "yes"); never committed.

## 2026-10-09 10:15 IST — Completion batch done (SPEC-014..018 + GPS); hosted locally
- What: N2 one-device-per-login + owner remote sign-out; C9 server-rendered Hindi WAV clip (espeak-ng isolated in server/tts, GPL kept out of the core) + spoken-number script + share file; C2 piece rate + kg/day/piece job payments (roker, passbook, server recompute); K2 full owner home (no-wool status, order filter, free in 30 days, dues, staff entries); K1 monthly summary; GPS verified. Controller wired GET /api/slips/:token/audio, added HOST binding, and fixed review/E2E findings at the root: free-soon estimate clamped in domain (never negative), Settings phones load error + retry (was mislabelled "sign-out failed"), bazaar payment default now set on step transition (removed post-render race that flaked e2e 03).
- Evidence: tsc exit 0; vitest 201/201 (23 files); server 72/72; build precache 107 / 1374.10 KiB; playwright 56 passed (21 specs; payment specs ×3 repeat = 33/33); reviews batch-features-uat 10/10, batch-security-code 10/10, batch-ui-ux-3 all 10 (BLOCKERS 0).
- Hosted: http://localhost:4180 (built PWA, SW active, 0 page errors) proxying to API 127.0.0.1:8790; `diff -rq` hosted dist == final build; health OK.
- Next: user sets git identity and says "yes" to commit.

## 2026-10-09 18:52 IST — First commit pushed to GitHub (public repo)
- What: repo-local git identity (Pranjal Dubey <pranjaldubey428@gmail.com>), origin = https://github.com/Iampranjaldubey/BunkarOS.git, first commit 962d754 (351 files) pushed to main; added .kiro/skills/THIRD_PARTY_LICENSES.md (MIT/Apache texts for vendored skills) before publishing.
- Why: user asked to set up git and push (explicit "yes"; repo confirmed public).
- Evidence: pre-commit scan found 0 secrets/tokens/demo keys in committed files; `git ls-remote origin refs/heads/main` → 962d754… = local HEAD; `git status -sb` → main...origin/main. Tokens were used only via a temporary askpass helper and are not stored in git config or any credentials file.
- Next: user revokes both pasted tokens; desktop/tablet layout (SPEC-019).

## 2026-10-09 19:52 IST — WIP commit: desktop layout (SPEC-019) shell + partial pages
- What: SPEC-019 + responsive layout contract; shell (SideNav, PageGrid, ResponsiveTable, FormGrid, centered Sheet at lg, AppLayout side menu, desktop Playwright project + e2e 20); page agents were stopped mid-way by the user, leaving partial desktop changes in home, digest, exporter, lists (orders, looms, weavers, thekedars, yarn, roker, audit) and forms (new-entity pages, yarn issue/return, shared pickers). All local servers stopped at the user's request.
- Why: user asked to commit everything done so far.
- Evidence: `tsc -p tsconfig.app.json --noEmit` → exit 0; vitest 23 files / 205 passed; `vite build` OK (precache 106 entries / 1401.76 KiB); secret scan of changed files → 0 hits. NOT yet run: mobile + desktop Playwright suites on this state.
- Next: "resume desktop" → finish remaining pages (settings, bazaar wizard/receipt, peshgi, jobs, check-in, slip, login/setup, rates), run mobile + desktop e2e, independent review.

## 2026-10-10 03:15 IST — SPEC-019 desktop & tablet layout complete
- What: finished every screen's desktop layout (bazaar wizard + live summary, receipt, peshgi, other work, check-in, settings, rates, slip page, login/setup). Fixed root causes found while testing: (1) phone and desktop versions were both built and one hidden with CSS → duplicate names for tests and screen readers; now only the version that fits is built (`useIsDesktop`, `PhoneOnly`/`DesktopOnly`, ResponsiveTable/AppLayout/BazaarSummary); (2) table header sat 64 px low inside its scroll box and blocked clicks on row 1; (3) content started under the side menu at 1024 px and was squeezed to ~900 px on wide screens → side-menu offset moved to an outer wrapper; (4) side menu listed Orders/Looms twice; (5) small targets (exporter link, Deactivate, 38 px loom tiles → 6/8 per row); (6) visual polish: roker add button, rates "Work" header + human dates, empty wool rows until a carpet is picked, home summary tiles. Also fixed a sync race: `syncNow()` returned immediately when a sync was already running, so an entry saved meanwhile stayed pending (caused a flaky edge-case test); now it waits and runs one more cycle (new unit test).
- Evidence: tsc exit 0; vitest 23 files / 206 passed; server 72/72; playwright full run "73 passed" (55 mobile, 17 desktop, 1 offline); desktop audit 132 route×role×width checks at 1024/1280/1440/1920 → 0 findings, 0 page errors, visible focus rings; perf cold LCP 1436 ms, warm 88 ms, CLS ≤ 0.004; main chunk 18.15 KB gzip (+6.3 KB, budget 10 KB).
- Next: user review; optional push to GitHub (needs a new token or SSH key).

## 2026-10-22 17:45 IST — Language choice on setup + login
- What: new `components/ui/LanguageSwitch.tsx` (हिंदी / EN) shown top-right on `/setup` and `/login` and reused in the app header. Choice applies instantly, is remembered on the device and carries into the app after login. Also fixed Settings → Unit settings → Language: saving it only took effect after a reload (used the non-reactive setter); now switches at once.
- Why: user — before login only Hindi was available; user should pick Hindi or English.
- Evidence: tsc exit 0; vitest 23 files / 206 passed; new `e2e/24-language.spec.ts` passed (setup default Hindi → EN applies without reload, `html[lang=en]`; login English → Hindi → reload kept → EN → app in English; Settings save → Hindi immediately). Full e2e on a throwaway stack (user's dev servers on 5173/8787 left running): 63 passed + 2 skipped; the 9 others failed only on hard-coded ports and passed (17/17) from port-swapped copies. Screenshots of setup/login at 390 px and 1440 px checked.
- Next: commit when the user says so.
