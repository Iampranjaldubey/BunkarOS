# Bunkar OS — Task Board

## Legend
- **Status**: TODO · DOING · BLOCKED · DONE
- **Owner**: who holds it (agent/user)
- **Spec**: link to spec id in `SPECS.md`
- Keep in sync with `.superpowers/sdd/<plan>/progress.md`.

## Now
- **P0 SHIPPED (2026-10-09 08:15 IST)** — all 19 P0 features + A2 mock built, tested end to end,
  audited, UAT'd and independently reviewed at **10/10 on every dimension, 0 blockers**
  (`docs/reviews/round3-security-code.md`, `round3-audit.md`, `round3-features-uat.md`, `round3b-ui-ux.md`).
  Final verification: `npx tsc -p tsconfig.app.json --noEmit` → exit 0 · `npx vitest run` → **93 passed / 18 files** ·
  `server/ node --test` → **39 passed** · `npx vite build` → precache 102 entries / 1314.83 KiB ·
  `npx playwright test` → **32 passed** (14 spec files) · perf (4× CPU + Slow 4G) cold LCP ~1.4 s, warm ~0.1 s, CLS ≤ 0.004.
- Waiting on user: set git `user.name`/`user.email`, then approve a commit (nothing committed yet).
- Earlier milestone notes:
- P0 build complete; demo-hardening + round-2 core fixes landed. Verification (2026-10-09):
  `cd app && npx tsc -p tsconfig.app.json --noEmit` → **exit 0**;
  `npx vitest run` → **87 passed / 17 files** (added money/tauli property tests);
  `server/ node --test` → **39 passed** (added two-device bootstrap tests);
  `npx playwright test` → **30 passed** (added `11-two-device-join.spec.ts`; stable ×2).
- Round-2 core: two-device JOIN bootstrap wired (server token-less user-records pull +
  client `bootstrapUsers` + login retry); root `README.md` added (operability); `device`
  on `AuditEntry`; `AUTH_RATE_MAX` env-configurable for the shared-IP e2e harness.

## Next — P0 build sequence (from PRD scope table)
Status is DONE only where the feature's acceptance tests pass; cited by Vitest file
and/or Playwright spec. "DOING" means engine done + unit-tested but a demo/UAT gap
remains (tracked under "Remaining — honest").

| # | Features | Deliverable | Spec | Status | Acceptance evidence |
|---|----------|-------------|------|--------|---------------------|
| 1 | M1/N2/N1 | App shell + roles + audit log | SPEC-001 | DONE | `e2e/01-setup-roles.spec.ts` (owner/munshi/thekedar login, rate read-only, lockout), `e2e/smoke.spec.ts`; `permissions.test.ts`, `records.test.ts`. N2 device-binding deferred to P1 (SPEC-001 Scope-Out). |
| 2 | M3/M5 | Offline queue + photo capture | SPEC-002 | DONE | `e2e/05-offline.spec.ts`, `e2e/05b-offline-shell.spec.ts`, `e2e/09-m5-photo-guards.spec.ts` (bazaar paid > ₹2,000 & peshgi give > ₹2,000 blocked w/o photo; ₹2,000 allowed). |
| 3 | B1/C1 | Weaver + loom/piece registries | SPEC-003 | DONE | `e2e/02-masters.spec.ts`; `e2e/08-settings-thekedar.spec.ts` (thekedar user binds to entity, sees exactly his 12 looms). |
| 4 | A1 | Order split into pieces | SPEC-004 | DONE | `e2e/02-masters.spec.ts`, `e2e/07-exporter-mock.spec.ts` (EX-118 count=12); `pieces.test.ts` (7). |
| 5 | E1 | Yarn issue/return + balances | SPEC-005 | DONE | `e2e/03-demo-loop.spec.ts` (2nd 12 kg issue + 1.1 kg return → used 22.900), `e2e/06-edge-cases.spec.ts` c (over-return blocked). |
| 6 | C2 | Rate card + lock | SPEC-006 | DONE | `e2e/01-setup-roles.spec.ts` (munshi read-only + server reject), `e2e/06-edge-cases.spec.ts` d (missing rate blocks wage); `rates.test.ts` (4). |
| 7 | C3/E2 | Bazaar (received) + tauli | SPEC-007 | DONE | `e2e/03-demo-loop.spec.ts` (area 79.33, gross ₹3,014.54, net ₹1,954.54, paid ₹1,955, short 0.613), `e2e/06-edge-cases.spec.ts` a/e/f; `wage.test.ts`, `money.test.ts`, `tauli.test.ts`. |
| 8 | C5 | Peshgi ledger | SPEC-008 | DONE | `e2e/03-demo-loop.spec.ts` (₹1,000 recovery), `e2e/06-edge-cases.spec.ts` b (over-recovery blocked), `e2e/09-m5-photo-guards.spec.ts` b; `peshgi.test.ts` (3). |
| 9 | C8/C9 | Slips (text + voice) | SPEC-009 | DONE | `e2e/03-demo-loop.spec.ts` (slip share sheet), `e2e/04-slip-public.spec.ts` (public slip agree/dispute + bogus token); `slip.test.ts` (9), `server/test/slips`. C9 = D3 on-page TTS (SPEC-009 Scope-Out), not a generated audio file. |
| 10 | B2 | Check-in / status | SPEC-010 | DONE | `e2e/08-settings-thekedar.spec.ts` (scoped loom picker renders), board driven by check-ins; `board.test.ts`, `pieces.test.ts`. |
| 11 | O1 | Roker (owner ledger) | SPEC-011 | DONE | `e2e/03-demo-loop.spec.ts` (opening ₹42,500 → closing ₹34,500 after today's seeded ₹8,000 cash-out + UPI bazaar), `e2e/06-edge-cases.spec.ts` g (reversal drops posting); `roker.test.ts` (3). |
| 12 | K2/K1 | Owner home + digest | SPEC-012 | DONE | `e2e/03-demo-loop.spec.ts` (digest shows today's bazaar + ₹1,955 UPI paid); board 17/3/3/1 verified via `e2e/07-exporter-mock.spec.ts` legend; `digest.test.ts`, `board.test.ts`. |
| + | A2 | Static exporter mock | SPEC-013 | DONE | `e2e/07-exporter-mock.spec.ts` (real seeded EX-118, 12 pieces, legend 17/3/3/1, est dispatch, consent note, Demo-mock badge, safe not-found). |

## Remaining — honest (post-P0 / P1)
**Completion batch DONE (user: "continue and finish the remaining task", 2026-10-09):**

| Item | Spec | Status |
|---|---|---|
| N2 one device per login + remote sign-out | SPEC-014 | DONE — `e2e/13-n2-devices.spec.ts` (AC1..AC5: device_bound notice, owner remote sign-out, owner takeover, munshi 403, shared phone); `server/test/devices.test.mjs` + token/sync suites (72/72). |
| C9 real Hindi audio clip (server WAV + share file) | SPEC-015 | DONE — `e2e/14-c9-audio.spec.ts` (audio/wav RIFF 200, ▶ playing state, device-TTS fallback on abort); `server/test/slip-audio*.test.mjs`; `domain/speech.test.ts` (spoken Hindi). espeak-ng synth verified → 64 KB RIFF WAV. |
| C2 piece rate + kg/day/piece job payments | SPEC-016 | DONE — `e2e/15-c2-jobs.spec.ts` (AC1 piece-rate flat gross, AC2 ₹7/kg·12.5kg→₹88, AC3 helper ₹350/day·1.5→₹525 name-required, AC4 no-rate block); `domain/jobs.test.ts` (14); `server/test/jobs.test.mjs` (tamper→invalid_amounts). |
| K2 full owner home (no-wool status, order filter, free in 30 days, dues, staff entries) | SPEC-017 | DONE — `e2e/16-k2-k1.spec.ts` (board 17/3/3/1-no_wool, order filter, loomsFreeSoon, peshgiOutstanding dues, todayEntriesByUser); `domain/owner.test.ts` (6), `board.test.ts` (11). |
| K1 monthly summary | SPEC-018 | DONE — `e2e/16-k2-k1.spec.ts` (monthlySummary sqft/wage/short, reversed excluded, Hindi share text); `domain/monthly.test.ts` (6). |
| B1/B2 GPS capture — verify wired + e2e | SPEC-003/010 | DONE — `e2e/17-gps.spec.ts` (loom lat/lng on grant, check-in lat/lng on grant, graceful save on permission denied). |
| Git commit | — | BLOCKED: needs git user.name/email + explicit "yes" |

Completion-batch verification (integrator, 2026-10-09, Node v24.21.0):
`npx tsc -p tsconfig.app.json --noEmit` → exit 0 · `npx vitest run` → **200 passed / 23 files** ·
`cd server && node --test` → **72 pass / 0 fail** · `npx vite build` → exit 0, precache **107 entries / 1372.92 KiB** ·
`npx playwright test` (under /tmp/bunkar-e2e.lock) → **54 passed / 0 failed** (19 spec files, incl. 13/14/15/16/17).

Final controller verification (2026-10-09, after review fixes — free-soon clamp, devices load-error state, bazaar payment default):
tsc exit 0 · vitest **201 passed / 23 files** · server **72 / 72** · build precache **107 entries / 1374.10 KiB** ·
playwright **56 passed / 0 failed** (21 spec files). Reviews: `docs/reviews/batch-features-uat.md` features=10 uat=10 ·
`batch-security-code.md` security=10 code=10 · `batch-ui-ux-3.md` all 7 dimensions 10, overall 10 · all BLOCKERS: 0.

**Hosted locally:** app http://localhost:4180 (production build, service worker) → API http://127.0.0.1:8790
(loopback only, data in `server/data/bunkar-local.db`, stable secret in `server/data/.local-secret`, both git-ignored).

Original notes:
- **N2 device-binding** ("one device per login") — not implemented; deferred to P1 and documented in SPEC-001 Scope-Out. A `device` id is stamped for audit only.
- **C9 shareable audio file** — P0 ships D3 on-page Hindi TTS; a server-generated audio clip is P1 (SPEC-009 Scope-Out).
- **B1 GPS capture** in `LoomNewPage` (optional lat/lng) — not wired to UI; schema supports it. (Owned by registries agent.)
- **C2 piece/kg/day + sqgaj-only** — only sqft/sqgaj rate units shipped (SPEC-006 lite-cut); piece/kg/day = P1.
- **K1 monthly rollup** (sq ft/month) and **K2 "looms free in next N days"** — not shown; P1.
- **Cross-fixer note (server agent):** earlier a `tsc` error existed in `src/sync/client.ts` (initial `state` missing `authState` from the new `SyncStateView`); it is now resolved (tsc exit 0 as of 2026-10-09). No further action by this fixer.

## Blocked
- **Kiro CLI v3** — DONE (early release, opt-in). 2.28.0 installed; launch V3 with `kiro-cli --v3 chat --agent superpowers-v3`. V2 still works: `kiro-cli chat --agent superpowers`. Backups: ~/.kiro/backup-2.20.1/, ~/.kiro/backup-agents-v2/, ~/.kiro/backup-sessions-v2/.

## Done
- git init (branch `main`)
- Node v24.21.0 via nvm
- 21 skills installed into `.kiro/skills`
- Agents + MCP configured

## Decisions (approved by user 2026-10-09, all "A")
| # | Topic | Decision |
|---|-------|----------|
| D1 | Tauli | Primary: (given − returned) vs carpet weight; 3% allowed wastage on **used** wool (given − returned). Size × gm/sq ft norm shown as a reference line. |
| D2 | Rate date | Rate in force on the **first wool issue** for the piece; locked to the piece. |
| D3 | Voice slip | WhatsApp text (wa.me) with short link → web page plays Hindi audio + Agree/Dispute. |
| D4 | Photo (M5) | Mandatory for every deduction and write-off; for payments/advances > ₹2,000 (owner-configurable). |
| D5 | Piece status | Not started → On loom → Off loom (bazaar done) → Delivered; side state On hold. |
| D6 | Rounding | Area 2 dp sq ft; weights 3 dp kg; money in integer paise; only net paid rounded to ₹1, rounding shown on slip. |
| D7 | Peshgi recovery | Netted from wage; roker records net paid only; recovery in peshgi ledger. |
| D8 | Thekedar | Minimal entity (name, phone, looms) + wool balance per thekedar. No tiers/ledger (D1 feature stays P1). |
| D9 | Idle threshold | Yellow after 4 days, red after 7 days with no check-in progress; owner-configurable. |
