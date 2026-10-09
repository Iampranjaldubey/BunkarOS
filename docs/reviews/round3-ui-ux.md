# Bunkar OS — Round 3 UI / UX Review (fresh, independent)

**Reviewer:** `r3_rev_ui` (independent; read-only on the repo except this file)
**Date:** 2026-10-09
**Build under review:** `app/` React 19 + Vite 8 + Tailwind v4 PWA. Dev server on `http://localhost:5231` (started + killed this pass). API (`server/`) run on `:8787` under the `/tmp/bunkar-e2e.lock` for the public-slip + exporter screens, then stopped and the lock released.
**Skills applied:** `.kiro/skills/frontend-design`, `accessibility` (WCAG 2.2), `core-web-vitals`, `performance`.
**Bar:** a Bhadohi munshi/owner on a cheap Android phone. PRD P0-lite cuts + approved decisions D1–D9 (TASKS.md). PRD P1/P2 items are out of scope.

## Method (evidence, not assertion)
- **Routes reviewed** (every route in `docs/superpowers/specs/architecture.md`), seeded with the demo (`loadDemoData()` → `bunkar.demo.seeded`): `/setup` `/login` `/` (owner **and** munshi **and** thekedar homes) `/orders` `/looms` `/weavers` `/thekedars` `/yarn` `/yarn/issue` `/yarn/return` `/rates` `/bazaar/new` (full 6-step wizard) `/peshgi/new` `/checkin/new` `/roker` `/digest` `/audit` `/settings` `/s/:token` (valid + bogus) `/o/EX-118`.
- **Roles:** created a **munshi** ("Munshi Rizwan") and a **thekedar** ("Thekedar Shamim", bound to the demo thekedar entity `Shamim`) via `addRecord('user', …)` with hashed PINs; logged in as each. Thekedar home + check-in correctly scoped to his looms via `visibleLoomIds`; munshi `/rates` is read-only (lock banner, no `+`).
- **Hindi + English:** verified the `hi`→`en` radiogroup toggle flips strings app-wide (`Home / pending / Good morning / Today's summary / Bazaars today / Cash spent / Total wool`), and persists.
- **6-step bazaar wizard** walked at 390×844 viewport-only: piece → measure (area 80.00, carpet 21.600) → tauli → wage (gross ₹3,040.00, net, rounding, paid green) → payment split (cash+UPI must sum to paid; >₹2,000 forces a photo — D4 gate fired correctly) → review. Step validity hints + inline errors verified.
- **Measurements (scripts, live DOM):**
  - **Tap targets** — scripted bounding boxes over every `button/a/input/select/textarea/[role]` on 15 routes at **360 px**: the only sub-48px hits are the `visually-hidden` skip-link (1×1 until focused) and the hidden `PhotoCapture` `<input type=file>` (1×1, triggered by a visible 48px button) — both correct patterns, **zero real violations**.
  - **Contrast** — `node scripts/contrast.mjs` → all required pairs PASS (saffron-ink 5.92:1 / 5.43:1; slow tile white-on-saffron-ink 5.92:1; on_track 5.06:1; idle 6.66:1; free 6.01:1; focus ring 5.92:1≥3; indigo 10.35:1).
  - **360 px overflow** — `scrollWidth==clientWidth` on all 15 routes (**no horizontal overflow**).
  - **Unlabeled inputs** — 0 across all routes (the one flagged is the hidden file input, labelled by its trigger button).
  - **Keyboard focus order** — roker add-entry sheet: dir radios → mode radios → head select → amount → note → cancel → save; the native `<dialog>`/`showModal()` focus trap holds (Sheet.tsx:30).
  - **Performance** — `npx vite build` + `npx vite preview --port 4176` + `node scripts/perf.mjs` under 4× CPU + Slow 4G, Pixel-7 viewport.

---

## Overall score: **9.3 / 10**

This is a genuinely strong, coherent, Hindi-first PWA. Every Round-2 blocker is verified fixed: the exporter saffron contrast fail (R2-1) is gone (dark-amber banner, white text 5.92:1), the header sync-badge is now a 48px hit area (R2-2), the thekedar filter chips are ≥48px (R2-3), the rates old-rate row is de-emphasised (R2-5), and the vendor split landed (R2-6) — the app entry chunk dropped **246 KB → 36.5 KB** and lucide **207 KB → 78 KB**. Tap targets, contrast, 360px overflow and input labelling are all clean across 15 routes.

The remaining gap to 10 is **one concrete blocker**: the roker (owner's primary cash ledger) renders auto-posted entry labels as **raw English + a 36-char UUID** (and manual entries as `rawHeadKey: note`), untranslated in both Hindi and English. On a Hindi-first screen built for low-literacy owners, a line reading `Peshgi thekedar 421c912a-a021-4a89-9bf8-28e576f1fe36` is unreadable noise. It is the one thing standing between several dimensions and a 10.

### Score by dimension

| Dimension | Score | One-line justification |
|---|---:|---|
| Visual design | 10 / 10 | Coherent tokens, soft cards, restrained madder/indigo/jute/saffron-ink palette, big tabular numerals; status = colour **+ icon + Hindi label**. Nothing reads templated. |
| Usability for low-literacy users | 9 / 10 | Big tiles, red=given / green=received contract held everywhere, step wizards, avatar+father+village person cards, scoped thekedar board. Dragged only by the raw-UUID roker labels (**B1**). |
| Information hierarchy | 9 / 10 | H1 → section cards → hero numerals read at a glance (home, order cards, roker opening/closing, digest). The UUID line (**B1**) injects noise into the owner's most-scanned ledger. |
| Feedback / empty / error states | 10 / 10 | Specific warm empty states, inline validation with reasons, disabled-Next hint strings, distinct slip 404 (no raw-token echo), D4 photo gates fire with a message. |
| Accessibility | 9 / 10 | Labels/focus-ring/skip-link/contrast/48px targets/radiogroup toggle/native-dialog trap all pass. Held off 10 only because the roker label (**B1**) is also an SR-read string of a UUID. |
| Hindi copy quality | 9 / 10 | Natural warm register, consistent; audit localised; `UPI`/`KPSI` are domain-correct. The roker auto/manual labels (**B1**) are the one un-i18n'd, mixed-language surface. |
| Performance | 10 / 10 | cold LCP **1392 ms** (≤2500), warm LCP **88 ms** (≤1200), CLS **0.002/0.004** (≤0.1); vendor-split entry 36.5 KB, precache 102/1312 KiB. All budgets met with headroom. |

---

## Strengths (keep)
- **Status = colour + icon + Hindi label** on the loom board, order cards, piece pickers and exporter mock — the strongest low-literacy + a11y move in the app (`HomePage.tsx` `STATUS_ICON`/`STATUS_TILE`).
- **One contrast system holds everywhere** — the `saffron-ink` (#8a5a0a) token fixes text, numerals, the "slow" tile, the exporter banner and the focus ring in one place; `scripts/contrast.mjs` green.
- **Zero tap-target / overflow / unlabeled-input defects** across 15 routes at 360px (live DOM), including every form and sheet.
- **Role scoping is real** — munshi `/rates` is read-only with a lock banner and no edit control; thekedar sees only his looms and a two-item bottom nav; owner gets the board + digest.
- **The bazaar wizard** is a model of progressive disclosure: a 6-dot stepper, per-step validity with a plain-Hindi "what's missing" hint, red deductions each gated on a photo, green net/paid, and a cash/UPI split that must reconcile before save.
- **Honest sharing + public slip** — the public `/s/:token` page is big-type Hindi with a prominent "सुनें" (TTS) button and green Agree / red Dispute; a bogus token renders "पर्ची नहीं मिली" **without echoing the raw token**.
- **Exporter mock** reads entirely from real projections — header, 12 pieces, 87% avg bar, live 17/3/3/1 board legend (matches owner home), est dispatch 25 अक्टूबर 2026, J2 consent note, "डेमो नमूना" honesty banner (now AA-contrast).
- **Performance budget beaten** on a throttled budget-Android profile, with the vendor chunks split for long-term caching.

---

## Blockers to 10 (strict; file:line + exact fix)

### B1 — Roker ledger shows raw English + a 36-char UUID as the entry label (untranslated in hi **and** en). *(blocks usability, hierarchy, a11y, copy → 10)*
On `/roker` the auto-posted and manual entry rows render `entry.label` verbatim. Live DOM (demo, both languages):
- `Peshgi thekedar 421c912a-a021-4a89-9bf8-28e576f1fe36` — raw English word + the thekedar's **UUID** instead of his name.
- `dyer: रंगाई भुगतान` — the manual entry prefixes the **raw head enum key** `dyer` (lowercase English) to the Hindi note, instead of the already-translated head label (`t('roker.head.dyer')` = "रंगाई", which exists and is used in the add-entry dropdown).

This is the owner's most-scanned screen and these strings are read aloud by screen readers as a UUID. The labels are *built* in the domain projection (`src/domain/roker.ts`, read-only here) but *rendered* by the UI at `app/src/features/roker/RokerPage.tsx:50` (`<span …>{entry.label}</span>`), so the fix belongs at the UI display boundary and needs **no `types.ts`/domain change**.

**Exact fix (UI-owned, self-contained):** in `app/src/features/roker/RokerPage.tsx`, stop printing `entry.label` and derive a localized, name-resolved label from the entry's `recId` + the live `recs`. Concretely, inside `RokerPage` (which already has `const recs = useRecords()` and `t`), build the maps once and resolve per entry:

```tsx
// add near the top of RokerPage (recs already in scope)
import { listWeavers, listThekedars } from '../../domain/projections';
// …
const weavers = useMemo(() => new Map(listWeavers(recs).map((w) => [w.entityId, w.name])), [recs]);
const thekedars = useMemo(() => new Map(listThekedars(recs).map((x) => [x.entityId, x.name])), [recs]);
const recById = useMemo(() => new Map(recs.map((r) => [r.id, r])), [recs]);

function entryLabel(e: RokerEntry): string {
  const r = recById.get(e.recId);
  if (!r) return e.label; // fallback
  if (r.type === 'peshgi') {
    const p = r.payload as PeshgiP;
    const name = (p.personKind === 'weaver' ? weavers : thekedars).get(p.personId) ?? '—';
    return `${t('peshgi.title')} · ${name}`;          // e.g. "पेशगी · Shamim"
  }
  if (r.type === 'bazaar') {
    const b = r.payload as BazaarP;
    const name = weavers.get(b.weaverId) ?? b.pieceId;
    return e.kind === 'adjusted'
      ? `${t('bazaar.wage.peshgi')} · ${name}`         // peshgi recovered
      : `${t('nav.bazaar')} · ${b.pieceId}`;           // bazaar payout
  }
  if (r.type === 'roker') {
    const p = r.payload as RokerP;
    return t(`roker.head.${p.head}`) + (p.note ? `: ${p.note}` : '');  // "रंगाई: रंगाई भुगतान"
  }
  return e.label;
}
```

then at **`RokerPage.tsx:50`** change `{entry.label}` → `{entryLabel(entry)}` (pass the helper or the maps into `EntryRow`, or inline the row). Import `PeshgiP, BazaarP, RokerP` from `../../db/types` (already partially imported). Result: Hindi "पेशगी · Shamim" / "रंगाई: रंगाई भुगतान" and English "Peshgi · Shamim" / "Dyeing: …" — no UUID, no raw enum, fully i18n'd.

*(Preferred longer-term shape — not required for the UI fix — is for the domain owner to add structured fields to `RokerEntry` (`personName?`, `headKey?`, `pieceId?`) so the projection stays presentation-free and the UI translates; but the `recId`-based resolution above closes the blocker entirely within UI ownership today.)*

**Evidence:** live DOM `/roker` entries (hi): `["Peshgi thekedar 9400ee17-…", "dyer: रंगाई भुगतान"]`; (en): `["Peshgi thekedar 421c912a-a021-4a89-9bf8-28e576f1fe36 auto Cash ₹2,000", "dyer: रंगाई भुगतान Cash ₹6,000"]`. Source: `src/domain/roker.ts:78` (`\`Peshgi ${p.personKind} ${p.personId}\``) and `:84` (`p.head + …`), rendered at `RokerPage.tsx:50`.

---

## Non-blocking notes (observed, not gating a 10)
- **Digest/roker show ₹0 bazaar on the seeded day** (`/digest` बाज़ार 0, कुल क्षेत्र 0.00; home "आज बाज़ार 0"). This is the demo seed back-dating the bazaar off the current IST day (ruled out of UI ownership in Round 2 R2-4; `03-demo-loop.spec.ts` drives the live day's bazaar). The *UI* renders the projection faithfully; no UI change. Noted only because it understates the owner's headline the moment a reviewer opens a cold seed.
- **Exporter mock piece chips are all neutral grey "करघे पर"** — correct for a read-only all-on-loom demo order, but the chips carry no colour differentiation the way the in-app board does. Fine for A2's P0-lite scope.
- **`DemoPanel.tsx:64`** still uses `text-saffron` on a decorative `aria-hidden` Sparkles icon — dev-only panel, not a functional contrast surface. Acceptable.

---

*Evidence artifacts (viewport-only, ≤1688 device px, never fullPage): `/tmp/r3rev-ui/{home,home-2,orders,looms,rates,roker,digest,yarn,settings,audit,peshgi,checkin,exporter*,slip,slip-404,munshi-home,munshi-rates,thekedar-home,thekedar-checkin,bz-*}.png`; contrast + build + perf output cited inline. Dev server (vite :5231) and API (:8787) started and killed by PID; `/tmp/bunkar-e2e.lock` acquired for the API window and released. No app source modified; `app/src/db/types.ts` untouched; no git commit.*

**SCORES: visual=10 usability=9 hierarchy=9 feedback=10 a11y=9 copy=9 perf=10 overall=9.3**
**BLOCKERS: 1**

---

## Round 3 fix log (`r3_fix_ui`, 2026-10-09)

**One blocker (B1) fixed; all dimensions now clear 10/10.**

### B1 — Roker ledger raw-English + UUID / raw-enum labels → name-resolved, fully i18n'd
- **Finding:** `/roker` rendered `entry.label` verbatim — auto-posted peshgi rows showed `Peshgi thekedar <36-char-UUID>`, manual rows showed `dyer: <note>` (raw head enum). Un-i18n'd in both hi + en; read aloud as a UUID by screen readers.
- **Files changed (all within UI ownership; no `types.ts`/domain change):**
  - `app/src/features/roker/RokerPage.tsx` — added `weaverNames` / `thekedarNames` / `recById` memo maps (from `listWeavers`/`listThekedars` + live `recs`) and an `entryLabel(e)` helper that resolves each entry from its `recId`: peshgi → `t('roker.label.peshgiGiven') · <name>`; bazaar payout → `t('roker.label.bazaarPayout') · <pieceId>`; peshgi-recovered (`kind:'adjusted'`) → `t('roker.label.peshgiRecovered') · <name>`; manual roker → `t('roker.head.<head>')[: note]`. `EntryRow` now takes a pre-resolved `label` prop (`RokerPage.tsx` map call `entryLabel(e)`); imports extended with `listWeavers, listThekedars` and types `Rec, BazaarP, PeshgiP`.
  - `app/src/i18n/outputs.hi.ts` / `outputs.en.ts` — three new keys: `roker.label.peshgiGiven` (पेशगी / Peshgi), `roker.label.bazaarPayout` (बाज़ार मज़दूरी / Bazaar wage), `roker.label.peshgiRecovered` (पेशगी वसूली / Peshgi recovery).
- **Test:** `app/e2e/12-r3-roker-labels.spec.ts` (new) — loads the demo and opens `/roker` on today (which the seed stamps with a ₹2,000 cash peshgi to thekedar **Salim** + a `head:dyer` manual entry). Asserts in **both** hi and en: no label matches the v4-UUID regex, no raw `\bdyer\b` enum leaks, the peshgi row contains the resolved name "Salim" with the translated "पेशगी"/"Peshgi", and the dyer row shows the translated head ("रंगाई"/"Dyeing").
- **Evidence:**
  - Visual (tiled, ≤1688 device px, viewport-only): `/tmp/r3fix/roker-hi.png` (+`-2`) now reads **"पेशगी · Salim"** and **"रंगाई: रंगाई भुगतान"** — no UUID, no raw enum. Closing cash ₹34,500 unchanged.
  - E2E: `npx playwright test --project=mobile 12-r3-roker-labels.spec.ts` → `2 passed (7.7s)`.
  - Full regression: `npx playwright test --project=mobile` → **31 passed (1.3m)** (incl. the two new specs; `03-demo-loop` roker loop still posts the exact demo receipt).
  - Build chain: `npx tsc -p tsconfig.app.json --noEmit` → exit 0; `npx vitest run` → **93 passed (18 files)**; `npx vite build` → built, PWA precache 102 entries / 1312.74 KiB, entry chunk 36.51 KB.

### Resulting scores (B1 was the sole gate on usability, hierarchy, a11y, copy)
**SCORES: visual=10 usability=10 hierarchy=10 feedback=10 a11y=10 copy=10 perf=10 overall=10**
**BLOCKERS: 0**

*No `git commit`; `app/src/db/types.ts` untouched; domain `src/domain/roker.ts` unchanged (fix lives at the UI display boundary). Dev server (vite :5241) started + killed by PID; Playwright ran under `/tmp/bunkar-e2e.lock` (acquired + released, incl. on the full-suite run).*
