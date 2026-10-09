# Bunkar OS — Completion batch UI/UX **RE-review (final pass)**

**Reviewer:** `rerev_ui_2` — fresh independent re-review (read-only on the repo
except this file).
**Date:** 2026-10-09.
**Scope:** Verify `batch-ui-ux-2.md`'s single Blocker 1 (Settings → फ़ोन device
**list-load** failure showed the wrong "sign-out failed" copy) is fixed in the
running app, then re-score ALL dimensions across the completion-batch screens
(owner home K2, /digest + month card, /rates, /jobs/new, bazaar wizard w/ piece
rate, bazaar receipt voice share, public slip audio player, Settings phones,
login device messages, roker, weaver passbook, exporter mock) plus a regression
pass over the main P0 screens.

## How it was measured (all evidence cited inline)
- Targeted E2E `e2e/19-devices-load-error.spec.ts` run under the e2e lock on the
  dedicated e2e stack (API :8787 + Vite :5173), lock released after.
- My own Vite **dev** server on port **5295** (torn down by PID) for
  viewport-tiled screenshots at **390×844** (demo seed via
  `window.__bunkarDemo.load()`, client-side IndexedDB — the 502s in the shot
  logs are only the `/api` sync probe with no API attached and are harmless).
- Computed WCAG contrast on **every rendered text node** + tap-target +
  horizontal-overflow DOM audit at **360px** across 9 routes
  (`/tmp/rr2/audit.mjs`).
- Production build + `scripts/perf.mjs` under 4× CPU + Slow 4G on my own preview
  port **4177** (torn down by PID).
- Hosted instance on **:4180/:8790 confirmed still listening and untouched**
  before and after; `server/data/{bunkar-local.db,.local-secret}` never touched.

---

## Prior blocker — VERIFIED FIXED

**Prior Blocker 1 — Settings "फ़ोन" showed "साइन आउट नहीं हो पाया" (sign-out
failed) when the device *list* merely failed to load.**

Fixed on both the copy and the UX, confirmed in source, in a live E2E 503
simulation, and in a live screenshot:

- **Distinct load-error string added.**
  `app/src/i18n/devices.hi.ts:11` →
  `'devices.loadFailed': 'फ़ोन की जानकारी नहीं आ पाई — नेटवर्क देखकर दोबारा कोशिश करें'`
  and `devices.retry` = `'दोबारा कोशिश करें'` (`:12`). EN parity at
  `app/src/i18n/devices.en.ts:12-13` (`'Could not load phones — check the
  network and try again'`, `'Try again'`).
- **Render branch rewired.** `app/src/features/settings/SettingsPage.tsx:383-391`
  — the `devicesErr` branch now renders a `role="alert"` block with
  `t('devices.loadFailed')` **plus** a `variant="secondary" size="md"` retry
  Button (`data-testid="devices-retry"`) whose `onClick` resets state and calls
  `loadDevices()`. The two **sign-out** failure paths (`:128`/`:131`) correctly
  keep `devices.signoutFailed` on their own toasts.
- **Tap-target ≥ 48px.** The retry Button is `size="md"` which is
  `min-h-12` = **48px** (`app/src/components/ui/Button.tsx:22`).
- **E2E regression test added.** `app/e2e/19-devices-load-error.spec.ts` makes
  `GET /api/devices` return **503** via `page.route`, asserts the
  `फ़ोन की जानकारी नहीं आ पाई` alert is visible, asserts
  `साइन आउट नहीं हो पाया` has **count 0**, asserts the retry button
  `boundingBox().height >= 48`, then flips the route to success, clicks retry,
  and asserts the list recovers (`यही फ़ोन` visible).

**Live evidence — E2E (lock held, released):**
```
Running 1 test using 1 worker
  ✓  1 [mobile] › e2e/19-devices-load-error.spec.ts:7:3 › 19 settings phones
     load failure › list-load failure shows the load error + retry, never
     "sign-out failed"; retry recovers (2.2s)
  1 passed (5.8s)
```

**Live evidence — screenshot (`/tmp/rr2/settings-2.png`, dev :5295, no API):**
the owner Settings "फ़ोन" card renders the correct madder message
**"फ़ोन की जानकारी नहीं आ पाई — नेटवर्क देखकर दोबारा कोशिश करें"** with a
**"दोबारा कोशिश करें"** button beneath it. **No "साइन आउट नहीं हो पाया"
anywhere.** Blocker 1 is resolved.

---

## Evidence summary

### Accessibility — contrast / tap targets / overflow (computed, 360px)
`/tmp/rr2/audit.mjs`, 9 routes, large-text threshold 3.0 / normal 4.5:

```
route        contrast-fails  real sub-44px targets  h-overflow
/            0               0 (only 1×1 skip-link) 0
/digest      0               0                      0
/rates       0               0                      0
/jobs/new    0               0                      0
/roker       0               0                      0
/settings    0               0                      0
/weavers     0               0                      0
/o/EX-118    0               0                      0
/bazaar/new  0               0                      0
```
The only sub-44px node on each app route is the **1×1 visually-hidden skip-link
"होम"** (correct a11y practice, not a tap target). **Zero** real targets < 44px,
**zero** horizontal overflow on every route.

### Performance (4× CPU + Slow 4G, Pixel-7 viewport, preview :4177)
```
{"cold":{"lcpMs":1408,"cls":0.001,"transferKB":220,"requests":15},
 "warm":{"lcpMs":108,"cls":0.002,"transferKB":935,"requests":17}}
```
cold LCP **1408 ms** ≤ 2500, warm LCP **108 ms** ≤ 1200, CLS **0.001/0.002**
≤ 0.1 — **all budgets met.** Build precache **107 entries / 1373.66 KiB**; main
`index` chunk **37.16 KB**, vendor split into long-term-cacheable
react/dexie/router chunks.

### Public slip audio player (SPEC-015/C9) — source + prior E2E
`app/src/features/slip/PublicSlipPage.tsx`: a big full-width **≥64px**
(`min-h-16`) indigo **🔊 सुनें** button with loading (`आवाज़ तैयार हो रही है…`,
spinner + `aria-busy`) and playing (`चल रहा है…`, Square) states; plays the
server WAV first and falls back to on-device `speechSynthesis`
(`फ़ोन की आवाज़ से सुना रहे हैं`) with a no-voice notice; large (`min-h-20` =
80px) green **✓ सही है** / madder **✗ गलत है** buttons; all error/empty states
(loading/offline/notfound/gone/answered) use 48px icons + large copy + retry.
(The audio endpoint was verified end-to-end 200 `audio/wav` valid RIFF in the
prior round; unchanged here.)

### Login device messages (SPEC-014) — source
`app/src/app/LoginPage.tsx:38` surfaces `login.deviceRevoked` from a
`device_revoked` reason and `:80-82` surfaces `login.deviceBound` on
`result.deviceBound`, both rendered as `role="alert"` madder banners
(`:123`, `:161`). Copy is natural and actionable (ask the owner to switch
phones / log in again).

### Bazaar receipt voice share (C9) — source
`app/src/features/bazaar/BazaarDetailPage.tsx` uses `PreviewShareSheet` with an
**आवाज़ भेजें** button (`:279`), an audio **preview** element
(`audio.previewLabel`, "सुनकर जाँचें"), recipient selection, and a
success **भेजें** confirm (`:315-317`); offline/sync gating strings
(`audio.needOnline`, `audio.needSync`, `audio.unavailable`,
`audio.shareFailed`, `audio.shared`) handle the patchy-data path gracefully.

---

## Screen-by-screen (re-pass, all live on :5295 unless noted)

- **Owner home K2 (SPEC-017)** — board 17 on_track (✓) / 3 slow (🕐 saffron) /
  3 stopped (⏸ madder) / **1 no_wool (#24 grey, 📦)** / 0 free, 5-column legend,
  ठेकेदार/ऑर्डर filter chips, "आज का हिसाब" (0 बाज़ार / ₹8,000 नकद खर्च /
  857.500 कुल बाहर ऊन), "खतरे में ऑर्डर (2)", sync-pending banner, and the
  free-soon card correctly showing **"अब खाली होने वाला"** for elapsed estimates
  + positive "N दिन में" (1/2/6/…/20) — the earlier negative-days bug stays
  fixed. No negative "दिन में" anywhere.
- **Digest + monthly (SPEC-018)** — काम/पैसा cards with per-row icon+label+bold
  right-aligned numbers, monthly card with every fact labelled
  (बाज़ार 1, बुनाई 70.00 फुट², मज़दूरी बिल ₹2,660, पेशगी दी ₹2,000,
  ऊन इस्तेमाल 21.900 किलो, ऊन कमी 0.243, ऊन नुकसान 1.1%), rejects as labelled
  em-dash "— (अभी दर्ज नहीं)", "ध्यान दें" attention card, bulleted
  share-preview (every fact on its own line), 8pm reminder toggle.
- **Rates (SPEC-016)** — three sectioned areas (बुनाई के रेट w/ "पुराने रेट ₹38"
  history, दूसरे काम के रेट, ऊन का मानक/नॉर्म), owner "+" per section,
  right-aligned ₹ + unit. Strong hierarchy.
- **Jobs/new (SPEC-016)** — बुनकर/ठेकेदार/कोई और segmented control, searchable
  person picker with coloured avatars + father/village sublabels, red
  "मज़दूरी सेव करें" money-out CTA.
- **Bazaar wizard (piece rate)** — "नया बाज़ार · कदम 1/6" with a 6-segment
  progress bar, searchable piece picker with "बाज़ार के लिए तैयार" chips +
  % woven + "करघे पर", disabled "आगे" with inline hint "पहले कालीन चुनें".
- **Roker (O1)** — "रोकड़ बही", date stepper, शुरुआती नकद ₹42,500, entries with
  "अपने आप" auto-post badge, नकद आया/गया + UPI tiles, बचत नकद ₹34,500.
- **Settings phones (SPEC-014)** — sections grid, unit info w/ reveal, unit
  settings, "फ़ोन" section (fixed load-error + retry, see above), sync, demo,
  logout. Rejected empty state present.
- **Exporter mock (A2)** — "डेमो नमूना" banner, order header, 12/0/12 tiles,
  औसत बुनाई 91% bar, 5-item board legend matching the live board, अनुमानित
  भेजान date, 12 pieces w/ %+status, demo photo placeholders, J2 consent note.
- **Weaver list / passbook (B1)** — searchable, coloured avatars,
  father/village, "पेशगी बाक़ी ₹5,000" in madder, "नया बुनकर" CTA; drill-in
  passbook + "पेशगी दें" CTA.
- **Login device messages (SPEC-014)** — `role="alert"` banners confirmed in
  source (see evidence).

---

## Scores (0–10)

| Dimension | Score | Notes |
|---|---|---|
| Visual design | 10 | Consistent cards, disciplined palette (madder/indigo/saffron-ink/jute/ok-green), clear status colours, big tabular numerals, progress bars, coloured avatars. No concrete visual blocker found. |
| Usability (low-literacy) | 10 | Icon+label everywhere, segmented/radio pickers, locked-rate chips, step gating with inline hints, big 🔊/✓/✗ buttons, auto-post badges. |
| Hierarchy | 10 | Clear section titles, 6-step wizard, per-row labelled numbers in digest/monthly, three-section rate card, legend + summary tiles. |
| Feedback / empty / error states | 10 | Prior Blocker 1 fixed: the device-list load error now shows a correct, recoverable message + retry (≥48px). Disabled-with-hint, no-rate card, offline notices, rejected empty state, slip loading/offline/notfound/gone/answered states, voice-share gating all present. No remaining blocker. |
| Accessibility | 10 | 0 computed-contrast fails on 9 routes, 0 real sub-44px targets, 0 360px overflow, focus-visible rings, `role="alert"`, `aria-busy`, skip link. |
| Hindi copy | 10 | Natural, respectful, task-oriented; EN parity maintained; the mislabelled device-load error is corrected. No remaining copy blocker. |
| Performance | 10 | cold 1408 ms / warm 108 ms / CLS ≤ 0.002 — all budgets met; 1373.66 KiB precache; 37 KB main chunk. |
| **Overall** | **10** | The single prior blocker is fixed and holding (source + live E2E 503 sim + live screenshot). No new blockers across the completion batch or the P0 regression pass. |

---

## Remaining blockers to 10
**None.** The prior Blocker 1 is resolved; no dimension has a concrete,
actionable blocker remaining.

---

SCORES: visual=10 usability=10 hierarchy=10 feedback=10 a11y=10 copy=10 perf=10 overall=10
BLOCKERS: 0
