# Run summary: finished carpet catalogue (SPEC-M15, DM-004)

- **Date:** 2026-11-02 (IST). Branch `desktop-first`, committed locally, not pushed.
- **Scope:** SPEC-M15 AC1–AC15 and DM-004. Custom fields and WhatsApp cards were not built.
- **Previous run summary (settings and wages):** `git show d7d256f:docs/run-summary.md`.
- **Data:** every test ran on a throwaway Postgres schema:
  - `t_<random>` for each server test file;
  - `e2e` for Playwright;
  - `seedcheck` for the demo seed.
  The local `public` schema (the user's data) was not touched.

## Acceptance criteria and evidence

| # | Criterion (goal) | Built in | Test that proves it |
|---|---|---|---|
| 1 | **Fields:** up to 4 compressed photos, design name or code, size (length, width, unit), quantity or a unique piece tag, material notes, optional cost and selling price, status (in stock, reserved, delivered, sold directly, written off), notes. | `CarpetP` in `app/src/db/types.ts`; form `features/catalogue/CarpetFormPage.tsx` with `components/ui/PhotoList.tsx`; status from entries in `domain/catalogue.ts` (`carpetView`); photo compression in `db/photos.ts` (≤ 1280 px, lowers quality or size until ≤ 300 KB) | Vitest `catalogue.test.ts` "AC1", "AC2". Server "AC2 + AC3" (5 photos → `too_many_photos`, bad sizes, negative price). e2e 13 test 1: 5 photos picked → 4 kept, "add photo" disappears; saved photos are JPEG, ≤ 1280 px, ≤ 300 KB (from a 2400 × 1600 noisy picture); the grid card shows the cover, "5 स्टॉक में", "8 × 10 ft" and ₹45,000. The five statuses appear in e2e 13 test 2 (reserved, delivered, sold, written off). |
| 2 | **Grid** with search and filters by design, size, status and price; works offline with queued photo uploads. | `CataloguePage.tsx` (desktop filter panel, phone filter sheet), `filterCarpets` / `filterOptions` | Vitest "AC6–AC7" (search, design, size, statuses, price range, default hides delivered / sold / written off). e2e 13 test 2: search "kashan" + size 8 × 10; "reserved" only; design + max price; delivered and written-off pieces hidden by default and shown with their filter. e2e 13 test 1 runs offline: the carpet, its "added" entry and 3 photos are saved as `pending` and shown in the grid; back online every record is synced and all 3 photos change to `synced`. e2e 13 test 3: a photo taken on the owner's phone loads on the operator's phone. |
| 3 | **Reserve** for an order, **release**, **deliver**; **sold directly** and **written off**, each with a date and a required note. | `CarpetDetailPage.tsx` (reserve, deliver, sold, written off, add more, release, undo); order page card `OrderCatalogue.tsx` ("कैटलॉग से रखें", "कैटलॉग से डिलीवर करें"); `moveLimits` / `moveError`; server `server/catalogue.mjs` | Vitest "AC4–AC5", "AC10–AC14". Server "AC1–AC5, AC10–AC13" (exceeds_order, unknown order or carpet, note_required, insufficient_stock, invalid_kind, release needs a reason, the reserved carpet can only be sold after release, a sale back-dated to yesterday). e2e 13 test 2 covers AC4, AC5, AC10, AC11 (dated yesterday), AC12, AC13 (no note, too many, reserved carpet, locked month) and AC14. The entry log shows the sale with its note, the undo with its reason, the release and the write-off. |
| 4 | **Piece tags are unique** per unit. | `tagTaken` / `carpetError` (app), `carpetProblem` (server); case and spaces ignored, active carpets only | Vitest "AC3". Server: a duplicate tag in the same push and from an operator → `duplicate_tag`; the same carpet may keep its tag. e2e 13 test 1: a second "bh-0042" shows "यह टैग पहले से किसी और कालीन पर है" and is not saved. |
| 5 | **See prices off:** the server's sync and API responses to an operator contain no price fields for the catalogue or orders, proven by a server test that inspects the response; the owner always sees prices. | `PRICE_FIELDS` + `publicRec` (server/db.mjs), price copy and `forbidden_price` in `routes.mjs`; the app hides price fields and does not send them | Server `catalogue.test.mjs` "criterion 5": the **raw response text** is checked with `/"(pricePaise\|costPaise)"/` and for the amounts themselves, in five places: the operator's full pull, the echo of the operator's push, the push with a priced record (refused `forbidden_price`), the token-less bootstrap pull, and the worker page `/api/w/:token`. The owner's response still has every price, including the stored prices kept on the operator's edit. Turning prices back on returns them. e2e 13 test 3: after the resync the operator's IndexedDB has no `pricePaise` / `costPaise` on carpets, there is no price on the grid, detail page or edit form, and the owner still sees ₹45,000 / ₹30,000 after the operator's edit. |
| 6 | **Finished kind hidden** in the stock item form; legacy finished items labelled. | `ItemFormPage.tsx` (raw materials only; an old finished item shows "पुराना"), `StockPage.tsx` (badge + catalogue link), `ItemDetailPage.tsx` (title "· पुराना"), order "from stock" picker | e2e 13 test 2 (AC15): `/stock/new` has no "तैयार कालीन" choice; an existing finished item "Kashan 8x10" shows "पुराना" in the stock list, on its page and in its edit form, keeps its balance (3) and is delivered against a new order (balance 2, order 1/2). |
| 7 | **All tests pass.** | — | See "Checks". |

## Checks (final run, 2026-11-02)

| Check | Result |
|---|---|
| `npm run typecheck` (app) | exit 0 |
| `npm run lint` (app) | 0 errors, 55 warnings. The baseline was 53: +3 for the new lazy routes in `router.tsx` (the existing fast-refresh warning, one per lazy route), −1 because an existing effect in `ItemFormPage.tsx` was removed. |
| `npx vitest run` | 13 files, 75 passed (new `catalogue.test.ts`, 14 tests) |
| `cd server && npm test` | 40 tests, 40 pass, 0 fail (new `catalogue.test.mjs`, 4 tests) |
| `npx playwright test` (mobile 390×844 + desktop 1440×900) | 41 passed, twice in a row on the final code (5.7 min each). New e2e 13 (3 tests) runs in both projects; the phone and desktop sweeps include `/catalogue` and `/catalogue/new`. |
| `npm run build` | exit 0, precache 123 entries / 1427.96 KiB |
| Demo seed on schema `seedcheck` | accepted 42, rejected 0 (adds 3 carpets, a reservation and a direct sale) |

## Bugs found and fixed
- **Order number:** on a fresh page the "new order" form fixed its suggested number at ORD-001 before the records had loaded, so a second order could get ORD-001 again. The number now follows the records until the user types one. e2e 13 test 2 checks that the second order gets ORD-002.
- **Photos on other phones:** a photo was shown only on the phone that took it. Catalogue photos are now fetched from the server (with the user's login) when they are missing locally, and kept for offline viewing. A photo the server does not have yet is asked for again after a minute, not on every render.
- **Photo size:** compression stopped at 1280 px and JPEG quality 0.7 without checking the size. The app now lowers the quality and then the size until the photo is at most 300 KB.

## Behaviour changes to know
- **New finished carpets** go to the catalogue. The stock item form makes raw materials only. Old finished items keep working and show "पुराना".
- **Operators** with "add entries" can add carpets, reserve, deliver, sell directly and write off. Without "see prices" they see no cost or price, and their edits keep the stored prices.
- **Releasing** a reservation and **undoing** a sale or write-off get their own rows in the entry log.
- **Navigation:** the side menu, the "More" page and the quick-entry menu ("नया कालीन") include the catalogue.

## New Hindi strings (for proofreading)
All 107 keys are in `app/src/i18n/catalogue.hi.ts`, with Hinglish and English in `catalogue.hin.ts` and `catalogue.en.ts` (the same key set; checked by script). The main ones:

| Where | Strings |
|---|---|
| Menu, titles | कालीन कैटलॉग · नया कालीन · कालीन बदलें · कैटलॉग में अभी कोई कालीन नहीं · इन फ़िल्टर से कोई कालीन नहीं मिला |
| Form | डिज़ाइन (नाम या कोड) · लंबाई · चौड़ाई · नाप की इकाई (फ़ुट / मीटर / सेमी) · कैसे गिनें: गिनती (एक जैसे कई) / एक पीस (टैग के साथ) · पीस टैग · सामान के नोट (ऊन, गाँठ, रंग) · लागत (₹, एक कालीन) · बेचने का भाव (₹, एक कालीन) · फ़ोटो (ज़्यादा से ज़्यादा 4) · पहली फ़ोटो कैटलॉग में दिखेगी |
| Status | स्टॉक में · ऑर्डर के लिए रखा · डिलीवर हुआ · सीधे बेचा · बट्टे खाते में |
| Actions | ऑर्डर के लिए रखें · डिलीवर करें · सीधे बेचा · बट्टे खाते में डालें · रखा हुआ छोड़ें · और कालीन जोड़ें · कैटलॉग से रखें · कैटलॉग से डिलीवर करें |
| Errors | यह टैग पहले से किसी और कालीन पर है · स्टॉक में सिर्फ़ {n} हैं (रखे हुए पहले छोड़ें) · ऑर्डर को सिर्फ़ {n} और चाहिए · नोट ज़रूरी है · यह पीस पहले ही जुड़ चुका है |
| Legacy | पुराना · पुराने तैयार कालीन आइटम: बैलेंस और इतिहास वैसे ही रहेंगे। नए कालीन कैटलॉग में जोड़ें। |
| Log | रखा हुआ छोड़ा: {carpet} · {order} · वापस लिया: {carpet} · {what} |

The action "सीधे बेचा" and the status "सीधे बेचा" are the same words. Please confirm that this reads well, or suggest a verb for the button (for example "सीधे बेचें").

## Files
- **New:**
  - `app/src/domain/catalogue.ts`, `app/src/features/catalogue/{CataloguePage,CarpetFormPage,CarpetDetailPage,OrderCatalogue,shared}.tsx`, `app/src/components/ui/PhotoList.tsx`, `app/src/i18n/catalogue.{hi,hin,en}.ts`, `server/catalogue.mjs`
  - tests: `app/src/domain/catalogue.test.ts`, `server/test/catalogue.test.mjs`, `app/e2e/13-catalogue.spec.ts`
- **Changed:**
  - types (`db/types.ts`), photos (`db/photos.ts`), sync client (remote photo loader)
  - permissions (`carpet.manage`, needs "add entries"), navigation, routes
  - orders (catalogue card, legacy label, order number), stock list / item form / item page (DM-004), entry log
  - server `rules.mjs` (types, locked months, `invalid_delivery`), `routes.mjs` (catalogue checks in the push), demo seed
  - e2e fixtures (shared operator-device helpers, photo and IndexedDB helpers), e2e 12 (uses them), 20 / 21 (catalogue routes), 22 (quick menu has 7 entries)
- **Docs:** `SPECS.md` (index status, price filter), `docs/decisions.md` (D-006 built + assumptions added while building, DM-004 built), `docs/ARCHITECTURE.md` (feature, record types, server rule 12, price removal), `.kiro/steering/product.md` (statuses), `TASKS.md`, `WATCHINGLOGS.md`.

## Not done / limits
- **Custom fields, WhatsApp cards**, barcodes, sale amounts or buyers for direct sales: out of scope (SPEC-M15 "Out").
- **Photos and database size:** 4 photos per carpet are stored in Postgres. Watch the database size (brief §12).
- **Photos on another phone** load only when that phone is online once. After that they are kept for offline viewing.
- **The test dev server** has no service worker, so the offline e2e test loads the catalogue screens once while online. The built PWA precaches them (precache 123 entries).
- **Sub-agent review:** independent review agents were not available in this environment (`code-review`, `security-review` and `sp-*` are not installed, and `kiro_default` is refused for crew stages). I reviewed the diff myself. That review led to two fixes: "undo added" is hidden when those carpets are gone, and a missing photo is not asked for again on every render.
- **Needs owner confirmation** (in `docs/decisions.md` D-006 "Added while building"): tag uniqueness ignores case and spaces; the mode is fixed after carpets are added; more carpets can be added to a quantity entry; taking back added carpets is refused once they are gone; the price-range filter; photos are fetched by other phones.
