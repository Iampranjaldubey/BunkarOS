# Round 3 — Features + UAT review (fresh independent reviewer)

Scope: Bunkar OS P0. Read-only review of `app/` (React+Vite PWA), `server/`
(Node API), `app/e2e/`. Verified against `SPECS.md` (SPEC-000..013), the PRD P0
"lite" scope (`docs/prd/Bunkar_OS_Product_Research.html` §id=scope), the
architecture contract, and the approved decisions D1–D9 in `TASKS.md`.

Node v24.21.0. All shared-port work (API :8787 for the vite proxy, Playwright)
was done while holding `/tmp/bunkar-e2e.lock` (released after every run). My own
Vite ran on port 5232; my scripted UAT lives under `/tmp/r3uat/` only. No repo
files were modified (the one temp Playwright config I created in `app/` was
removed; `test-results/` cleaned). I never committed.

## Verification evidence (independent re-run)

| Command | Final line |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | `tsc exit=0` |
| `npx vitest run` | `Test Files 18 passed (18)` / `Tests 93 passed (93)` |
| `cd server && node --test` | `ℹ tests 39` / `ℹ pass 39` / `ℹ fail 0` |
| `npx vite build` | `✓ built` · `precache 102 entries (1313.83 KiB)` |
| `npx playwright test` (project suite, under lock) | `30 passed (1.4m)` |
| `/tmp/r3uat/uat.spec.ts` (my own 6-scenario UAT, under lock, vite :5232 + API :8787) | `6 passed (20.4s)` |

My independent UAT (owner, munshi, thekedar, weaver public slip in a fresh
context, A2 mock, offline→sync) drives the real UI + the real domain
projections — not the project's own specs — so it is independent corroboration.
Final line: `6 passed … lock released, uat exit=0`.

## Per-feature table (19 P0 + A2)

| PRD | SPEC | Feature | Verified via (independent) | Features | UAT |
|---|---|---|---|---|---|
| M1 | 001 | Hindi-first shell, big numerals, roles | UAT owner/munshi/thekedar homes render; i18n hi default + EN toggle; smoke 26 | 10 | 10 |
| N2 | 001 | Role perms + reversal (owner any / munshi own-today) | e2e 06h munshi can't reverse yesterday; 06g owner reversal drops posting | 10 | 10 |
| N1 | 001 | Append-only audit, PIN login | UAT setup→login (AC1/AC2); e2e 01 lockout after 5 wrong PINs; audit page | 10 | 10 |
| M3 | 002 | Offline queue + sync badge | **My UAT**: checkin offline → `sync:'pending'`, usable in projection, drains to `synced` online; e2e 05 | 10 | 10 |
| M5 | 002 | Photo capture + mandatory-photo guards | e2e 09 bazaar>₹2k & peshgi>₹2k blocked w/o photo; UAT deduction photo mandatory | 10 | 10 |
| B1 | 003 | Loom registry (+photos, thekedar link) | UAT thekedar looms; e2e 08 binding; listLooms | 10 | 10 |
| C1 | 003 | Weaver registry | UAT weaver resolved from piece; listWeavers; 3 "Mohammad Rafiq" by father | 10 | 10 |
| A1 | 004 | Order → 12 pieces, assign, status | **My UAT**: EX-118 count=12, exporter/design exact; e2e 07 | 10 | 10 |
| E1 | 005 | Yarn issue/return + balances | **My UAT loop**: 2×12 kg issue + 1.1 kg return → issued 24000 / returned 1100 | 10 | 10 |
| C2 | 006 | Rate card owner-only + lock at first issue | **My UAT**: rateForPiece=3800/sqft; e2e 01 munshi forced rate → `forbidden_role` rejected | 10 | 10 |
| C3 | 007 | Bazaar wage | **My UAT**: area 79.33, gross ₹3,014.54, net ₹1,954.54, paid ₹1,955, rounding +46 | 10 | 10 |
| E2 | 007 | Tauli variance | **My UAT**: short 0.613 kg (613 g), cause required, extra 0; tauli.ts matches D1 | 10 | 10 |
| C5 | 008 | Peshgi give/recover | **My UAT**: ₹1,000 recovered at bazaar nets exactly (balance −100000); e2e 06b over-recover blocked | 10 | 10 |
| C8 | 009 | Hindi slip + wa.me share via PreviewShareSheet | **My UAT**: share sheet shows recipient + full text + `/s/` link | 10 | 10 |
| C9 | 009 | Public slip page + Hindi TTS + Agree/Dispute (D3) | **My UAT**: `/s/:token` in fresh context → agree; `slip-speak` TTS; noVoice fallback; bogus token friendly 404 | 10 | 10 |
| B2 | 010 | Check-in photo + length → % woven | **My UAT**: 50"/100" → pctWoven 50 offline; thekedar scoped picker | 10 | 10 |
| O1 | 011 | Roker cash/UPI auto-post | **My UAT**: opening ₹42,500 → closing ₹34,500; bazaar posts net only via UPI; e2e 06g reversal drops posting | 10 | 10 |
| K2 | 012 | Owner loom board | **My UAT**: board 17 on_track / 3 slow / 3 idle / 1 free (single source of truth) | 10 | 10 |
| K1 | 012 | 8 pm digest + share | **My UAT**: digest woolOutside>0, ordersAtRisk contains EX-121; digest page renders | 10 | 10 |
| A2 | 013 | Static exporter mock (public) | **My UAT**: `/o/EX-118` real header + legend 17/3/3/1, no Obeetee/Ziegler; unknown id → friendly not-found, raw id not echoed | 10 | 10 |

Two-device join (README §Two-device): project e2e `11-two-device-join.spec.ts`
"a joined second device bootstraps users, logs in, and sees synced data" — passed
in my independent run of the full suite (test 25, 30 passed).

Decisions D1–D9 all honoured and spot-checked: D1 tauli formula (`src/domain/tauli.ts`
`short=max(0,gap-allowed)`, `extra=max(0,carpet-used)`), D2 rate lock at first
yarn issue (`rateForPiece`), D3 on-page TTS not an audio file (SPEC-009 Scope-Out,
confirmed `PublicSlipPage.tsx:76-81`), D4 photo thresholds (e2e 09), D5 lifecycle,
D6 only net paid rounded to ₹1 (rounding 46 shown), D7 roker posts net only
(UAT), D8 minimal thekedar + wool balance, D9 idle thresholds 4/7 (board).

PRD-marked P1/P2 items correctly treated as **not gaps**: N2 one-device/remote
sign-out (P1), B2 reason codes, C2 per-kg/day & sqgaj-only, K1 monthly summary,
C9 server-generated audio file, B1 GPS-to-UI. C9-as-D3 (on-page TTS) is the
approved delivery, not a gap.

## Blockers to 10/10

None. Every SPEC-000..013 acceptance criterion and every P0 feature (19 + A2
mock) is implemented and independently verified by passing tool output above:
own-UAT 6/6, project e2e 30/30, vitest 93/93, server 39/39, tsc clean, build
clean. No code defect was found; all four roles complete the PRD 6-step demo
end-to-end with sync, the two-device join works, and offline entries queue then
drain to synced.

SCORES: features=10 uat=10
BLOCKERS: 0
