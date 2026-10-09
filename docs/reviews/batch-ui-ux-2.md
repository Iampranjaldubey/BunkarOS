# Bunkar OS — Completion batch (SPEC-014..018) UI/UX **RE-review**

**Reviewer:** `rerev_ui` — fresh independent re-review (read-only except this file).
**Date:** 2026-10-09.
**Scope:** Verify the prior review's single blocker is fixed in the running app,
then re-score ALL dimensions across the completion-batch screens (SPEC-014
devices/login, SPEC-015 slip audio, SPEC-016 rates + jobs, SPEC-017 full owner
home, SPEC-018 monthly summary) plus a regression pass over the main P0 screens
(bazaar wizard, roker, exporter mock, settings, slip, weaver passbook).

**How it was measured (all evidence cited inline):**
- Dev build on my own port **5291** (torn down by PID). Viewport-tiled
  screenshots at **360×740** and 390×844; ≤ 4 tiles per read call, each < 1700
  device px.
- Computed WCAG contrast on **every rendered text node** + tap-target +
  horizontal-overflow DOM audit at **360px** across `/`, `/digest`, `/rates`,
  `/jobs/new`, `/roker`, `/settings` (`/tmp/rr/audit.mjs`).
- Token-pair contrast via `scripts/contrast.mjs`.
- Production build + `scripts/perf.mjs` under 4× CPU + Slow 4G on **:4176**.
- Public slip audio verified end-to-end against a loopback API on **:8787**
  (held the e2e lock, used a temp sqlite db `/tmp/rr/slip-test.db`, torn down by
  PID, lock released; `server/data/{bunkar-local.db,.local-secret}` never
  touched; hosted :4180/:8790 confirmed still listening after teardown).

---

## Prior blocker — VERIFIED FIXED

**Prior Blocker 1 — owner home "free in next 30 days" showed negative days
("-9 दिन में").**

Fixed on **both** sides, confirmed in source and in the running app:

- **Domain clamp (`app/src/domain/owner.ts:68-72`):**
  ```ts
  const estimatedDay = addDays(anchorDay, daysToFinish);
  const freeDay = estimatedDay < today ? today : estimatedDay;   // never before today
  const daysLeft = daysBetween(today, freeDay);                  // always >= 0
  ```
  `freeDay` can no longer land before today, so `loomsFreeSoon` never emits a
  negative `daysLeft`.
- **Render-boundary clamp (`app/src/features/home/HomePage.tsx:261-270`):**
  `const daysLeft = Math.max(0, r.daysLeft)` and
  `daysLeft === 0 ? t('home.freeSoon.now') : t('home.freeSoon.in', { n: daysLeft })`.
- **Copy added** `app/src/i18n/outputs.hi.ts:33` `'home.freeSoon.now'` =
  **'अब खाली होने वाला'** (en.ts:31 `'freeing up now'`).

**Live evidence (demo seed, port 5291, owner home):** the "अगले 30 दिन में खाली
होने वाले करघे" card renders elapsed estimates as **"अब खाली होने वाला"**
(EX-118/01, EX-118/06, EX-125/04, EX-125/05, EX-125/07, EX-125/08) and future
ones as positive counts (`1 दिन में`, `2 दिन में`, `6 दिन में` … up to
`20 दिन में`). **No negative "दिन में" value appears anywhere** on the card.
Blocker 1 is resolved.

---

## Evidence summary

### Accessibility — contrast (computed, every text node)
`/tmp/rr/audit.mjs` at 360px, large-text threshold 3.0 / normal 4.5:

```
/         0 fails
/digest   0 fails
/rates    0 fails
/jobs/new 0 fails
/roker    0 fails
/settings 0 fails
```

Token pairs (`scripts/contrast.mjs`): all required pairs pass AA — slow tile
white-on-saffron-ink **5.92:1**, on_track white-on-ok **5.06:1**, idle
white-on-madder **6.66:1**, free muted-on-line **6.01:1**, indigo-on-white
**10.35:1**. (The "OLD saffron" pair is the intentional pre-fix baseline fail,
non-gating.)

### Accessibility — tap targets & overflow
At 360px the only sub-44px node on all six routes is the **1×1 visually-hidden
skip-link "होम"** (correct a11y practice, not a tap target). **Zero** real
targets < 44px. **Zero** horizontal overflow (scrollWidth == clientWidth on all
six).

### Performance (4× CPU + Slow 4G, Pixel-7 viewport, :4176)
```
{"cold":{"lcpMs":1396,"cls":0.001,"transferKB":220,"requests":15},
 "warm":{"lcpMs":104,"cls":0.004,"transferKB":935,"requests":17}}
```
cold LCP **1396 ms** ≤ 2500, warm LCP **104 ms** ≤ 1200, CLS **0.001/0.004** ≤
0.1 — **all budgets met.** Build precache **107 entries / 1373.09 KiB**.

### Slip audio (SPEC-015) — end-to-end
`GET /api/slips/<token>/audio` → **200 `audio/wav`, 109198 bytes, valid `RIFF`
header, `X-Content-Type-Options: nosniff`, `Cache-Control: private`** (espeak-ng
engine installed in `server/tts/node_modules`). Public `/s/:token` renders a big
indigo full-width **🔊 सुनें** button, a "Paid ₹1,955.00" line, and large green
**✓ सही है** / red **✗ गलत है** buttons. No console errors.

---

## Screen-by-screen (re-pass)

- **Owner home (SPEC-017)** — Board grid: 17 on_track / 3 slow / 3 idle /
  **1 no_wool (#24, grey, package icon)** / 0 free, 5-item legend, "ठेकेदार से /
  ऑर्डर से" filter chips, "आज का हिसाब" (बाज़ार/नकद खर्च/कुल बाहर ऊन), दुएस via
  "खतरे में ऑर्डर (2)" (EX-121 समय नज़दीक / EX-125 करघा रुका), sync-pending
  banner, and the fixed free-soon card. Correct.
- **Digest + monthly (SPEC-018)** — "दैनिक सार" काम/पैसा cards + "इस महीने" card
  with every number on its own labelled `DigestRow` (बाज़ार 1, बुनाई 70.00 फुट²,
  मज़दूरी बिल ₹2,660.00, पेशगी दी ₹2,000, ऊन इस्तेमाल 21.900 किलो, ऊन कमी 0.243,
  ऊन नुकसान 1.1%), rejects as labelled em-dash "— (अभी दर्ज नहीं)", a "ध्यान दें"
  attention card, and two share-preview blocks (daily + monthly → मालिक को भेजें)
  listing every fact on its own line. Excellent.
- **Rates (SPEC-016)** — Two clearly separated sections "बुनाई के रेट" (Kashan 60
  KPSI ₹40/वर्ग फुट with "पुराने रेट ₹38" history line) and "दूसरे काम के रेट"
  (खोलाई ₹10/किलो, हेल्पर ₹350/दिन, सीधा करना ₹7/किलो), owner "+" per section.
  Strong hierarchy.
- **Jobs/new (SPEC-016)** — Worker-kind segmented control (बुनकर/ठेकेदार/कोई और),
  searchable person picker with avatars + father/village sublabels, red
  "मज़दूरी सेव करें" CTA (money-out brand). Clean.
- **Bazaar wizard (regression)** — "नया बाज़ार · कदम 1/6" with a 6-segment
  progress bar, searchable piece picker with status chips ("बाज़ार के लिए तैयार")
  + % woven + "करघे पर", disabled "आगे" with inline hint "पहले कालीन चुनें".
  Good progressive disclosure + gating.
- **Roker (regression)** — "रोकड़ बही", date stepper, "शुरुआती नकद ₹42,500",
  entries with auto-post badge "अपने आप" (पेशगी · Salim, रंगाई भुगतान), in/out
  tiles (नकद आया ₹0 / नकद गया ₹8,000 / UPI ₹0), closing "बचत नकद ₹34,500".
- **Settings (SPEC-014)** — "सभी हिस्से" menu grid, "यूनिट की जानकारी" with "कोड
  और चाबी दिखाएँ", owner-only "यूनिट सेटिंग" (फोटो ज़रूरी रकम ₹2,000, मानक छूट 3%,
  शुरुआती नकद ₹42,500, मालिक का फ़ोन), "फ़ोन" (SPEC-014) section, "सिंक", and an
  "अस्वीकार रिकॉर्ड → कोई अस्वीकार रिकॉर्ड नहीं" empty state. One copy/error-state
  bug (Blocker 1 below).
- **Exporter mock (SPEC-017/A2)** — "डेमो नमूना" banner, order header, summary
  tiles, "औसत बुनाई 91%" progress bar, 5-item board legend with distinct icons
  matching the live board (✓ ठीक चल रहा 17 / 🕐 धीमा 3 / ⏸ रुका 3 / 📦 ऊन नहीं 1 /
  ○ खाली 0), "अनुमानित भेजान 25 अक्टूबर 2026", 12 pieces with %+status, demo photo
  placeholders, and the "बुनकर के नाम सिर्फ़ सहमति (J2) के साथ दिखेंगे" consent
  note.
- **Weaver passbook (regression)** — avatar, father name, village + loom status,
  phone + UPI badges, "पेशगी बाक़ी ₹2,000" (madder), "पासबुक" with a dated line
  "पेशगी दी · 14 सितंबर 2026 · ₹2,000.00", and a big indigo "पेशगी दें" CTA.
- **Login notices (SPEC-014)** — Copy strings confirmed in source
  (`LoginPage.tsx:38` + `login.deviceRevoked` / `login.deviceBound` as a
  `role="alert"` madder banner); the device_bound/device_revoked flows require a
  live 409/401 and were verified in the prior round (not re-triggered here).

---

## Scores (0–10)

| Dimension | Score | Notes |
|---|---|---|
| Visual design | 9 | Consistent cards, palette discipline (madder/indigo/saffron-ink/jute/ok-green), clear status colours, big tabular numerals, progress bars. |
| Usability (low-literacy) | 10 | Icon+label everywhere, segmented/radio pickers, locked-rate chips, step gating, big agree/dispute + play. The prior "negative free-in-N-days" confusion is fixed ("अब खाली होने वाला"). |
| Hierarchy | 10 | Clear section titles, 6-step wizard, per-row labelled numbers in digest/monthly, two-section rate card. |
| Feedback / empty / error states | 8 | Mostly excellent (disabled-with-hint, no-rate card, offline notice, rejected empty state, auto-post badges, role=alert login notices) — but the owner Settings "फ़ोन" section shows the wrong "sign-out failed" copy when the device **list** merely fails to load (Blocker 1). |
| Accessibility | 10 | 0 computed-contrast fails on 6 routes, 0 sub-44px real targets, no 360px overflow, focus-visible rings, nosniff on audio. |
| Hindi copy | 9 | Natural, respectful, task-oriented throughout; EN parity maintained; numbers-in-words for TTS. Docked one point for the mislabelled device-load error (Blocker 1). |
| Performance | 10 | cold 1396 ms / warm 104 ms / CLS ≤ 0.004 — all budgets met; 1373.09 KiB precache. |
| **Overall** | **9** | Prior blocker fixed and holding on both domain + render boundary. One minor error-state copy bug remains. |

---

## Remaining blockers to 10 (only genuine blockers; file:line + exact fix)

### Blocker 1 — Settings "फ़ोन" section shows "sign-out failed" when the device **list fails to load**
**Where:** `app/src/features/settings/SettingsPage.tsx:384-385`
```tsx
) : devicesErr ? (
  <p className="text-sm text-madder">{t('devices.signoutFailed')}</p>
```
`devicesErr` is set by the **GET /api/devices load** failing
(`SettingsPage.tsx:97` `if (!res.ok) { setDevicesErr(true); return; }` and
`:101` `catch { setDevicesErr(true); }`), *not* by a sign-out action. So when an
owner on patchy data opens Settings and the device list can't load, the section
renders the alarming, factually-wrong message **"साइन आउट नहीं हो पाया — दोबारा
कोशिश करें"** ("could not sign out") even though no sign-out was attempted. On a
cheap Android with flaky mobile data this will fire routinely and mislead the
owner. (The sign-out *action* already surfaces its own toast at `:128` / `:131`,
so this inline banner is purely the list-load failure.)

**Exact fix:** add a distinct load-error string and use it for the list-load
branch, keeping `devices.signoutFailed` only for the sign-out toast.

1. `app/src/i18n/devices.hi.ts` — after line 12 (`devices.loading`) add:
   ```ts
   'devices.loadFailed': 'फ़ोन की जानकारी नहीं आई — दोबारा कोशिश करें',
   ```
   `app/src/i18n/devices.en.ts` — after line 9 add:
   ```ts
   'devices.loadFailed': 'Could not load phones — try again',
   ```
2. `app/src/features/settings/SettingsPage.tsx:385` — change
   `{t('devices.signoutFailed')}` to `{t('devices.loadFailed')}` in the
   `devicesErr` render branch (leave the two sign-out **toast** calls at
   `:128`/`:131` on `devices.signoutFailed`).

Optional nicety: render a "दोबारा कोशिश करें" retry button beside the message
that calls `loadDevices()` so the owner can recover without a full reload.

> Note: this file is owned by `k` (features/*). The one-line swap + the two new
> i18n keys are the complete fix.

---

SCORES: visual=9 usability=10 hierarchy=10 feedback=8 a11y=10 copy=9 perf=10 overall=9
BLOCKERS: 1
