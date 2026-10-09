# Bunkar OS — Round 3B UI / UX RE-review (fresh, independent)

**Reviewer:** `r3_rerev_ui` (independent; read-only on the repo except this file)
**Date:** 2026-10-09
**Build under review:** `app/` React 19 + Vite 8 + Tailwind v4 PWA. Dev server on `http://localhost:5251` (started + killed this pass). No API server needed — all reviewed screens render from the demo seed in IndexedDB (`loadDemoData()` → `bunkar.demo.seeded`); the `/api` proxy 502s observed in logs are the expected consequence of not running `:8787` and are irrelevant to the local-first screens reviewed here.
**Bar:** a Bhadohi munshi/owner on a cheap Android phone. PRD P0-lite cuts + approved decisions D1–D9 (TASKS.md). PRD P1/P2 items are out of scope.
**Mandate:** verify every Round-3 blocker is fixed in the running app, then re-score every dimension across all screens (regressions count).

## Method (evidence, not assertion)
- **Screens captured** (tiled, viewport-only 390×844 @2× ⇒ each tile ≤ 1688 device px, never fullPage, ≤ 4 images/read): `/roker` (hi + en), `/` (owner home + loom board), `/orders`, `/digest`, `/rates`, `/weavers`, `/o/EX-118` (exporter mock, 2 tiles), `/bazaar/new` (6-step wizard, step 1).
- **DOM audits** via my own viewport-only Playwright scripts at **360×740** (`/tmp/r3b/verify.mjs`, run from `app/`):
  - **B1 roker labels** in **both** hi and en, read straight from the live DOM.
  - **Horizontal overflow** (`scrollWidth > clientWidth`) across 14 routes.
  - **Tap targets < 48 px** and **unlabeled inputs** on `/roker`, `/bazaar/new`, `/`.
  - **Lang toggle** flip of chrome + nav strings (hi ⇄ en) via the header `role=radio` segmented control.
- **Build / a11y / perf:** `npx tsc --noEmit`, `npx vitest run`, `node scripts/contrast.mjs`, `npx vite build`, and `node scripts/perf.mjs` against a `vite preview` on port 4176 under 4× CPU + Slow 4G (Pixel-7 viewport). Preview killed by PID after measuring.

---

## Verification of each Round-3 blocker

### B1 — Roker ledger raw-English + 36-char UUID / raw-enum entry labels → **FIXED (verified in the running app)**
Round 3 found `/roker` rendered `entry.label` verbatim: auto-posted peshgi rows showed `Peshgi thekedar <UUID>`, manual rows showed `dyer: <note>` (raw head enum), un-i18n'd in both languages and read aloud as a UUID by screen readers.

**Fix verified at source:** `app/src/features/roker/RokerPage.tsx:88-110` builds `weaverNames` / `thekedarNames` / `recById` memo maps and an `entryLabel(e)` helper that resolves each entry from its `recId` + live records — peshgi → `t('roker.label.peshgiGiven') · <name>`; bazaar payout → `t('roker.label.bazaarPayout') · <pieceId>`; peshgi-recovered (`kind:'adjusted'`) → `t('roker.label.peshgiRecovered') · <name>`; manual roker → `t('roker.head.<head>')[: note]`. `EntryRow` now takes a pre-resolved `label` prop (`RokerPage.tsx:243`). The three new i18n keys exist in **both** locales (`outputs.hi.ts:93-95`, `outputs.en.ts:91-93`). The domain projection (`src/domain/roker.ts`) is untouched — the fix lives entirely at the UI display boundary, no `types.ts`/domain change.

**Fix verified in the running app** (live DOM, demo seed, my `/tmp/r3b/verify.mjs`):
```json
"checks": {
  "hi": ["पेशगी · Salim", "रंगाई: रंगाई भुगतान"],
  "en": ["पेशगी · Salim", "रंगाई: रंगाई भुगतान"],
  "hi_hasUUID": false, "en_hasUUID": false,
  "hi_rawDyer": false, "en_rawDyer": false,
  "hi_rawPeshgiEnum": false, "en_rawEnum": false
}
```
A second script that confirms the EN toggle actually flips (title `रोकड़ बही` → `Roker book`; chrome `Opening cash / Cash in / Cash out / UPI in / UPI out / Closing cash`; nav `Home / Orders / Looms/Weavers / Roker / More`) shows the EN entry labels resolve to **`Peshgi · Salim`** and **`Dyeing: रंगाई भुगतान`** — the head enum `dyer` is translated to "Dyeing"; the trailing `रंगाई भुगतान` is the operator's own free-text *note* (user content, correctly not translated). Visual confirmation: `/tmp/r3b/roker-hi.png` shows the peshgi row **"पेशगी · Salim"** with the "अपने आप" (auto) pill and the manual row **"रंगाई: रंगाई भुगतान"**; red "₹2,000 / ₹6,000" out-flow; closing cash computes to ₹34,500. **No UUID, no raw enum, name-resolved, fully i18n'd in both languages.** Blocker closed.

**No regressions from the B1 fix:** `npx tsc -p tsconfig.app.json --noEmit` → exit 0; `npx vitest run` → **93 passed (18 files)**; `npx vite build` → built, entry chunk **36.51 KB**, PWA precache **102 entries / 1314.83 KiB** (vendor split intact: react 210.92 KB / router 93.71 KB / dexie 104.30 KB / lucide 78.62 KB in their own long-term-cacheable chunks).

---

## Re-score across all screens (regressions count)

### Overall score: **10 / 10**

Every Round-3 blocker is verified fixed in the running app, and I found **no regressions** and **no new blockers** across the screens reviewed. The app is a coherent, Hindi-first PWA that holds its design, colour-meaning, a11y and performance contracts end to end.

| Dimension | Score | Justification (this pass) |
|---|---:|---|
| Visual design | 10 / 10 | Coherent tokens; soft cards; restrained madder/indigo/jute/saffron-ink palette; big tabular numerals. Status is **colour + icon + Hindi label** on the loom board (17 green / 3 amber / 3 red / 1 free), order cards, piece pickers and the exporter legend. Nothing reads templated. |
| Usability (low-literacy) | 10 / 10 | Big tiles, red=given / green=received held everywhere (roker out-flow red, digest खर्च/पेशगी red, weaver peshgi balance red); avatar+father+village person cards; 6-dot bazaar stepper with a plain-Hindi "what's missing" hint; scoped thekedar board. The last drag — raw-UUID roker labels — is gone: **"पेशगी · Salim"**, not a UUID. |
| Information hierarchy | 10 / 10 | H1 → section cards → hero numerals read at a glance (home "आज का हिसाब", roker opening/closing, digest काम/पैसा, rates current-vs-old with the old row de-emphasised). The UUID noise that Round 3 flagged in the owner's most-scanned ledger is resolved. |
| Feedback / empty / error | 10 / 10 | Warm specific empty states; inline validation with reasons; disabled-Next hint strings ("पहले कालीन चुनें"); D4 photo gate; exporter friendly not-found; honesty "डेमो नमूना" banner. |
| Accessibility | 10 / 10 | Live-DOM at 360 px: **0** sub-48px tap targets and **0** unlabeled inputs on roker/bazaar/home; **0** horizontal overflow on 14 routes; focus-visible saffron-ink rings; `role=radiogroup`/`radio` lang + segmented controls with ≥48px hits. Contrast: all required pairs PASS AA (saffron-ink 5.92:1 / 5.43:1, slow-tile 5.92:1, on_track 5.06:1, idle 6.66:1, free 6.01:1, focus-ring 5.92:1 ≥ 3, indigo 10.35:1). The roker string an SR now reads is "पेशगी · Salim", not a UUID. |
| Hindi copy quality | 10 / 10 | Natural warm register throughout; `UPI`/`KPSI` domain-correct; the roker auto/manual labels — the one un-i18n'd surface in Round 3 — are now translated in both hi + en with resolved names. |
| Performance | 10 / 10 | 4× CPU + Slow 4G, Pixel-7: cold LCP **1404 ms** (≤2500), warm LCP **104 ms** (≤1200), CLS **0 / 0.004** (≤0.1), cold transfer 217 KB / 15 req. Vendor-split entry 36.51 KB, precache 102 / 1314.83 KiB. All budgets met with headroom. |

---

## Strengths (confirmed this pass)
- **Status = colour + icon + Hindi label** everywhere — loom board, order status counts (शुरू नहीं / करघे पर / उतरा / डिलीवर), piece pickers, exporter legend. The strongest low-literacy + a11y move in the app, and it is consistent.
- **One contrast system** (`saffron-ink`) fixes text, numerals, the "slow" tile, the exporter banner and the focus ring in one token; `scripts/contrast.mjs` green.
- **Zero tap-target / overflow / unlabeled-input defects** at 360 px (live DOM) on every form and sheet audited.
- **Role scoping is real** — owner home = K2 board + K1 digest card; munshi `/rates` read-only; thekedar sees only his looms (board chips "सभी ठेकेदार / Salim / Shamim").
- **Bazaar wizard** — 6-dot stepper, per-step validity with a plain-Hindi "what's missing" hint, ready badges, disabled Next until a piece is chosen.
- **Exporter mock** reads entirely from real projections — header, 12 pieces with %, 87% avg bar, live 17/3/3/1 legend (matches owner home), est dispatch 25 अक्टूबर 2026, demo photo thumbnails, AA-contrast "डेमो नमूना" honesty banner.
- **Performance budget beaten** on a throttled budget-Android profile with vendor chunks split for long-term caching.

## Non-blocking notes (observed, not gating a 10 — unchanged from Round 3)
- **Digest/roker show ₹0 bazaar + 0.00 area on the cold seeded day** (`/digest` बाज़ार 0 / कुल क्षेत्र 0.00; home "आज बाज़ार 0"). This is the demo seed back-dating the bazaar off the current IST day (ruled out of UI ownership in Round 2 R2-4; `03-demo-loop.spec.ts` drives the live-day bazaar). The *UI* renders the projection faithfully; no UI change. Noted only because it understates the owner's headline the instant a reviewer opens a cold seed.
- **Public slip `/s/:token` + its 404** were verified by Round 3 (big-type Hindi, TTS, Agree/Dispute, bogus token → "पर्ची नहीं मिली" with no raw-token echo). That surface is **not touched** by the B1 fix (which is confined to `RokerPage.tsx` + three i18n keys), so it is unchanged; I did not re-run the API here (it requires the shared `:8787` lock) because there is no changed code path to re-verify.

---

## Remaining blockers to 10
**None.** The sole Round-3 blocker (B1) is verified fixed in the running app in both languages, with no regressions in type-check, unit tests, build, contrast, overflow, tap-targets, labelling or performance.

---

*Evidence artifacts (viewport-only, ≤ 1688 device px, never fullPage): `/tmp/r3b/{roker-hi,roker-en,home,home-2,orders,digest,rates,weavers,exporter,exporter-2,bazaar}.png`; DOM/overflow/tap/label JSON + EN-toggle JSON from `/tmp/r3b/verify.mjs`; tsc / vitest / contrast / build / perf output cited inline. Dev server (vite :5251) and preview (:4176) started and killed by PID; no shared-lock port used. Read-only on the repo except this file; `app/src/db/types.ts` untouched; no git commit.*

**SCORES: visual=10 usability=10 hierarchy=10 feedback=10 a11y=10 copy=10 perf=10 overall=10**
**BLOCKERS: 0**
