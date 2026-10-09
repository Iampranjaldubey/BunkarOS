# Bunkar OS — Round 2 UI / UX Review (fresh, independent)

**Reviewer:** `r2_ui_ux` (independent, read-only on app code; port 5201)
**Date:** 2026-10-09
**Build under review:** `app/` React 19 + Vite 8 + Tailwind v4 PWA. Dev server on `http://localhost:5201` (started + killed for this pass; lock held via `/tmp/bunkar-e2e.lock` and released).
**Skills applied:** `.kiro/skills/frontend-design`, `accessibility`, `core-web-vitals`, `performance`.
**Method:** Seeded the demo via module import (`loadDemoData()` → `bunkar.demo.seeded` marker) through `scripts/shot.mjs --demo`; height-capped viewport-only screenshots (390×844, DPR 2) of 14+ routes; a 360×740 second pass for overflow; live-DOM audits (tap-target bounding boxes, computed colours → WCAG math, label association, keyboard focus order); `node scripts/contrast.mjs`; production bundle from `npx vite build`.
**Scope note:** `server/` was not running (per lock/role constraints), so API-backed screens show the expected two 502s per page; all data-rich assessments used the module-import seed, which populates projections correctly (board 17/3/3/1 confirmed on both the owner home and the exporter mock).

---

## Verification of Round-1 fixes (docs/reviews/ui-ux.md Fix log)

| # | Round-1 fix claim | Verified? | Evidence |
|---|---|---|---|
| 1 | saffron-ink token for all saffron **text** | ✅ PASS | `scripts/contrast.mjs`: `saffron-ink on white 5.92:1`, `on page bg 5.43:1`. `index.css:21` defines `--color-saffron-ink:#8a5a0a`. |
| 2 | "slow" tile → `bg-saffron-ink text-white` | ✅ PASS | `HomePage.tsx:36` `slow:'bg-saffron-ink text-white'`; contrast `white on saffron-ink 5.92:1`; screenshot `/tmp/r2ui/home.png` tiles 18–20 legible. |
| 3 | status icons (not colour alone) | ✅ PASS | `HomePage.tsx:40-51` `STATUS_ICON` (Check/Clock/Pause/Circle) rendered on legend + every tile; visible in `home.png`. |
| 4 | 48 px language toggle | ✅ PASS | `SegmentedControl.tsx:40` `min-h-12 min-w-12`; `AppLayout.tsx` full `हिंदी / EN` labels. |
| 5 | audit raw-key → Hindi labels | ✅ PASS | `AuditPage.tsx:98-102` `typeLabel()` via `t('rec.type.*')`; `grep -c rec.type` = **19 in hi.ts and 19 in en.ts**. |
| 6 | slip 404 / gone / offline branches | ✅ PASS | `PublicSlipPage.tsx:30-32,52-54,145-175` distinct `notfound`(404)/`gone`(410)/`offline`(network) states. |
| 7 | digest toggle ≥48 px hit area | ✅ PASS | live DOM: `role=switch` = **64×48 px**. |
| 8 | real photos via PhotoThumb | ✅ PASS | `grep PhotoThumb` across weavers/looms/thekedars/pickers; PersonPicker loads `photoUrl`. |
| 10 | focus ring → saffron-ink | ✅ PASS | `index.css:81` `outline:3px solid var(--color-saffron-ink)`; contrast `5.92:1 (need 3:1)`. |
| 11 | free-tile text `#464d60` | ✅ PASS | `HomePage.tsx:38`; contrast `free tile 6.01:1`. |
| — | **Exporter mock saffron (handed off, NOT fixed)** | ❌ STILL BROKEN | see **R2-1** below. |

Also independently cleared: **unlabeled inputs = 0** on all 13 app routes (live DOM); **no horizontal overflow at 360 px** on all 14 routes (`scrollWidth==clientWidth==360`); keyboard focus order on `/bazaar/new` is logical (skip-link → sync badge → lang toggle → back → search → piece options).

---

## Overall score: **8.2 / 10**

The Round-1 fixes are real and verified — this is now a strong, coherent, Hindi-first PWA. The remaining gap to 10 is small and concrete: one **contrast fail that survived** on the exporter mock (another agent's file), one **tap-target control below the project's own 48 px rule that both prior passes missed** (the header sync badge, present on every screen), and a cluster of **polish items** (thekedar filter chips <48 px, rates hero/row labelling, roker/digest showing ₹0 on a seeded-busy day).

### Score by dimension

| Dimension | Score | One-line justification |
|---|---:|---|
| Visual design | 9 / 10 | Coherent tokens, soft cards, restrained palette, big tabular numerals; icon+colour status is a genuine lift. |
| Usability for low-literacy Hindi users | 8 / 10 | Big tiles, red/green money contract, step wizards, status icons; dragged by sub-48 px sync badge + filter chips. |
| Information hierarchy | 9 / 10 | H1 → section cards → big numerals; loom board, order cards, digest sections all read at a glance. |
| Feedback / empty / error states | 9 / 10 | Specific, warm, actionable empty states; distinct 404/gone/offline on the slip; disabled-wizard now has a reason. |
| Accessibility | 7 / 10 | Labels/focus/lang/skip-link/contrast all fixed in-app; **sync-badge 31 px**, **filter chips 34 px**, and the **exporter saffron fail** hold it under 9. |
| Hindi copy quality | 9 / 10 | Natural warm register, consistent; audit now localised; a couple of English brand tokens ("UPI", "KPSI") are domain-correct. |
| Performance (bundle) | 7 / 10 | Great route-splitting (1–9 KB gzip/page), but ~**180 KB gzip critical path** (entry 77 + lucide 62 + shared 34 + css 8) and a 1.81 MB precache are heavy for a ₹6k Android. |

---

## Performance / bundle evidence (`npx vite build`)

```
dist/assets/index-*.js            246.45 kB │ gzip: 77.32 kB   ← app entry
dist/assets/createLucideIcon-*.js 206.96 kB │ gzip: 62.00 kB   ← lucide icons
dist/assets/client-*.js           102.24 kB │ gzip: 33.81 kB   ← shared (dexie/repo)
dist/assets/index-*.css            38.59 kB │ gzip:  7.77 kB
dist/assets/SettingsPage-*.js      27.04 kB │ gzip:  8.91 kB
dist/assets/BazaarNewPage-*.js     16.77 kB │ gzip:  4.97 kB
... per-route pages 1–9 kB gzip ...
PWA generateSW precache 107 entries (1811.65 KiB)
```

Critical path before any route code ≈ **77.3 + 62.0 + 33.8 + 7.8 ≈ 181 KB gzip** → ~2–4 s JS transfer+parse on a budget phone over 3G. Levers unchanged from R1: lucide (62 KB) and the 1.81 MB precache.

---

## Issues that block a 10 (strict; file:line + exact fix)

### P0 — blocks shipping

**[R2-1] Exporter mock still fails WCAG AA contrast (saffron) — the one handed-off item that was never fixed.**
Live DOM at `/o/EX-118`: the "डेमो नमूना" banner computes **white (rgb 255,255,255) on saffron (rgb 201,138,28) = 2.94:1** (needs 4.5:1 text / 3:1 large). The `on_hold` status chip uses `text-saffron` (2.94:1 on its tint). This is a public, no-login exporter surface.
- `app/src/features/exporter/ExporterMockPage.tsx:40` — `className="bg-saffron px-4 py-2 … text-white"` → change fill to the accessible token: `className="bg-saffron-ink px-4 py-2 … text-white"` (white on `#8a5a0a` = 5.92:1).
- `app/src/features/exporter/ExporterMockPage.tsx:20` — `on_hold: 'bg-saffron/15 text-saffron'` → `on_hold: 'bg-saffron/20 text-saffron-ink'` (matches `Badge.tsx` `warn` tone, ~5.4:1 on the tint).
- `app/src/features/exporter/ExporterMockPage.tsx:115` — `bg-saffron/15 text-saffron` on the est-dispatch icon → `bg-saffron/20 text-saffron-ink` (the icon is `aria-hidden`, but keep it consistent with the fixed in-app surfaces).
- `app/src/features/exporter/ExporterMockPage.tsx:230` — legend `slow` swatch `cls:'bg-saffron'`: this swatch is decorative (`aria-hidden`) but it is the exporter's copy of the board legend and no longer matches the owner home, where "slow" is now `saffron-ink`. Change to `cls:'bg-saffron-ink'` so the two legends are identical and the amber reads as a deliberate dark-amber, not the failing bright saffron.
  *Evidence:* `focus2.mjs` → `banner contrast: 2.94:1`; `grep text-saffron` → lines 20, 40, 115, 230 are the only functional saffron left in `src/` (plus one decorative `DemoPanel.tsx:64`, dev-only, acceptable).

### P1 — fix before a 10

**[R2-2] Header sync-badge is an interactive control at 93×31 px — below the project's own 48 px tap rule, on *every* screen. (Missed by both prior passes.)**
When `pending > 0` the `SyncBadge` renders a real `<button onClick={syncNow}>` wrapping a `Badge`; live DOM measured it at **93×31 px** on all 13 routes. It clears the WCAG 2.5.8 24 px floor but violates the architecture's "min tap target 48 px" rule, and it is the primary "force a sync now" affordance.
- `app/src/components/ui/SyncBadge.tsx:38-45` — the pending `<button>` has `className="rounded-full"` with no sizing. Add a 48 px hit area without visually enlarging the pill, e.g. `className="inline-flex min-h-12 items-center rounded-full"` (and, if space is tight in the 390 px header, drop the badge's own `py-1` so the taller hit area absorbs it). Alternatively wrap with `className="tap-48 inline-flex items-center justify-center"` (the `.tap-48` utility already exists in `index.css:140`).
  *Evidence:* tap-target audit → `{tag:"button", txt:"155 बाकी", w:93, h:31}` on `/`, `/looms`, `/orders`, `/weavers`, `/yarn`, `/bazaar/new`, `/peshgi/new`, … (every route).

**[R2-3] Thekedar filter chips on the owner home are 34 px tall — below the 48 px rule.**
Live DOM on `/`: "सभी ठेकेदार" 83×34, "Salim" 59×34, "Shamim" 76×34. These are frequently-used filters on the owner's primary screen.
- `app/src/features/home/HomePage.tsx:96-120` — both chip buttons use `className={cn('rounded-full px-3 py-1.5 text-sm …')}`. Bump to a 48 px hit area: add `min-h-12` (and keep the pill visual via vertical centering), e.g. `'inline-flex min-h-12 items-center rounded-full px-4 text-sm font-medium …'`.
  *Evidence:* tap-target audit → `/` items `सभी ठेकेदार 83×34`, `Salim 59×34`, `Shamim 76×34`.

**[R2-4] Roker/digest show ₹0 and 0 bazaars on a seeded "busy" day — the owner's headline numbers read as "nothing happened".**
On `/digest` (seeded) the "काम" and "पैसा" sections show बाज़ार 0, कुल क्षेत्र 0.00, नकद दिया ₹0, UPI दिया ₹0 — yet पेशगी दी ₹2,000 and 155 pending sync. The demo's bazaar/roker postings are not landing on the current IST day, so the owner's at-a-glance screen understates activity. This is a projection/seed-date issue (root cause is in `src/domain/*` or the demo seed, **outside UI ownership**) but it directly damages the UX of the two most-looked-at owner screens, so it must be resolved before a 10.
- Hand to the **domain/demo owner**: verify `digest(recs, day, nowISO)` / `rokerDay(recs, day)` `day` matching against the seeded records' `day` (IST). From the UI side, nothing to change once postings land.
  *Evidence:* `/tmp/r2ui/digest.png` (बाज़ार 0, नकद ₹0, पेशगी ₹2,000) and `/tmp/r2ui/home.png` ("आज बाज़ार 0, नकद दिया ₹0").

### P2 — polish (not individually blocking, but needed for a clean 10)

**[R2-5] Rates "अभी का रेट" hero (₹40) sits directly above a "₹38" row — momentary current-vs-old confusion.**
`/rates` shows the hero `Kashan 60 KPSI … ₹40 / वर्ग फुट` then `पुराने रेट 2026-08-10 से ₹38`. It *is* labelled (अभी का रेट vs पुराने रेट) so it is not wrong, but the two big ₹ figures compete.
- `app/src/features/rates/RatesPage.tsx` — de-emphasise the old-rate row (smaller numeral / `text-muted`) so only the current rate is a hero figure.
  *Evidence:* `/tmp/r2ui/rates.png`.

**[R2-6] Lucide ships as one 62 KB-gzip chunk on the critical path.**
Imports are already individual named imports (tree-shaken to ~60 glyphs), so this is not a quick win, but on a budget phone it is the second-largest payload. Consider a lazy icon strategy or pruning rarely-used glyphs for a measurable LCP/INP gain.
- *Evidence:* build output `createLucideIcon-*.js 206.96 kB / gzip 62.00`.

---

## What's genuinely good (keep)

- **Status = colour + icon + Hindi label** on the loom board and legend — the single biggest accessibility+low-literacy win since R1 (`HomePage.tsx` `STATUS_ICON`), verified in `home.png`.
- **Contrast system holds** — one `saffron-ink` token fixed badges, home, yarn, bazaar, audit, digest, slip, and the focus ring at once; `scripts/contrast.mjs` passes all required pairs.
- **Zero layout breakage at 360 px** and **zero unlabeled inputs** across all routes (live DOM).
- **Honest sharing + distinct error states** — digest shows the full WhatsApp text preview before send; the public slip now distinguishes 404 / expired / offline.
- **Excellent code-splitting** — per-route page chunks are 1–9 KB gzip.
- **Exporter mock reads from real projections** — header, 12 pieces, 87% avg, live 17/3/3/1 legend, projected dispatch 2026-10-25, J2 consent note, "डेमो नमूना" honesty banner; friendly not-found that no longer echoes the raw id.

## Fix order (impact-first)
1. **R2-1** exporter saffron (4 call-sites in one file) — closes the last contrast fail.
2. **R2-2** sync-badge 48 px (one component, every screen).
3. **R2-3** thekedar filter chips 48 px.
4. **R2-4** roker/digest day-0 postings (domain/demo owner).
5. **R2-5 / R2-6** rates hero de-emphasis; lucide trimming.

---

*Evidence artifacts:* screenshots `/tmp/r2ui/{home,orders,rates,exporter,bazaar,digest}.png` (all ≤3600 CSS px, viewport-only); contrast + build output cited inline; audit scripts were run from `app/` and removed after use. Dev server (vite :5201) started and killed (`curl :5201 → 000`, no `vite --port 5201` process). No app source modified; `app/src/db/types.ts` untouched; no git commit.


---

## Round 2 fix log (`r2_fix_ui`, 2026-10-09)

All UI/UX blockers from this review are fixed, with an e2e test for every behavioural change. Owned files only (index.css, components/ui/*, app/*, features/*, i18n/*, e2e/*). `server/`, `src/domain`, `src/db`, `src/sync`, `src/app/session.tsx` and `src/db/types.ts` untouched. No git commit.

| Finding | Fix (file:line) | Evidence |
|---|---|---|
| **R2-1** Exporter mock saffron fails AA (banner white-on-saffron 2.94:1; `on_hold` chip, est-dispatch chip, legend slow swatch) | `features/exporter/ExporterMockPage.tsx`: banner `bg-saffron`→`bg-saffron-ink` (:40); `on_hold` tone `bg-saffron/15 text-saffron`→`bg-saffron/20 text-saffron-ink` (:20); est-dispatch chip `bg-saffron/15 text-saffron`→`bg-saffron/20 text-saffron-ink` (:115); legend slow swatch `cls:'bg-saffron'`→`'bg-saffron-ink'` (:230, now identical to the owner-home board legend which uses `STATUS_TILE.slow = bg-saffron-ink text-white`) | `node scripts/contrast.mjs` → "slow tile: white on saffron-ink fill **5.92:1 PASS**" (banner now uses this pair; was the 2.94:1 fail). E2E `e2e/10-r2-ui-fixes.spec.ts` "R2-1" asserts the live banner `backgroundColor === rgb(138, 90, 10)` (#8a5a0a). Screenshot `/o/EX-118` confirms dark-amber banner + matching slow swatch. |
| **R2-2** Header sync-badge interactive at 93×31px on every screen (below 48px rule) | `components/ui/SyncBadge.tsx:38` — pending `<button>` `className="rounded-full"` → `className="tap-48 inline-flex items-center justify-center rounded-full"` (the `.tap-48` utility = `min-height:48px; min-width:48px`, `index.css:140`); pill visual unchanged, hit area now 48px | E2E `e2e/10-r2-ui-fixes.spec.ts` "R2-2": routes `/api/sync` to abort so records stay pending while online (the only state the force-sync button renders), then `boundingBox().height/width >= 48`. **Passes.** |
| **R2-3** Thekedar filter chips on owner home 34px tall | `features/home/HomePage.tsx` — both chip buttons `rounded-full px-3 py-1.5` → `inline-flex min-h-12 items-center rounded-full px-4` (the "all" chip + the per-thekedar chips) | E2E `e2e/10-r2-ui-fixes.spec.ts` "R2-3": iterates every chip in the `group[aria-label="Filter by thekedar"]`, asserts `boundingBox().height >= 48`. **Passes.** Screenshot `/` shows taller pills. |
| **R2-4** Roker/digest ₹0 on seeded day | Out of UI ownership (projection/seed day-matching). The live `03-demo-loop.spec.ts` already drives + asserts the day's bazaar (bazaarCount 1 / UPI ₹1,955) after the operator records it; the demo seed is backdated by design (confirmed by r2_features_uat). No UI change. |
| **R2-5** Rates hero vs old-rate numeral competition | `features/rates/RatesPage.tsx` — history row amount de-emphasised: `text-ink` bold figure dropped to `text-muted` (row is `text-sm text-muted`), so only the current rate (`text-2xl font-bold text-indigo`) reads as the hero figure | tsc clean; visual de-emphasis of the old-rate row (no second competing dark numeral). |
| **R2-6** Lucide 62KB-gzip critical-path chunk | P2 polish, not a correctness/a11y blocker; icons are already individual named (tree-shaken) imports. Left as a documented post-P0 lever (lazy-icon strategy) to avoid churn to shared imports under the round-2 scope. |

### Verification gate (all green)
```
cd app
npx tsc -p tsconfig.app.json --noEmit     → exit 0
npx vitest run                            → 15 files / 83 tests passed
npx vite build                            → built OK (dist/sw.js; precache 107 entries)
npx playwright test  (under lock)         → 29 passed (26 prior + 3 new R2 fix tests)
node scripts/contrast.mjs                 → all required pairs meet WCAG AA
```
Ports 5203/5173/4173/8787/8788 confirmed clear (`curl → 000`); `/tmp/bunkar-e2e.lock` released; temp screenshots removed.
