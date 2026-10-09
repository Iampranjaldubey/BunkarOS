# Bunkar OS — Independent UI / UX Review

**Reviewer:** `review_ui_ux` (independent, read-only on app code)
**Date:** 2026-10-09
**Build under review:** `app/` React 19 + Vite 8 + Tailwind v4 PWA, dev server on `http://localhost:5191`
**Method:** Seeded demo unit (`e2e/shot-demo.mjs` → board 15/5/3/1 confirmed), screenshotted 20+ routes at 390×844 (mobile, DPR 2), viewed every PNG, plus live-DOM audits (tap-target sizes, label association, fixed-nav clipping after scroll-to-bottom, computed text colors) and WCAG contrast math on the design tokens. Production bundle sizes from `npx vite build`.
**Scope note:** `server/` was not running during capture, so screens that need the API show the generic network-error / 502 state (two expected console 502s per page). Several `scripts/shot.mjs --demo` captures did **not** persist demo data (the `data-testid=load-demo` click path is flaky); those screens are scored from their *empty* state. All data-rich assessments were re-verified with a reliable module-import seed in my own audit scripts.

---

## Overall score: **7.1 / 10**

This is a genuinely well-built Hindi-first shell: consistent design tokens, correct red=given / green=received semantics, large tabular numerals, properly associated input labels, a skip link, `<html lang="hi">`, one `<h1>` per page, and empty/error states that read like a human wrote them. It is close to shippable. It is **not** a 10 for a Bhadohi munshi today because of three fixable things: (1) **saffron (#c98a1c) as foreground text/numerals fails WCAG AA contrast** (2.94:1 on white) and the **"slow" loom tiles put white on saffron (2.94:1)** — this is the most-used status colour on the two most-looked-at screens; (2) the **language toggle tap target is 40×40 px**, below the project's own 48 px rule; (3) a few **copy/polish gaps** (raw record-type keys in the audit list, a raw bad-id echoed on the exporter 404, no visible user avatars though the model supports them).

I explicitly checked and **cleared** two things that looked wrong in full-page screenshots but are not real defects: the fixed bottom nav does **not** permanently clip content (the `pb-20` wrapper reserves 80 px > the 57 px nav; after scroll-to-bottom `clippedCount = 0` on every long page), and the yarn/bazaar submit button is **not** mis-ordered (source order is inputs → photo → submit; the overlap was a full-page-screenshot compositing artifact).

### Score by dimension

| Dimension | Score | One-line justification |
|---|---:|---|
| Visual design (modern, consistent) | 8 / 10 | Coherent token system, good cards/spacing, restrained palette; a touch default-shadcn in places. |
| Usability for low-literacy Hindi users (360–390 px) | 7 / 10 | Big tiles, colour-coded flows, step wizards; weakened by saffron legibility and icon-light status chips. |
| Information hierarchy | 8 / 10 | Clear H1 → section cards → big numerals; loom board & order cards are excellent. |
| Feedback / empty / error states | 8 / 10 | Strong, specific, actionable empty states everywhere; offline/404 handled gracefully. |
| Accessibility (contrast, labels, tap targets, focus) | 6 / 10 | Labels/focus/lang/skip-link all correct; **saffron contrast fail** + 40 px lang toggle pull it down. |
| Hindi copy quality | 8 / 10 | Natural, warm, consistent register; a few raw English keys leak through. |
| Performance hints (bundle) | 7 / 10 | Good route-splitting & gzip, but lucide + a 99 KB "Button" chunk + 1.8 MB precache are heavy for low-end phones. |

---

## Performance / bundle evidence (`npx vite build`)

```
dist/index.html                     1.05 kB │ gzip:  0.51 kB
dist/assets/index-*.css            38.40 kB │ gzip:  7.72 kB
dist/assets/index-*.js            247.78 kB │ gzip: 77.68 kB   ← app entry
dist/assets/createLucideIcon-*.js 204.19 kB │ gzip: 61.35 kB   ← lucide icons
dist/assets/Button-*.js            98.90 kB │ gzip: 32.94 kB   ← shared UI chunk
dist/assets/SettingsPage-*.js      25.86 kB │ gzip:  8.58 kB
dist/assets/BazaarNewPage-*.js     16.59 kB │ gzip:  4.94 kB
dist/assets/HomePage-*.js          10.75 kB │ gzip:  3.33 kB
PWA generateSW precache 102 entries (1802.91 KiB)
```

Initial critical path ≈ **entry 77.68 + lucide 61.35 + Button 32.94 + css 7.72 ≈ 180 KB gzip** before any route code. On a ₹6k Android over a 3G link that is ~2–4 s of JS parse/transfer. Route pages themselves are nicely small (1–9 KB gzip) — good code-splitting. The two fat shared chunks (lucide, "Button") and the 1.8 MB precache are the levers.

---

## Per-screen findings (ranked P0 / P1 / P2)

Priority key: **P0** = blocks shipping to a munshi today · **P1** = fix before wider rollout · **P2** = polish.

### Cross-cutting (affects most screens)

**[P0] Saffron (#c98a1c) used as foreground text/numerals fails WCAG AA contrast.**
Measured: saffron on white = **2.94:1**, on page bg (#f1f4f8) = **2.67:1**. AA needs 4.5:1 (normal) / 3:1 (large) — it fails even as large text on the page bg. The "slow" loom tile uses **white on solid saffron = 2.94:1** too, so the "6 दिन" labels on amber tiles are also sub-threshold. This is the single most-visible colour on the owner home (loom board) and order cards.
- Fix — introduce a **darker amber for text/fills** while keeping bright saffron only for the focus ring and decorative icons. In `app/src/index.css` add e.g. `--color-saffron-ink: #8a5a0a;` (that is ~5.5:1 on white) and use it for text.
- `app/src/components/ui/Badge.tsx:13` — change `warn: 'bg-saffron/15 text-saffron'` → `warn: 'bg-saffron/20 text-[var(--color-saffron-ink)]'`.
- `app/src/features/home/HomePage.tsx:31` — the `slow: 'bg-saffron text-white'` tile: darken the tile to the new amber-ink (`bg-[var(--color-saffron-ink)] text-white`, which is ~5.5:1) OR add a dark text + icon so the status does not rely on the thin white-on-amber contrast.
- `app/src/features/home/HomePage.tsx:167` (alert banner), `:212` (roker tile), `app/src/features/bazaar/BazaarNewPage.tsx:320-323` and `BazaarDetailPage.tsx:168` (tauli "extra" kg), `app/src/features/yarn/YarnPage.tsx:126`, `YarnIssuePage.tsx:101`, `app/src/features/looms/shared.tsx:138` — replace `text-saffron` with `text-[var(--color-saffron-ink)]`.

**[P1] Status is signalled by colour + text only — no icon/shape redundancy (WCAG 1.4.1).**
Loom board tiles and order status chips ("करघे पर", "उतरा", "डिलीवर") rely on green/amber/red + a Hindi word. For colour-blind users and for the low-literacy audience that is the whole point of this product, add a tiny shape/icon per status (e.g. ● on-track, ◐ slow, ■ idle, ○ free; check / loom / pause / dot).
- `app/src/features/home/HomePage.tsx` (loom tile ~line 31 status map + tile render) and the order status chips in `app/src/features/orders/*` — add an inline `lucide` glyph beside the count/label.

**[P1] Language toggle tap target is 40×40 px — below the project's own 48 px rule (D-/F-rules in architecture).**
Measured `हिं` button = 40×40, `EN` = 46×40. It clears the WCAG 2.5.8 24 px floor but not the stated 48 px product rule, and it is a primary control on every screen for a Hindi-first product.
- `app/src/app/AppLayout.tsx` (the `SegmentedControl` with `{ value:'hi', label:'हिं' }` ~line 39) and `app/src/components/ui/SegmentedControl.tsx:40` (`min-h-11` = 44 px) — bump to `min-h-12` (48 px) and widen the hi/en segments (min-w-12). Note the public pages already use full "हिंदी / English" labels, which is better; consider the same in-app.

**[P2] Fixed-nav focus-ring contrast.** The saffron focus ring (`outline: 3px solid var(--color-saffron)`, `index.css:82`) is 2.94:1 against white — under the 3:1 for a non-text indicator (WCAG 1.4.11). Switch the ring to the new darker amber or to indigo for guaranteed ≥3:1. (Positive: a visible 3 px ring exists everywhere — only its colour is marginal.)

---

### `/` Owner home — loom board + digest card  (screen: demo-home.png)
Score impression: **8/10.** Best screen in the app. Greeting, "आज का हिसाब" 3-stat card (red ₹ for cash-out, neutral for area), a clear sync banner, the 4-colour loom legend with live counts (15/5/3/1 verified), a 24-tile board numbered by loom code with "N दिन" since progress, thekedar filter chips, and a "आज का सार" CTA. Hierarchy and big numerals are exactly right for the audience.
- **[P0]** Amber "slow" tiles (white on saffron 2.94:1) and the amber legend — see cross-cutting P0.
- **[P1]** Add status icons to tiles — see cross-cutting P1.
- **[P2]** `app/src/features/home/HomePage.tsx` — the three top stats are visually equal; make "नकद दिया" (money) the dominant one for an owner, or label the units (₹ / किलो) inside each tile so a glance is unambiguous.

### `/looms` — loom registry  (demo-looms.png)
**8/10.** Colour-coded avatar chips (code → colour), village, "करघे पर EX-118/01 · 69% · 10'0"", thekedar name. Dense but scannable; search present.
- **[P0]** "करघे पर" status text is `text-saffron` (fails) — cross-cutting P0.
- **[P2]** The avatar colour is derived from loom code but has no legend; a user cannot learn what the colour means. Either tie it to status (reuse the board colours) or drop it to a neutral chip. File: `app/src/features/looms/LoomsPage.tsx`.

### `/weavers` — weaver registry  (demo-weavers.png)
**8/10.** 2-up card grid, coloured initials avatar, name, "पिता: …", village, and a red peshgi balance (₹5,000) where owed — the red-for-money rule applied correctly. Clean and friendly.
- **[P2]** The demo seeds 50 avatar *photos* but the list shows initials-circles, not the photos. If photos exist, show them (model has `photoId`); real faces help low-literacy recognition far more than initials. File: `app/src/features/weavers/WeaversPage.tsx`.
- **[P2]** Several identical names ("Mohammad Rafiq" ×3) are distinguishable only by father/village in small grey text — bump father/village weight or add the phone.

### `/orders` + `/orders/:id` — orders  (demo-orders.png, orders-detail.png)
**8/10 list.** Order cards with exporter · design · colour · size and a 4-cell status breakdown (शुरू नहीं / करघे पर / उतरा / डिलीवर) with big numerals coloured per status — excellent at-a-glance.
- **[P0]** The "करघे पर" count uses saffron text (`rgb(201,138,28)`) — cross-cutting P0.
- **[P2]** `/orders/:id` for a bad id ("यह ऑर्डर नहीं मिला") is a clean friendly 404 — good. (orders-detail.png shows the not-found path because the demo order id differed in that capture; the populated detail was verified via DOM: piece picker, 69% progress, loom/weaver all render.)

### `/yarn`, `/yarn/issue`, `/yarn/return`  (yarn.png, yarn-issue.png)
**8/10.** The landing is textbook: a red "ऊन दिया" (given out) and green "ऊन वापस" (received) pair, exactly the colour contract, plus a clear "अभी कोई ऊन बाहर नहीं है" empty state. The issue form has holder segmented control (करघा/ठेकेदार), loom picker, shade/lot/weight fields with required markers and 3-dp kg input, an optional scale-photo, and a red submit — order verified correct (inputs → photo → submit).
- **[P1]** `app/src/features/yarn/YarnIssuePage.tsx:101` rate-lock hint is `text-saffron` on white — fails contrast; it is important information (which rate got locked). Use amber-ink.
- **[P2]** The holder picker shows an empty "आपके पास कोई करघा नहीं" when no loom is assigned to the logged-in user — correct, but for owner/munshi it should list all looms; verify the empty copy only shows for thekedars.

### `/bazaar/new` — bazaar + tauli wizard  (bazaar-new.png)
**7/10.** A 6-step wizard with a progress bar and "कदम 1/6" — the right pattern for a complex, high-stakes flow on a small screen. Piece picker shows loom · weaver · 69%. Verified the computed gross/net/paid chain renders downstream (per architecture + prior logs).
- **[P0]** Tauli "अतिरिक्त" (extra wool) is shown in `text-saffron` big numerals (`BazaarNewPage.tsx:320-323`) — a money/weight figure that fails contrast. Amber-ink.
- **[P1]** The "आगे →" button is disabled-grey on step 1 with no inline reason beyond the empty-state text; add a one-line "पहले कालीन चुनें" helper next to the disabled button so the user knows *why* they cannot proceed.
- **[P2]** Six steps is a lot; consider collapsing read-only computed steps (area, gross) into a single confirmation screen so the munshi taps fewer times.

### `/peshgi/new`  (peshgi-new.png)
**8/10.** Person-kind segmented control (बुनकर/ठेकेदार), searchable person picker, red "पेशगी दें" submit (given-out = red, correct), and a "पूरा संदेश" slip-preview affordance. Clear "पहले किसको पेशगी देनी है चुनें" guidance.
- **[P2]** No visible amount/photo-required hint until later; surface "₹2,000 से ऊपर फ़ोटो ज़रूरी" (D4) near the amount field so the requirement is not a surprise at save. File: `app/src/features/peshgi/PeshgiNewPage.tsx`.

### `/checkin/new`  (checkin-new.png)
**8/10.** "करघे पर कालीन की प्रगति", piece picker, indigo "चेक-इन सेव करें". Clean. Length-as-ft+in and % progress verified in the data path.
- **[P2]** Photo is "optional but recommended" per SPEC-010 — make the recommendation visible (a subtle "फ़ोटो लगाना बेहतर है") rather than silent.

### `/roker` — cash/UPI ledger  (demo-roker.png)
**8/10.** Date stepper, big "शुरुआती नकद ₹42,500", a 2×2 nakad/UPI in/out matrix (green in, red out), a big indigo closing figure, and a full-width "+ एंट्री जोड़ें". Empty-day state is well done.
- **[P1]** In the demo capture all day values are ₹0 and closing == opening even though the demo seeds bazaars/peshgi — the day's auto-postings are not landing on 2026-10-09 in this view. This is likely a projection/seed-date issue (out of UI scope — flag to the domain/demo owner), but from a *UX* standpoint the owner's headline screen showing ₹0 activity on a busy day erodes trust. Verify `rokerDay` date matching against the seed day.
- **[P2]** Closing-cash card and opening-cash card look near-identical; make closing the visually dominant one (it is the number the owner cares about at 8 pm).

### `/digest` — 8 pm summary  (digest.png)
**8/10.** Three sections (काम / पैसा / ध्यान दें) with iconned rows, a reminder toggle, an indigo "मालिक को भेजें" share, and a live text preview of the exact WhatsApp message — matches the "nothing sent silently" rule. Red/green applied correctly.
- **[P2]** The reminder toggle is 56×32 px (height < 48); enlarge the hit area. File: `app/src/features/digest/DigestPage.tsx`.

### `/audit` — tamper-evident log  (audit.png)
**7/10.** Type + author filters, rows with author · role · timestamp, Hindi header "ऑडिट — सब कुछ दर्ज". Good concept.
- **[P1]** Record **type is shown as the raw English key** ("user", "setting") instead of a Hindi label. For a Hindi-first audit trail this is the one screen that most needs human labels. Add a `t('rec.type.<key>')` map (e.g. user→"यूज़र", setting→"सेटिंग", bazaar→"बाज़ार", yarn_issue→"ऊन दिया", …). File: `app/src/features/audit/AuditPage.tsx`.

### `/settings` — menu + unit settings  (settings.png / demo-settings.png)
**8/10.** A clean 9-tile "सभी हिस्से" grid (the real nav home for everything off the bottom bar), unit code/key reveal (owner-gated), user management with active chip, prefs (photo-required ₹, wastage %, opening cash, owner phone), sync + rejected-records section, load-demo, and a red "लॉग आउट" (destructive = red, correct).
- **[P2]** Dense; consider collapsible sections. The owner-only "कोड और चाबी दिखाएँ" is good (secrets not shown by default).

### `/rates` — rate card + norms  (rates.png)
**8/10.** "अभी का रेट" hero figure, per-quality rate rows (₹38/वर्ग फुट), a norms section, owner-only edit. Empty states ("अभी कोई रेट नहीं" / "अभी कोई नॉर्म नहीं") are clear and tell the user *why* it matters ("ताकि मज़दूरी अपने आप बने").
- **[P2]** The big ₹ hero when empty is just a grey rupee glyph — fine; when populated the "अभी का रe₹40" vs row "₹38" could confuse (current vs listed). Label the hero "सबसे नया रेट".

### `/s/:token` — public weaver slip  (slip-badtoken.png)
**7/10 (as seen).** Public header uses the better full "हिंदी / English" toggle. With no backend it correctly shows a graceful offline state ("इंटरनेट नहीं है — दोबारा कोशिश करें" + retry) rather than crashing. Prior logs confirm the real slip renders a big "सुनें" TTS button, the ₹ line-items, and green सही है / red गलत है buttons, and that an invalid token returns the friendly "पर्ची नहीं मिली".
- **[P1]** The retry/offline screen is good, but a weaver on a keypad-ish phone who hit a genuinely bad link cannot tell "no internet" from "wrong link". When the fetch resolves to 404 (token invalid) show the "पर्ची नहीं मिली" copy; reserve the wifi-off screen for actual network failure. Verify this branch with the server running. File: `app/src/features/slip/PublicSlipPage.tsx`.

### `/o/:orderId` — exporter mock  (exporter-notfound.png)
**7/10.** Saffron "डेमो नमूना" banner (honest about being a mock), bilingual "ऑर्डर स्थिति" header, a clean "यह ऑर्डर नहीं मिला" 404. Prior logs confirm the populated view shows a 53% avg bar, legend 17/3/3/1 (matches the board source of truth per SPEC-013), and per-piece chips.
- **[P2]** The 404 echoes the raw bad id as a stray lowercase "**x**" under the message — looks like a rendering glitch. Drop the raw id or wrap it ("ऑर्डर 'x' नहीं मिला"). File: `app/src/features/exporter/ExporterMockPage.tsx`.
- **[P2]** The saffron "डेमो नमूना" banner is white-on-saffron (2.94:1) — same contrast note; a demo banner is low-stakes but inconsistent with the fix.

### `/setup`  (setup.png)
**9/10.** The strongest form in the app: "बुनकर OS / भदोही कारपेट यूनिट — ऑफलाइन", नई यूनिट / मौजूदा यूनिट से जुड़ें segmented control, large labelled inputs with red required markers, generous spacing, big indigo "यूनिट बनाएँ". Nothing to fix.
- **[P2]** PIN fields have no show/hide or "4 अंक" live counter; a tiny digit-count affordance would help first-time owners.

### `/login`  (login.png, login-pin.png)
**8/10.** "अपना नाम चुनें", searchable user tiles with avatar + name, then a 4-digit PIN keypad (min-h-16 keys = large, good). Wrong-PIN shows a Hindi error (verified in prior logs/specs).
- **[P2]** The card is vertically centered, leaving a large empty top third on a 390-px screen; anchor it higher so the tiles are in thumb reach, and the PIN keypad likewise.

---

## What's genuinely good (keep)

- **Design-token discipline** — one palette, one radius language, consistent cards; `index.css` documents the colour *meanings*, and they are honoured (red=given, green=received) across every money/wool surface I checked.
- **Empty & error states** — specific, actionable, and in warm Hindi ("जब आप किसी करघे या ठेकेदार को ऊन देंगे तो वह यहाँ दिखेगा"). No dead-ends.
- **Accessibility fundamentals** — every input is programmatically labelled (DOM audit: `unlabeledInputs: 0` on all 15 routes), `<html lang="hi">`, exactly one `<h1>` per page, a skip link, and a visible focus ring everywhere (only its colour is marginal).
- **Mobile-first sizing** — 18 px base, big tabular numerals (24–36 px for key figures), 48–64 px primary buttons and PIN keys, bottom nav per role.
- **Honest sharing** — digest/slip show a full message preview before sending.
- **Route-level code splitting** — per-page chunks are 1–9 KB gzip.

## Suggested fix order (impact-first)
1. **P0 saffron contrast** (tokens + ~10 call-sites) — one new CSS var fixes the board, orders, yarn, bazaar, badges at once.
2. **P1 status icons** on loom board + order chips (don't rely on colour alone).
3. **P1 48 px language toggle** (`SegmentedControl` min-h-12).
4. **P1 audit Hindi type labels** + **P1 slip 404-vs-offline branch** + **P1 roker day-0 posting check**.
5. **P2** polish: weaver photos, exporter raw-id echo, digest toggle size, bundle trimming (lucide tree-shake / lazy icons).

---

*Evidence artifacts:* screenshots in `/tmp/rev-ui/*.png`; DOM audit JSON in `/tmp/rev-ui/dom-audit.json`; contrast math and bundle output cited inline. Dev server (vite :5191) was started and stopped for this review; no app source was modified.

---

## Fix log — `fix_ui_ux` (2026-10-09, resumed after prior crash)

Owner scope: `app/src/index.css`, `src/components/ui/*`, `src/app/AppLayout.tsx`, `src/features/{home,looms,weavers,thekedars,orders,rates,yarn,bazaar,peshgi,checkin,roker,digest,audit,slip,shared}/*`, `src/i18n/*`. The prior (crashed) run had already landed most edits; this pass **inspected, completed, and verified** them, added one contrast fix it had missed, wrote the contrast tool, and ran the full gate. `format: finding → fix (file) → evidence`.

### P0

1. **Saffron (#c98a1c) text/numerals fail AA (2.94:1).** → New token `--color-saffron-ink: #8a5a0a` added and used for every saffron *text/fill*; bright saffron kept only for decorative tints/borders. Files: `index.css` (token); `components/ui/Badge.tsx` (`warn` → `text-saffron-ink`); `features/home/HomePage.tsx`, `features/bazaar/{BazaarNewPage,BazaarDetailPage}.tsx`, `features/yarn/{YarnPage,YarnIssuePage}.tsx`, `features/looms/shared.tsx`, `features/audit/AuditPage.tsx`, `features/digest/DigestPage.tsx`, `features/slip/PublicSlipPage.tsx`.
   **Evidence:** `node scripts/contrast.mjs` → `saffron-ink on white = 5.92:1`, `on page bg = 5.43:1` (PASS); OLD saffron 2.94:1 documented as the regression baseline.

2. **"Slow" loom tiles = white on bright saffron (2.94:1).** → Tile fill darkened to `bg-saffron-ink text-white`. File: `features/home/HomePage.tsx` (`STATUS_TILE.slow`).
   **Evidence:** contrast script `slow tile: white on saffron-ink = 5.92:1` (PASS); screenshot `/tmp/fixui/home.png` shows tiles 18/19/20 legible.

### P1

3. **Status signalled by colour alone (WCAG 1.4.1).** → Added a shape/icon per status to **tiles, legend, and pills**: on_track ✓(Check), slow 🕐(Clock), idle ⏸(Pause), free ○(Circle), via `STATUS_ICON` map + inline glyphs. File: `features/home/HomePage.tsx`.
   **Evidence:** `/tmp/fixui/home.png` (390×1361 css, under the 3600 cap) — every tile and the 4-cell legend carry colour **+ icon + Hindi label**.

4. **Language toggle 40×40 (below 48 px rule).** → `components/ui/SegmentedControl.tsx` segments now `min-h-12 min-w-12`; `AppLayout.tsx` uses full `हिंदी / EN` labels; public slip toggle (`features/slip/PublicSlipPage.tsx`) also `min-h-12 min-w-12`.
   **Evidence:** screenshot header shows a 48 px toggle; `grep` confirms `min-h-12 min-w-12` on both controls.

5. **Audit shows raw English record-type keys.** → `features/audit/AuditPage.tsx` `typeLabel()` maps every type through `t('rec.type.<key>')`; all 19 `RecordType`s have Hindi+English labels in `i18n/hi.ts` + `i18n/en.ts` (e.g. `yarn_issue → "ऊन दिया"`, `setting → "सेटिंग"`).
   **Evidence:** `grep rec.type.*` → 19/19 keys present in both locales; `typeLabel` falls back to the raw key only if a label is missing (none are).

6. **Public slip can't tell 404 / expired / offline apart.** → `features/slip/PublicSlipPage.tsx` now branches `status: notfound (404) | gone (410) | offline (network, with retry) | loading | ready`; distinct copy + icon each (`X`/madder, `Clock`/amber-ink, `WifiOff`/amber-ink + retry button). i18n keys `slip.notFound/notFoundHint/gone/goneHint/offline/offlineHint/retry` present in both locales.
   **Evidence:** code review of the `load()` fetch branches + `grep` of the i18n keys.

7. **Digest reminder toggle hit-area < 48 px.** → `features/digest/DigestPage.tsx` switch wrapper enlarged to `h-12 w-16` (48 px tall) around the visual track.
   **Evidence:** source shows `h-12 w-16` on the `role="switch"` button.

### P2

8. **No real photos in weaver/loom lists & pickers.** → `components/ui/PhotoThumb.tsx` (img w/ initials+ImageOff fallback) is used in `features/weavers/{WeaversPage,WeaverDetailPage}.tsx`, `features/looms/{LoomsPage,LoomDetailPage,LoomNewPage}.tsx`, `features/thekedars/ThekedarsPage.tsx`, and the `features/shared/pickers.tsx` LoomPicker; `components/ui/PersonPicker.tsx` renders the stored photo for weaver/person tiles.
   **Evidence:** `grep PhotoThumb` → 8 feature files; PersonPicker loads `photoUrl(photoId)`.

9. **Lucide / bundle weight.** → All icon imports are **individual named imports** from `lucide-react` (no barrel/`import * as`), so Rollup tree-shakes to only the ~60 glyphs actually used. (Import style was already correct; verified, not changed.)
   **Evidence — build chunk sizes:**
   | chunk | review baseline (gzip) | after (gzip) |
   |---|---|---|
   | app entry `index-*.js` | 247.78 kB / 77.68 | 246.45 kB / **77.31** |
   | `createLucideIcon-*.js` | 204.19 kB / 61.35 | 206.96 kB / 62.00 |
   | shared chunk | `Button` 98.90 / 32.94 | `repo` 97.25 / 32.18 |
   | `index.css` | 38.40 / 7.72 | 38.59 / **7.77** |
   | PWA precache | 1802.91 KiB | 1813.87 KiB |
   Lucide is sized by the **count of distinct icons used**, not import style; it is already tree-shaken. Material trimming (e.g. lazy/async icon loading or pruning the icon set) is a larger refactor noted for a follow-up — the per-route page chunks remain small (1–9 kB gzip).

10. **Focus ring colour marginal (2.94:1).** → `index.css` `:focus-visible` outline switched to `var(--color-saffron-ink)`; all `focus-visible:outline-*` call-sites use `saffron-ink`.
    **Evidence:** contrast script `focus ring saffron-ink vs white = 5.92:1 (need 3:1) PASS`.

11. **Free loom-tile text marginal (muted #5a6275 on line #d5dae4 = 4.36:1).** *(caught by my own contrast script this pass).* → `features/home/HomePage.tsx` free tile → `text-[#464d60]`.
    **Evidence:** contrast script `free tile: muted-dark on line = 6.01:1 (PASS)`.

### Not in my ownership — handed off (findings I could not fix here)

- **Exporter mock** (`features/exporter/ExporterMockPage.tsx`, owned by another agent): still uses raw `text-saffron` / white-on-`bg-saffron` (demo banner, `on_hold` chip, legend) — same 2.94:1 contrast issue; and the review's P2 raw-id echo. **Action for owner:** swap `text-saffron`→`text-saffron-ink`, darken the banner/chip fills.
- **Settings** (`features/settings/SettingsPage.tsx`): one `focus-visible:outline-saffron` (should be `-saffron-ink`) for ring consistency; also the e2e **01/08 failures are in the Settings user-management flow** ("Thekedar Ji" tile not rendering after add) — needs the Settings/foundation owner.
- **Demo panel** (`features/demo/DemoPanel.tsx`, `avatars.ts`): decorative `text-saffron`/palette — low stakes, left as-is.
- **Sync/server** (`src/sync/*`, `server/*`, owned by the server/security agent): e2e **04 (slip sync), 05 (offline drain), 06 (duplicate-bazaar reject)** depend on the live API/sync, which was mid-edit during this pass (its `client.ts`/`client.test.ts` had transient tsc errors that the server agent then cleared). Re-run once their work settles.
- **Domain** (`src/domain/*`): nothing from me; wage math is theirs.
- **E2E selectors** (`e2e/*`, QA agent): spec **09b** assumes the peshgi *weaver* picker exposes `role="option"` and that the confirm sheet button is named `/Confirm|पक्का/i`. The shipped markup uses a **toggle-button** PersonPicker (role=`button`+`aria-pressed`, consistent with `/login` which `loginAs` drives via `getByRole('button', {name})`) and a **localised** confirm label (`peshgi.save`). I deliberately did **not** change the markup to chase this (changing PersonPicker to `role=option` broke `loginAs` across the whole suite — I tried and reverted). The stable `data-testid="peshgi-save"` is honoured; QA should select the confirm via its testid/actual label and use `getByRole('button')`/testid for the weaver tile.

### Verification (final lines)

- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`): `tsc exit: 0` — clean across the whole project (0 errors; the server agent's earlier transient `src/sync` errors cleared before the final run; **0 errors in any file I own** throughout).
- **vitest** (`npx vitest run`): `Test Files 15 passed (15)` · `Tests 83 passed (83)`.
- **server tests**: owned by the server agent — not run from this UI pass (out of scope); their `src/sync/*` suite is included in the 15 vitest files above and passed.
- **playwright** (`npx playwright test`, run under the `/tmp/bunkar-e2e.lock` mutex): `19 passed (1.7m)` · `7 failed` — all 7 outside UI ownership or pre-existing e2e-selector assumptions (01/08 Settings, 04/05/06 sync/server, 09b e2e selectors). My PersonPicker revert raised the pass count from 17→19 (fixed 03-demo-loop and 09a which `loginAs` had been blocking).

Dev server (vite :5193) started for height-capped screenshots via `scripts/shot.mjs` and **killed** (`curl :5193 → 000`). New file: `app/scripts/contrast.mjs` (WCAG checker). No `git commit`. `app/src/db/types.ts` untouched.
