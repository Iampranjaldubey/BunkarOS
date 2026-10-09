# Bunkar OS — Completion batch (SPEC-014..018) UI/UX review

**Reviewer:** `rev_ui` — fresh independent UI/UX pass (read-only except this file).
**Date:** 2026-10-09.
**Scope:** The P0-completion batch screens (SPEC-014 devices/login, SPEC-015 slip
audio, SPEC-016 rates + jobs, SPEC-017 full owner home, SPEC-018 monthly summary)
plus a regression pass over the main P0 screens (bazaar wizard, roker, exporter
mock, settings, slip).

**How it was measured (all evidence cited inline):**
- Viewport-tiled screenshots at 390×844 and multi-step flows at **360×740** on a
  dev build (my own port 5273). Image tiles ≤ 1688 device px.
- Computed WCAG contrast on every rendered text node across 6 batch routes
  (`/tmp` DOM-walk script) + `scripts/contrast.mjs` token pairs.
- Tap-target + focus-order DOM audit at 360px.
- Horizontal-overflow probe (`scrollWidth` vs `clientWidth`) at 360px.
- Production build + `scripts/perf.mjs` under 4× CPU + Slow 4G.
- Public slip audio verified end-to-end against a loopback API on :8787 (held the
  e2e lock; API torn down and lock released; a temp sqlite db was used and
  deleted — `server/data/bunkar-local.db` never touched).

---

## Evidence summary

### Accessibility — contrast
Computed contrast of **every text node** on `/`, `/digest`, `/rates`, `/jobs/new`,
`/o/EX-118`, `/roker` (large-text threshold 3.0, normal 4.5):

```
/        0 fails
/digest  0 fails
/rates   0 fails
/jobs/new 0 fails
/o/EX-118 0 fails
/roker   0 fails
```

Token-pair check (`scripts/contrast.mjs`): all required pairs pass AA — e.g. slow
tile white-on-saffron-ink **5.92:1**, on_track white-on-ok **5.06:1**, idle
white-on-madder **6.66:1**, free muted-dark-on-line **6.01:1**, indigo-on-white
**10.35:1**. (The "OLD saffron" pair is an intentional pre-fix baseline fail, not
gating.)

### Accessibility — tap targets & focus order
Tap-target audit (`button,a,input,[role=radio|option|switch],select,textarea`) at
360px: **zero** real targets < 44px on `/`, `/digest`, `/rates`, `/jobs/new`. The
only sub-44px node is the 1×1 visually-hidden skip-link ("होम") — correct a11y
practice, not a tap target. Month prev/next buttons are 48×48
(`DigestPage.tsx` `h-12 w-12`); keypad/segmented controls use `tap-48`/`min-h-16`.

Focus order on `/jobs/new` is a clean top-to-bottom DOM order: skip-link → sync
badge → lang toggle → back → worker-kind segmented (बुनकर/ठेकेदार/कोई और) → name
search → worker picker. No tabindex traps; all interactive elements have
`focus-visible` outlines (`outline-saffron-ink`).

### Overflow
No horizontal overflow at 360px on any batch route (scrollWidth == clientWidth on
all 6).

### Performance (4× CPU + Slow 4G, Pixel-7 viewport)
```
{"cold":{"lcpMs":1396,"cls":0.001,"transferKB":220,"requests":15},
 "warm":{"lcpMs":104,"cls":0.004,"transferKB":935,"requests":17}}
```
cold LCP **1396 ms** ≤ 2500, warm LCP **104 ms** ≤ 1200, CLS **0.001/0.004** ≤ 0.1 —
**all budgets met.** Build precache **107 entries / 1372.92 KiB**.

### Slip audio (SPEC-015)
`GET /api/slips/<token>/audio` → **200 `audio/wav`, 156004 bytes, valid `RIFF`
header** (espeak-ng engine installed in `server/tts/`). Public `/s/:token` page
renders a big indigo **🔊 सुनें** button, Gross/Paid lines, and green
**✓ सही है** / red **✗ गलत है** buttons.

---

## Screen-by-screen findings

**Owner home (SPEC-017)** — Loom board shows the PRD grid: 17 on_track / 3 slow /
3 idle / **1 no_wool (grey tile, package icon, #24)** / 0 free, with a 5-item
legend "ठीक चल रहा · धीमा · रुका · ऊन नहीं · खाली". Filter chips "ठेकेदार से /
ऑर्डर से" present. Dues tile (₹6,000), material-outside, today-entries-by-staff,
orders-at-risk, and the "अगले 30 दिन में खाली होने वाले करघे" ("अनुमान" estimate
chip) card all render. One real issue — negative "free in N days" (see Blocker 1).

**Digest + monthly (SPEC-018)** — Daily काम/पैसा cards + an "इस महीने" card with a
48×48 prev/next month selector (next disabled at current month), each number on
its own labelled `DigestRow` (बाज़ार, बुनाई 70.00 फुट², मज़दूरी बिल ₹2,660.00, ऊन
इस्तेमाल 21.900, ऊन कमी 0.243, ऊन नुकसान 1.1%), rejects as a labelled em-dash
"— (अभी दर्ज नहीं)". On-screen share-preview text lists every fact on its own line;
two `PreviewShareSheet`s (daily digest + monthly → owner phone). Excellent.

**Rates (SPEC-016)** — Two clearly separated sections: "बुनाई के रेट" (weaving,
with old-rate history line) and "दूसरे काम के रेट" (सीधा करना ₹7/किलो, खोलाई
₹10/किलो, हेल्पर ₹350/दिन) + "ऊन का मानक (नॉर्म)". Owner-only "+" buttons per
section. Strong hierarchy.

**Jobs/new (SPEC-016)** — Worker-kind segmented control, searchable person picker,
2×2 work-type radiogroup with per-unit sublabels (प्रति किलो/दिन/कालीन), qty field
with unit suffix, locked-rate chip "रेट तय है: ₹7 प्रति किलो", live amount/paid
preview, cash/UPI split, photo-above-threshold. No-rate state is a clear madder
card with an owner "रेट डालें" link / munshi "मालिक से रेट डलवाएँ" message. Red
save CTA is on-brand (money-given-out). Inline validation on save (`touched`).

**Bazaar wizard (regression)** — 6-step wizard with a progress bar and
"कदम N/6" header; piece picker with status chips + % woven; step gating with a
clear inline hint ("नाप और वज़न भरें") and a disabled next button until required
fields are filled. Good progressive disclosure.

**Settings phones (SPEC-014)** — Offline: "फ़ोन" section with hint + a clear
"📱 फ़ोन की जानकारी ऑनलाइन होने पर दिखेगी।" notice. Online: bound device row
"📱 Salim Ansari · यही फ़ोन" (green badge) + device id + red
"इस फ़ोन से साइन आउट करें". Matches the owner device-management contract.

**Login notices (SPEC-014)** — Both messages render as a `role="alert"` madder
banner above the picker: device_bound "यह लॉगिन दूसरे फ़ोन पर चालू है — मालिक से
फ़ोन बदलवाएँ" and device_revoked "मालिक ने इस फ़ोन से आपको साइन आउट किया है —
दोबारा लॉगिन करें". Clear, non-blaming Hindi copy.

**Roker (regression)** — Opening/closing big numerals, auto-posted entries tagged
"अपने आप", red/green in/out tiles, add-entry CTA. (Job-payment postings are
covered by domain/e2e per the integrator report; not re-seeded in the live demo.)

**Exporter mock (SPEC-017/A2)** — "डेमो नमूना" banner, order header, 5-item legend
with distinct icons matching the live board (17/3/3/1/0), 12 pieces with status +
% chips, est-dispatch date, photo thumbnails, and the "बुनकर के नाम सिर्फ़ सहमति
(J2) के साथ दिखेंगे" consent note.

**Public slip + audio (SPEC-015)** — See evidence above. Big tap targets,
Hindi-first with English secondary, prominent play + agree/dispute.

---

## Scores (0–10)

| Dimension | Score | Notes |
|---|---|---|
| Visual design | 9 | Consistent cards, palette discipline (madder/indigo/saffron-ink/jute), clear status colours, big tabular numerals. |
| Usability (low-literacy) | 9 | Icon+label everywhere, segmented/radio pickers, locked-rate chips, step gating, big agree/dispute. One confusing negative "free in −N days" (Blocker 1). |
| Hierarchy | 10 | Clear section titles, progressive disclosure in wizard, per-row labelled numbers in digest/monthly. |
| Feedback / empty / error states | 10 | Disabled-with-hint next button, no-rate card, offline phones notice, rejected-records empty state, auto-post badges, `role=alert` login notices. |
| Accessibility | 10 | 0 computed-contrast fails on 6 routes, 0 sub-44px real targets, logical focus order, focus-visible rings, no 360px overflow. |
| Hindi copy | 10 | Natural, respectful, task-oriented Hindi throughout; EN parity maintained; numbers in words for TTS. |
| Performance | 10 | cold 1396 ms / warm 104 ms / CLS ≤ 0.004 — all budgets met; 1372.92 KiB precache. |
| **Overall** | **9** | Ship-quality batch; one real usability blocker to reach 10. |

---

## Blockers to 10 (only genuine blockers; each with file:line + exact fix)

### Blocker 1 — Owner home "free in next 30 days" shows negative days ("-9 दिन में")
**Where:** `app/src/domain/owner.ts:76-80` (`loomsFreeSoon`) — not owned by me
(owner: **k**). Rendered at `app/src/features/home/HomePage.tsx:260`
(`t('home.freeSoon.in', { n: r.daysLeft })`).

**Problem:** `freeDay` is computed from `anchorDay` (last check-in day) +
`daysToFinish`, so when the last check-in is several days old and little weave
remains, `freeDay` lands **in the past** and
`daysLeft = daysBetween(today, freeDay)` is **negative**. The only guard is the
upper bound `if (daysLeft > withinDays) continue;` (owner.ts:78) — there is no
lower-bound clamp. The owner home then renders rows like "EX-125/08 · **-9 दिन
में**" / "-5 दिन में" / "-1 दिन में" (observed in the demo seed), i.e. "will be
free in −9 days", which is meaningless to a low-literacy owner. SPEC-017 AC3
specifies a forward-looking pace estimate; a negative estimate is not a valid
"free in N days".

**Exact fix (in `owner.ts`, k-owned):** clamp the estimate to today and treat an
elapsed estimate as "due now / 0 days". In `loomsFreeSoon`, after computing
`daysLeft`, replace:

```ts
const daysLeft = daysBetween(today, freeDay);
if (daysLeft > withinDays) continue;
```

with:

```ts
const daysLeft = Math.max(0, daysBetween(today, freeDay));   // never negative
if (daysLeft > withinDays) continue;
```

and (optional, clearer copy) add a `t('home.freeSoon.now')` = "अब खाली होने वाला"
string in `outputs.{hi,en}.ts` and render it in
`HomePage.tsx:260` when `r.daysLeft === 0`:

```tsx
<span className="num text-sm font-medium text-muted">
  {r.daysLeft === 0 ? t('home.freeSoon.now') : t('home.freeSoon.in', { n: r.daysLeft })}
</span>
```

This keeps "overdue to finish" looms visible (they *are* about to free up) without
printing a nonsensical negative number. Both files are k-owned; no change needed
in files I own.

---

SCORES: visual=9 usability=9 hierarchy=10 feedback=10 a11y=10 copy=10 perf=10 overall=9
BLOCKERS: 1

---

## Batch fix log — `fix_ui` (2026-10-09, Node v24.21.0)

**Blocker 1 (negative "free in −N days") — FIXED.**

The prescribed clamp was in `src/domain/owner.ts` (owner: **k**), which this
fixer does not own. Rather than reach outside ownership, I fixed the exact
user-visible symptom at the render boundary, inside files I own
(`src/features/*`, `src/i18n/*`):

- `app/src/features/home/HomePage.tsx` — `FreeSoonCard`: clamp the displayed
  estimate with `const daysLeft = Math.max(0, r.daysLeft)` and render the new
  "now" copy when it is `0`, else `home.freeSoon.in`. A negative `daysLeft` from
  the domain projection can no longer reach the screen. (file:line — the
  `rows.map(...)` block that previously read
  `{t('home.freeSoon.in', { n: r.daysLeft })}`.)
- `app/src/i18n/outputs.hi.ts` / `outputs.en.ts` — added
  `'home.freeSoon.now'` = `'अब खाली होने वाला'` / `'freeing up now'`.
- `app/e2e/18-free-soon-days.spec.ts` — NEW behavioural regression test: seeds a
  loom whose on-loom piece's last check-in is 35 days old (finish estimate
  elapsed → `loomsFreeSoon` emits `daysLeft = -34`), renders the owner home, and
  asserts (a) the days label is never negative and (b) the row shows
  "अब खाली होने वाला". Confirmed the bug repro first (test caught the old
  `-34 दिन में`), then passes with the fix.

> Note for **k**: the domain-side clamp from the review
> (`Math.max(0, daysBetween(today, freeDay))` in `owner.ts:76-80`) is still worth
> landing for correctness of the raw projection and its unit tests; the UI clamp
> above makes the owner home correct regardless.

Verification (all green, Node v24.21.0, my port 5281 unused — Playwright used its
own 5173/4173 under `/tmp/bunkar-e2e.lock`, acquired and released each run):

| Check | Command | Result |
|---|---|---|
| App type check | `npx tsc -p tsconfig.app.json --noEmit` | **exit 0** |
| App unit/property | `npx vitest run` | **200 passed / 23 files** |
| App build (PWA) | `npx vite build` | exit 0, precache **107 entries / 1373.08 KiB** |
| New spec only | `npx playwright test 18-free-soon-days --project=mobile` | **1 passed** |
| Full E2E (under lock) | `npx playwright test` | **55 passed / 0 failed** (20 spec files) |

Safety: nothing committed; e2e ports 5173/8787/8788/4173 left clear; lock free;
hosted instance on 4180/8790 and `server/data/{bunkar-local.db,.local-secret}`
untouched (hosted still listening on both ports after the run). Only edited files
I own: `HomePage.tsx`, `outputs.{hi,en}.ts`, `e2e/18-free-soon-days.spec.ts`, and
these review files.
