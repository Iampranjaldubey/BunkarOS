# CarpetOps: complete product brief

## Product direction [Decided by owner 2026-11-01]
**A digital register for carpet units.** It records attendance, workers, wages, orders and inventory, including a catalogue of finished carpets.

- **The owner sees and edits everything.**
- **What the owner hides from operators is removed by the server**, never only hidden on screen. Changing what is hidden forces operator devices to resync.
- **The unit decides who operates it:** the owner alone, or one or more operators (usually the munshi; the `staff` role in the code). The owner sets what operators may do.
- **Calculations are suggestions.** Before a payment is confirmed, the owner can override any calculated wage line with a reason, and the override is written to the history.
- **Rules are per-business settings with sensible defaults, not hard-coded decisions.** When a partner works differently, add or extend a setting. Do not change the rule for every unit.
- **Not yet:** custom fields, WhatsApp cards.

| Setting (owner only) | Choices | Default | Details |
|---|---|---|---|
| Overtime enabled | on / off | off | 8.2, docs/decisions.md D-001 |
| Off-day policy | none / Sundays / Sundays and listed holidays | Sundays and listed holidays [Provisional] | 8.3, D-002 |
| Slip sections | a fixed list of sections, each on or off | business name, worker name, month, gross, advance recovered, deductions, net pay, signature line | 8.4, D-003 |
| Operator permissions (all operators of the unit together) | add entries, edit past entries, see prices, export; "see wages" comes later | on, off, on, off (= today's staff limits) | section 5, D-005 |

Wage overrides: section 8.4 and D-004. Finished carpet catalogue: section 8.10, D-006 and DM-004. Worked wage examples: docs/wage-examples.md. Specs: SPECS.md D15, SPEC-M13 to SPEC-M15.

---

Purpose of this file: the single source of truth for what we are building and why. Read it fully before any task. It combines the product idea, the confirmed decisions from partner answers, the current build status and the roadmap.

How to read the tags:
- **[Confirmed]** decided by the owner or by partner practice. Treat as binding.
- **[Provisional]** a sensible default, not yet confirmed with a partner. Implement as an easy-to-change default and do not rewrite working behaviour because of it without asking.
- **[Open]** undecided. Do not guess. Propose options and ask.
- Status tags: **Built**, **Partial**, **Gap** (missing), **Planned**, **Later** (not now).

Precedence for facts about the existing system: the code, tests, database constraints and migrations are authoritative about how the data model works. This file is authoritative about intended behaviour. If they disagree on a data-model fact, do not change the code; record the difference in docs/decisions.md and continue. If they disagree on intended behaviour, report it and ask.

---

## 1. One-line summary
A Hindi-first, offline-capable app that lets small and mid-sized carpet manufacturing units in the Bhadohi region run attendance, monthly wages, advances, raw material stock, finished carpets and buyer orders in one place, replacing paper registers and Excel. Modules: workers and attendance, wages and advances, inventory management (raw materials), a finished carpet catalogue, buyers and orders, plus a home dashboard, monthly report and entry log.

Name: **CarpetOps** is the working name. Parts of the code use "Bunkar" (for example the BUNKAR_SECRET variable). [Open] Pick one name before partners and faculty see the product, and use it everywhere.

## 2. The problem and the customer
- **Customer:** an independent carpet manufacturing business (a "unit") in the Bhadohi, Gopiganj and Aurai belt. The paying buyer is the owner. Daily users are the owner and the munshi (supervisor).
- **Evidence from Phase 1:** 40 documented business conversations (35 carpet businesses, plus 5 from earlier exploration of milk-collection and taxi segments). Every conversation showed the same pattern: attendance, wages, stock and buyer orders are tracked on paper or Excel, with no software in use. Several staff asked to see a working product.
- **Core pains:** wage calculation errors and disputes, untracked advances (peshgi), no live view of raw material stock, orders and delivery status held in memory or notebooks, no history of who changed what.
- **Partner practice we know [Confirmed]:** wages are paid monthly; units have a mix of daily-wage and piece-rate workers; overtime is not used; Sundays and holidays are paid; they track wool, cotton or jute yarn, dye, other raw materials and finished carpets; order stages are New, In production, Finished, Delivered; wages are handed out in mixed ways (printed sheet, WhatsApp, cash with signature); both Hindi and English matter equally.

## 3. Value proposition
- Gets the monthly wage right, shows exactly how each number was calculated, and prevents silent changes.
- Tracks advances and recovers them correctly.
- Shows what raw material is in stock and which orders are due or overdue.
- Works on a phone, works offline, and also has a proper PC layout with tables and printing.
- Hindi by default, simple enough for a munshi.

## 4. Business context
- This is the MVP for the Sitare University Startup Program (June 2026 to April 2027, final credit deadline 31 March 2027). The product must be software that independent businesses pay for on a recurring basis.
- **Phase 2 (due end of October 2026):** a working MVP with a link faculty can open, at least 3 design partners who actually use it (written confirmation from each), a feedback log, and one documented pricing conversation with a design partner. Design partners use it free.
- **Phase 3 (November to March):** convert design partners into paying customers on a recurring contract. A paid pilot that has not converted to a recurring contract does not count. One signed contract still active after 30 days is the minimum for full credit.
- **Independence rule:** design partners and paying customers must have no personal relationship with any team member. No relatives, family or personal friends.
- **Pricing hypothesis [Provisional]:** flat monthly subscription per business, roughly Rs 500 to Rs 1,500 per month. Untested. Billing is not built; first invoices will be manual.
- **Success for Phase 2:** 3 independent partners use it for real work, with evidence (usage log, confirmations, feedback log), and the wage numbers match what each partner calculates by hand.

## 5. Users and roles
| Role | Access | Status |
|---|---|---|
| Owner | Sees and edits everything: settings, users, pay rates, locking months, export, undo any entry, override any wage line with a reason | Built (wage overrides built 2026-11-02, D-004) |
| Operator (staff, munshi) | What the owner allows with toggles that apply to all operators of the unit. Stage 1: add entries (default on), edit past entries (off; otherwise own entries from the same day only), see prices (on; when off the server removes order and catalogue prices from what it sends), export (off). Operators see wages as today; a "see wages" toggle comes later, only together with server-side wage removal. Never: settings, users, pay rates, month lock, wage overrides | Built: stage 1 toggles 2026-11-02 (D-005); "see wages" later |
| Worker | Own read-only page by WhatsApp link or by shop code, name and 4-digit worker code. No login | Built |
| Founders' admin | Read-only view of all units, only when ADMIN_KEYS is set | Built |
| Faculty or demo viewer | A read-only way to see the product | Gap. Use a demo unit with fake data for now |

## 6. Product principles
1. **Wage correctness first.** One wrong wage figure loses a partner. Wage logic must be pure, tested and explainable.
2. **Nothing is silently changed.** History is append-only. Edits create new versions and corrections are reversals.
3. **Hindi first, English equal.** No hard-coded user-facing strings.
4. **Works with bad connectivity.** Entries are saved on the device first and synced later.
5. **Simple for the munshi.** Few taps, big targets, no jargon.
6. **PC is a first-class device.** Owners work on PCs. Wage sheets, reports and printing must work well on a desktop browser.
7. **Do not build beyond the MVP list.** Depth and reliability beat breadth.
8. **Calculations are suggestions.** Show how each figure was worked out; the owner can override it with a reason, and the history keeps both.
9. **Rules are settings.** A rule that differs between units is an owner setting with a sensible default.

## 7. Architecture (as built)
- **App:** offline-first PWA in React and TypeScript (about 8,000 lines in app/src, excluding tests). Desktop-first layout from 1024 px: collapsible side menu with quick entry and logout, real tables, keyboard attendance; bottom bar on phones. Languages: Hindi (default), Hinglish, English. Light, dark or automatic theme, both checked for AA contrast.
- **Server:** small Node service (about 950 lines in server/, including the demo seed script) plus Postgres.
- **Auth model:** a unit (shop) has a unit key (stored as a scrypt hash) and a 6-digit shop code. Users log in with a 4-digit PIN. Tokens last 365 days. Staff and owner tokens are issued by the server, which checks the PIN when online; offline, a phone accepts only users who logged in on it before. PIN hashes never leave the server, and photos need a user login. Worker pages use revocable links or shop code plus worker code.
- **Data model:** a few physical tables (units, records, photos, worker_links, meta). Almost all business data is JSON in the append-only `records` table. Nothing is updated or deleted. An edit creates a new version. A correction is a `reversal` record pointing at the old one. `seq` is the sync cursor.
- **Record envelope:** id (generated on the phone), type, unitId, payload, by, role, device, at (UTC), day (business day in IST, can be backdated), sync state (pending, synced, rejected), serverSeq, rejectReason, photoIds, replaces.
- **Money and quantities:** money in whole paise, quantities in whole thousandths (grams for kg). No decimals, no rounding drift.
- **Server rules (server/rules.mjs):** author must match the token's user; only the owner writes setting, user and period_lock; staff limits; records dated in a locked month are refused; one payment per worker per month; the server re-checks wage arithmetic; field validation; pushing the same record id twice is accepted without storing twice.
- **API:** health, create unit, auth token, sync (push and pull, 500 per page), unit info, photos, worker links, public worker page endpoints (rate-limited), admin login and read-only admin views.
- **Tests on record (2026-11-01, branch desktop-first):** server 26 of 26, Vitest 33 passed, Playwright 27 passed (functional specs run on a phone and a desktop screen). Typecheck and build pass; lint has 0 errors and 53 warnings. Full audit: docs/audit.md.

## 8. Features and rules by module

### 8.1 Setup and login
- Owner creates a unit (shop name, own name, 4-digit PIN). Another phone joins with the unit code and key from Settings. PIN keypad login. Explicit log out. Status: **Built**.

### 8.2 Workers and attendance
- Worker record: name, phone, job (weaver, finisher, helper, other), pay type (monthly, daily, per piece) with rate, overtime rate, joining date, photo, active flag, 4-digit worker code. **Built**.
- Daily attendance on one screen for the whole shop: Present, Half or Absent, "all present" button; piece counts can be entered for per-piece workers. **Built**.
- Corrections: marking the same day again replaces the earlier mark and shows as "edited" in the log. **Built**.
- Worker page with month grid, advances, last payment and balance. **Built**.
- Month attendance grid for the whole shop with fast editing. **Partial** (month grid exists on the worker page and in the report; confirm an editable whole-shop grid).
- **Overtime [Decided by owner 2026-11-01, docs/decisions.md D-001].** Partners do not use it. Owner-only unit setting "Overtime enabled", default off. When off, hide overtime on every screen (worker form, attendance, wage sheet, pay page, slip, month report, export, worker page) and default new workers' overtime rate to zero. Keep the code and data. **Built** (2026-11-02).

### 8.3 Paid Sundays and holidays
- **[Confirmed]** Partners pay Sundays and holidays.
- Holiday list: owner-only Settings screen to add and remove holidays; staff see it read-only; the attendance screen notes when the picked day is a holiday or Sunday. Sundays are the default weekly off. **Built**.
- Pay before 2026-11-02: daily-rate workers were paid present days times rate, so unmarked Sundays and holidays were not paid. Now follows the off-day policy below. **Built** (2026-11-02).
- **Rule [Decided by owner 2026-11-01, docs/decisions.md D-002]:** an owner setting "Off-day policy" with three choices: none, Sundays, or Sundays and listed holidays. Default: **Sundays and listed holidays** (**Provisional** business rule; confirm with design partners before they rely on it).
  - A daily-rate worker gets one paid day for each day the policy chooses that falls on or after their joining date, unless they were explicitly marked Absent that day.
  - Piece-rate workers get nothing for off days. Monthly workers are unaffected.
  - Mid-month joiners count from their joining date; absences around an off day do not remove it.
  - Show paid off days distinctly in the month grid and in the wage sheet and pay-screen breakdown.
  - Pure functions with tests. Works offline.
  - Confirm the rule with design partners before they rely on it.
- The earlier workaround (mark daily workers Present on Sundays) is no longer needed; a Present mark on a paid off day is paid once, not twice.

### 8.4 Advances and wages
- Advances (kharcha or peshgi) any day, cash or UPI, with photo where required. **Built**.
- Month wage sheet for all workers: gross, overtime, advances, net, paid or pending, totals. **Built**.
- **Formulas as built (all in paise):**
  - Monthly: salary minus absent days times (salary divided by W) minus half days times half of that. W is working days per month, default 26.
  - Daily: present days times rate plus half days times half the rate.
  - Per piece: sum of count times rate.
  - Overtime: hours times overtime rate (only when the owner turns overtime on; see 8.2).
  - Net equals gross plus overtime minus deductions minus advance recovered. Paid equals net plus rounding, rounded to Rs 1.
  - Advance recovery cannot exceed what remains of the pay.
- Paying a worker: line-by-line breakdown, editable deduction lines, adjustable advance recovery, WhatsApp share after preview, printing. **Built**.
- Locking: the owner locks and unlocks a month. A locked month refuses new entries dated inside it. One payment per worker per month. **Built**.
- Paid history comes from the stored `wage_payment` snapshot. Never recompute a paid month from current rates. **Built** (SPEC-M16, 2026-11-02): the pay screen, slip, worker page and paid wage-sheet rows use `paidView()` of the stored payment.
- **[Open]** How partners recover advances (all at once, fixed amount, owner's choice). Current behaviour: owner chooses the recovery, capped at remaining pay.
- **[Open]** Whether net pay may go negative. Never store a negative net. The server already checks arithmetic.
- **[Open]** Whether a half day is always half a day.
- **[Open]** Whether piece rates vary by design or size. The rate is stored on each piece entry, so this already works if entered per entry.
- **Wage slip [Decided by owner 2026-11-01, docs/decisions.md D-003]:** the printed slip is a real A4 page made of a fixed list of sections that the owner switches on or off (setting "Slip sections"). Default: business name, worker name, month, gross wage (also for monthly workers), advance recovered, deductions, net pay and a signature line. Off by default: attendance summary, paid off days, pieces, overtime, rate, owner changes, advance balance, payment date and mode. A Rounding row is printed automatically when rounding is not zero. The detailed breakdown stays on the pay screen and the worker's own page. A4 print is the main route; WhatsApp share is secondary and carries the same rows plus a link to the worker's page. Status: **Built** (2026-11-02).
- **Owner override [Decided by owner 2026-11-01/02, docs/decisions.md D-004]:**
  - Only before the payment is confirmed, the owner can change the amount of any calculated wage line. A reason is required.
  - The computed amount, new amount, reason, who and when go to the history; the worker's page marks the line as changed by the owner.
  - Net pay can never go negative. Overrides never change the worker's rates.
  - **To change a paid month**, the owner does four steps in order, each logged with a reason: unlock the month, reverse the payment (the reversed payment stays in the history), pay again, lock the month again.
  - Worked example: docs/wage-examples.md Example C.
  - Status: **Built** (2026-11-02).

### 8.5 Inventory management (raw materials, finished carpets and stock ledger)
Called "stock" in the app and in the code (item, stock_in, stock_out, stock_adjust and finished_in records). This is the inventory module.

**What is tracked [Confirmed]:** wool, cotton or jute yarn, dye, other raw materials, and finished carpets.

**Items**
- Each item has a name, a kind (raw or finished), a unit (kg, pcs, litre, metre) and an optional low-stock level, plus an active flag. Status: **Built**.
- Quantities are stored in thousandths (grams for kg), so there are no decimal errors.

**Movements (all append-only, with who, when and a photo where required)**
- **Stock in:** quantity, rate and supplier (purchase). **Built**.
- **Stock out:** reason (production, sale or other), linked to a worker or an order. **Built**.
- **Adjustment:** wastage, count correction, damage or other, with a mandatory note. **Built**.
- **Finished carpets in:** finished production adds to finished-carpet stock. **Built**.
- **Over-issue guard:** going below zero is blocked. Only the owner can override. **Built**.
- **Photos:** required for stock-in above the owner's limit. **Built**.
- Edits and mistakes are corrected by undo or reversal with a reason, never by deleting. Staff can undo only their own entries from the same day.

**Views**
- Live balance per item, with a low-stock flag. **Built**.
- Monthly ledger per item: opening, in, out, adjust, closing. **Built**.
- Low-stock items appear on the Home screen, and stock movement appears in the monthly report and in the Excel export (Stock sheet). **Built**.

**Link to orders:** a delivery can take from finished-carpet stock and cannot take more than is on hand (see 8.6). **Built**.

**Gaps and open items**
- Finished carpets by design and size: **Built** as the finished carpet catalogue (section 8.10, 2026-11-02). **[Decided by owner 2026-11-02, DM-004]** The catalogue is the one place for new finished carpets. Once it exists, the stock item form no longer offers the "finished" kind. Existing finished items keep working (balance, history, deliveries) and are labelled legacy. No automatic migration.
- Units per raw material: **[Open]** confirm with partners.
- Carpets made for stock without an order: recorded in the catalogue (section 8.10).
- Import of opening stock from Excel or CSV: **Planned** (backlog P2).
- Not in scope for now: supplier management, barcodes, purchase orders, per-loom wool issue and return reconciliation (see section 11).

### 8.6 Buyers and orders
- Buyer, design, size, quantity, due date, optional price, notes. Order numbers like ORD-001, editable. **Built**.
- Status flow New, In production, Finished, Delivered. Partial deliveries allowed. Automatically Delivered when the full quantity is delivered. Delivery can take from finished-carpet stock and cannot exceed what is on hand. **Built**.
- Order list with overdue and due-within-7-days flags (overdue first), notes timeline, WhatsApp status message with preview. **Built**.
- **[Open]** Money tracking (amounts and payments received). For now keep only the optional price. Do not build payment tracking.

### 8.7 Home, month report, log and export
- Home: today's attendance, wages due, advances outstanding, low stock, orders due or overdue, today's entries per user; tiles open the records behind them. **Built**. A pending-delivery quantity tile is **Planned**.
- Month report: attendance grid, wage sheet, stock movement, orders summary, money paid out by cash and UPI, usage per user. **Built**.
- Entry log: every entry with who, when and old value, filter by user, undo with a reason. **Built**.
- Excel export with 5 sheets (Summary, Attendance, Wages, Stock, Orders with a total row) and print layouts. **Built**. CSV export is **Planned**.
- Photos compressed to JPEG, long edge at most 1280 px, required for advances, wage payments and large stock-in (owner's limit, default Rs 2,000). **Built**.

### 8.8 Worker's own page
- Opened from a WhatsApp link or from the shop code, worker name and 4-digit worker code. Shows this month's expected pay, pay history by year with slip lines, advances, and "ask the owner" on WhatsApp. The owner can send, copy, cancel or regenerate the link and code. **Built**.

### 8.9 Founders' admin
- Read-only English view of every unit: owner, shop code, logins, workers, entries this month, last activity; unit page with users, workers, wage sheet, stock, orders, usage and last 50 entries. Only active when ADMIN_KEYS is set. **Built**. This is the source of usage evidence for design-partner confirmations.

### 8.10 Finished carpet catalogue [Decided by owner 2026-11-01, docs/decisions.md D-006, SPEC-M15]
- **Each carpet:**
  - up to 4 photos, compressed like other photos
  - design name or code
  - size (length, width and unit)
  - either a quantity, or a unique piece tag for a single carpet
  - material notes
  - optional cost and selling price
  - status: in stock, reserved, delivered, sold or written off
  - notes
- **Screens:**
  - Photo grid with search (design, tag, notes) and filters (status, size, design). Delivered, sold and written-off carpets are hidden unless the filter asks for them.
  - Reserve carpets for an order, deliver from the reservation, and release a reservation with a reason.
  - A delivery updates the order's delivered quantity and status as today.
- **Ways out of the catalogue [Decided by owner 2026-11-02]:** each has a date:
  - delivered against an order;
  - sold directly (no order; a note is required);
  - written off (no order; a note is required).
  - Sold and written off take carpets from stock only; a reserved carpet must be released first.
  - A mistake is undone with a reversal and a reason.
- **Limits:** a reservation, delivery, sale or write-off can never exceed what is available, and a reservation or delivery can never exceed what the order still needs. Piece tags are unique in the unit.
- **Prices:** the owner can hide cost and selling price from operators (operator permission "See prices"); the server removes them from what operators receive.
- **Works offline;** entries sync like everything else.
- **Not yet:** custom fields, WhatsApp cards, barcodes.
- **Status: Built** (2026-11-02, SPEC-M15).

## 9. Gaps and backlog (in priority order)
**P0 (before partners rely on it)**
1. Paid Sundays and holidays for daily workers, as the owner setting "Off-day policy" (section 8.3, decided D-002).
2. Owner setting "Overtime enabled", default off; hide overtime when off; default overtime rate zero (section 8.2, decided D-001).
3. Printed A4 wage slip built from the owner setting "Slip sections", default = the decided content with a signature line (section 8.4, decided D-003).
4. Rerun all tests (server, Vitest, Playwright) on the deploy machine.
5. Deploy with HTTPS, backups and the environment variables set, then test on a real phone and a real PC.
6. Demo unit with fake data for faculty.

**P1**
7. (Done 2026-11-01: PIN hashes stay on the server, photos need a login.) Remaining hardening found in docs/audit.md §16: photo ids must not be overwritten, staff same-day undo must use the server's date, and stock balances must be checked on the server.
8. Test offline sync with two phones and rejected-record cases (locked month, second payment).
9. A read-only viewer role for faculty (can be an operator with "Add entries" off, D-005).
10. (Done 2026-11-01: TASKS.md updated.)
10a. Owner override on any wage line with a reason, written to the history (section 8.4, D-004, SPEC-M14).
10b. Operator permission toggles, stage 1: add entries, edit past entries, see prices (removed by the server, forced resync on change), export (section 5, D-005, SPEC-M13).
10c. Finished carpet catalogue with sold directly and written off; finished kind hidden in the item form; legacy label for old finished items (section 8.10, D-006, DM-004, SPEC-M15).
10d. Later: "See wages" toggle, only together with server-side removal of wage data and the same forced resync (D-005 stage 2, SPEC-M13 stage 2).

**P2**
11. CSV export, pending-delivery quantity tile. (The Orders sheet in the Excel export is done.)
12. (Moved to P1 10c: design and size fields for finished carpets are part of the catalogue.)
13. Excel or CSV import for workers, items and opening stock.
14. Editable whole-shop month attendance grid, if missing.

**P3**
15. Mixed pay type (one worker earning daily and piece).
16. Sync performance as data grows (the server re-reads records of a type on each sync).

## 10. Out of scope (do not build)
Invoicing and GST, order payment tracking, payment gateway, subscription billing, multi-branch, AI features, barcodes, supplier management, native apps, custom fields and WhatsApp cards (not yet), anything not listed above.

## 11. Later ideas (unvalidated, not now)
These came from early research and have not been confirmed by partners. Do not build them. They are only here so they are not lost: contractor (thekedar) hierarchy and wage flows, wool issued versus carpet returned per loom with variance, loom progress check-ins by photo, an exporter-facing order tracking link, voice wage slips for weavers, buyer or compliance records. Validate with partners first.

## 12. Deployment and operations
- Not a static site. It needs a Node service, Postgres and HTTPS (required for the PWA and service worker). The app can be served by the Node service or hosted separately with CORS configured.
- Environment variables include BUNKAR_SECRET (set it explicitly), ADMIN_KEYS and the database connection setting. Document the full list in docs/DEPLOY.md.
- Lovable is no longer used. GitHub is the source of truth. There is no automatic migration on push; migrations are applied by a human.
- Before real partner data: automatic Postgres backups and a tested restore. Photos are stored in the database (BYTEA), so watch database size.
- Free hosting tiers may sleep or expire; use a paid database tier once partners enter real data.

## 13. Roadmap
- **Now (end of October 2026):** finish P0, deploy, onboard 3 independent design partners, collect written confirmations and usage evidence, start the feedback log, run one documented pricing conversation, prepare the features document and the Phase 2 post-mortem.
- **November to December:** stabilise from partner feedback, P1 items, set up a business bank account, GST registration and a simple recurring billing agreement, start conversion conversations.
- **January:** faculty review (near-miss assessment for teams without a contract). Aim for signed LOIs or active pricing negotiations with three or more businesses.
- **February to March:** final conversion window. A signed recurring contract still active 30 days after signing, before 31 March 2027.
- **Product after the MVP:** P2 and P3 items, then partner-validated ideas from section 11.

## 14. Definition of done for the MVP
- A partner runs one full real month (attendance, advances, wage calculation, wage slip, payment, lock) and the net pay matches their own calculation.
- Daily workers are paid for Sundays and holidays.
- Stock balances and order statuses are correct after a week of real use.
- All tests pass. Typecheck, lint and build pass.
- The live link works on a phone and a PC, with HTTPS, backups and a demo unit.
- Three independent partners use it, with written confirmation and usage evidence.

## 15. Working agreements for the agent
- Do not add features outside this file. If something seems missing, ask.
- Plan before changes that touch several files. For autonomous runs, choose the simplest option that follows this file, log it in docs/decisions.md and mark it "needs confirmation".
- Wage, advance, stock and order logic stays in pure, tested functions.
- Never run git push, never apply migrations to a database with real partner data, never touch secrets, and never delete data, unless explicitly told.
- Done means evidence: typecheck, lint, build and tests run, with output shown. Say plainly when something could not be verified.
- Hindi strings are flagged for human proofreading. List new ones in the run summary.
