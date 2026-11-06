# Decisions

Product and data-model decisions for Bunkar / CarpetOps. The product brief (`.kiro/steering/product.md`) asks for every difference between the brief and the code to be recorded here.

Status values:
- **Decided by owner**: binding; implement as written.
- **Needs confirmation**: what the code does today, or a detail the agent had to assume. The owner has not confirmed it.

Terms:
- **Owner:** the person who owns the unit.
- **Operator:** someone the owner lets enter data, often the munshi. In the code this is the `staff` role.
- **Setting:** a per-unit rule stored in the unit's `setting` record. Only the owner can change it, and every change is a new version in the history.

## P-000 Product direction

- **Status:** decided by owner (2026-11-01).
- **Decision:**
  - The product is a digital register for carpet units. It records attendance, workers, wages, orders and inventory, including a catalogue of finished carpets (D-006).
  - The owner sees and edits everything.
  - The unit decides who operates it: the owner alone, or an operator whose permissions the owner sets (D-005).
  - Calculations are suggestions. The owner can override a calculated figure with a reason, and the override is written to the history (D-004).
  - Rules are per-business settings with sensible defaults, not hard-coded decisions (D-001, D-002, D-003, D-005).
- **How to apply it:** when a partner's practice differs from a default, add or extend a setting. Do not change the rule for every unit, and do not change a default without asking.
- **Not yet:** custom fields; WhatsApp cards for catalogue carpets.
- **Details assumed (needs confirmation):**
  - No separate "who operates this unit" switch. A unit with no operator login is operated by the owner. A unit may have more than one operator, as today; the operator toggles apply to all of them together (decided 2026-11-02, D-005).
  - "Calculations are suggestions" applies to wage figures for now (D-004). Stock balances and order counts are sums of entries; they are corrected with entries (adjustment, reversal), not overridden.

## P-001 More industries on one platform

- **Status:** direction decided by owner (2026-11-06, multiple-choice answers). Design is a draft: `docs/platform-exploration.md`. Spec SPEC-M18 is not written yet.
- **Decision:**
  - The platform grows from carpet to more industries, under one brand. The name changes later.
  - Only the founders create organisations.
  - Second industry: bag making, with a partner who has no personal ties to the team.
  - Bags start with all six modules on; the partner's feature list decides what turns off.
  - Founders' admin, for now: create an organisation, set its industry and modules, send the owner's invite. No access to the organisation's data.
  - Part of the Sitare goal, now.
- **Answers to `docs/platform-exploration.md` §9 (owner 2026-11-06):** database-level isolation now; paused = can log in and read, can't add entries; invite-only creation, existing units keep working; founders' console in English; bags signature = running-stitch line plus a drawn bag; build the platform base now (SPEC-M18).
- **Founders' data view (owner 2026-11-06):** usage only. The business data views of SPEC-M09 are removed.
- **Open:** bag pay models; the partner's feature list.
- **Brief:** `.kiro/steering/product.md` still describes carpet only. Update it once SPEC-M18 is approved.

## Unit settings

### D-001 Overtime enabled
- **Status:** decided by owner (2026-11-01).
- **Setting:** `overtimeEnabled`, owner-only, default **off**.
- **When off:**
  - Overtime is hidden on every screen: worker form, attendance, wage sheet, pay page, slip, month report, Excel export and the worker's own page.
  - New workers get an overtime rate of ₹0.
- **Always:** the overtime code stays.
- **Details assumed (needs confirmation):**
  - While it is off, overtime hours already recorded stay in the data but are not added to new payments. Turning it on shows and pays them again. Payments already made keep the overtime they stored.
  - When it is on, the default rate stays as today: monthly salary ÷ W ÷ 8, daily rate ÷ 8, piece-rate ₹0.
  - Units created before the setting existed start with it off.

### D-002 Off-day policy
- **Status:** decided by owner (2026-11-01). The default is a **provisional business rule**: confirm it with design partners before they rely on it.
- **Setting:** `offDayPolicy`, owner-only. Choices:
  - `none`: no paid off days.
  - `sundays`: Sundays are paid off days.
  - `sundays_and_holidays` (**default**): Sundays and the holidays on the unit's list are paid off days.
- **Rule for the chosen days:**
  - A daily-rate worker gets one paid day for each of these days that falls on or after their joining date, unless they were explicitly marked Absent that day.
  - Piece-rate workers get nothing for off days.
  - Monthly workers are unaffected.
  - Mid-month joiners count from their joining date. Absences on the days around an off day do not remove it; only an Absent mark on the off day itself does.
- **Details assumed (needs confirmation):**
  - A Present or Half mark on a paid off day is counted once, not twice. (The brief's interim workaround tells partners to mark daily workers Present on Sundays; those marks will not double the pay.)
  - An Absent mark by anyone who may mark attendance (owner or operator) removes the paid day.
  - A holiday on a Sunday counts once.
  - All off days of the month count, including ones after today, so the current month's expected pay already includes the Sundays still to come.
  - The policy only affects pay. The attendance screen and the "unmarked days" count keep treating Sundays and listed holidays as days off whatever the policy is.
  - Changing the policy changes the suggested pay for months not yet paid. Paid months keep what was stored.
- **Related, as built (needs confirmation):**
  - An Absent mark on a Sunday or holiday reduces a **monthly** worker's pay by one day.
  - A monthly worker who joins mid-month gets the full month's salary less marked absences (no proration by joining date).
  - Worked numbers: `docs/wage-examples.md` Example B.

### D-003 Wage slip sections
- **Status:** decided by owner (2026-11-01).
- **Setting:** `slipSections`, owner-only. The printed slip is a real A4 page, built from a fixed list of sections the owner switches on or off. The default is the earlier D-003 slip: business name, worker name, month, gross (including for monthly workers), advance recovered, deductions, net pay and a signature line. The detailed breakdown stays on the pay screen and the worker's own page.

| Section | Default |
|---|---|
| Business name | on |
| Worker name | on |
| Month | on |
| Gross (gross pay + overtime) | on |
| Advance recovered | on |
| Deductions (each with its label) | on |
| Net pay | on |
| Signature line | on |
| Attendance summary (present, half, absent days) | off |
| Paid off days (daily-rate workers) | off |
| Pieces (count × rate) | off |
| Overtime (hours × rate) | off; can only be switched on while overtime is enabled |
| Rate (salary, daily rate or piece rate) | off |
| Rounding | not a switch: printed automatically above net pay whenever it is not zero (built 2026-11-02) |
| Owner changes (overridden lines with their reason, D-004) | off |
| Advance balance after this payment | off |
| Payment date and mode (cash or UPI) | off |

- **Details assumed (needs confirmation):**
  - Business name, worker name, month and net pay cannot be switched off; a slip without them is not a slip.
  - The slip is built from the stored payment record, not from today's rates or attendance (see DM-003).
  - Net pay is the amount handed over: net rounded to ₹1. Because the Rounding row is printed whenever rounding is not zero, the printed rows always add up to net pay.
  - "₹0" is printed when there are no deductions.
  - The WhatsApp slip text uses the same sections and rows as the printed slip (no signature line) and ends with a link to the worker's own page, so the worker gets the same content both ways and can open the full breakdown.

### D-004 Owner override on wage lines
- **Status:** decided by owner (2026-11-01; timing decided 2026-11-02).
- **Decision:**
  - On the pay screen, the owner can change the amount of any calculated wage line. A reason is required.
  - The change is written to the history: computed amount, new amount, reason, who and when.
  - **Overrides are only possible before the payment is confirmed.**
- **Changing a paid month** (decided 2026-11-02). The owner does these steps in order. Each is written to the history with a reason:
  1. Unlock the month, if it is locked.
  2. Reverse the payment. The reversed payment stays in the history.
  3. Pay again. Overrides are allowed again on this new payment.
  4. Lock the month again.
- **Details assumed (needs confirmation):**
  - **Lines that can be overridden:** base salary, absence deduction, half-day deduction, days × rate, paid off days, pieces, overtime, advance recovered and rounding.
  - **What is stored:** the `wage_payment` record gets `overrides: [{line, computedPaise, finalPaise, reason}]`. Its totals are the final amounts, and the snapshot keeps the computed inputs.
  - **Who:** only the owner can override. The server refuses a payment with overrides from anyone else (`forbidden_override`) and refuses an empty reason.
  - **Reasons at each step:**
    - the unlock's reason goes on the reversal of the lock (today it is always the fixed text "unlock");
    - the payment reversal already needs a reason;
    - the new payment carries `correctionReason`, required when that worker already has a reversed payment for the month;
    - the re-lock carries `reason`, required when the month was locked before;
    - a first lock needs no reason.
    - The server refuses each of these without a reason (`reason_required`).
  - The server refuses to reverse a payment while its month is locked (`period_locked`), so step 1 cannot be skipped. This also closes audit §16 P1 for payments.
  - Operators can still lower the advance recovery up to the cap without a reason, as today. That is a choice on the pay screen, not an override.
  - An override can never make net pay negative (client and server).
  - The entry log shows each override and each correction step. The worker's own page marks overridden lines as "changed by owner" and shows only the payment that is not reversed.
  - Overrides apply to that one payment. They never change the worker's rates.

### D-005 Operator permissions
- **Status:** decided by owner (2026-11-01; staging, server-side hiding and resync decided 2026-11-02).
- **Decision:**
  - Owner-only toggles. The defaults match what staff can do today.
  - **The toggles apply to all operators of a unit together** (decided 2026-11-02).
  - **Hidden values are removed by the server** from everything it sends to an operator. A screen-only hide is not allowed (decided 2026-11-02).
  - **Stage 1 (now):** "See prices", covering order prices and catalogue cost and selling price.
  - **"See wages" is not shown** until server-side wage redaction exists. Until then, operators see wages as today. It is a later task.
  - **A change to a toggle that hides data forces every operator device to resync.** Data already on a device stays there otherwise (decided 2026-11-02).

| Toggle | Default | Stage | Today's behaviour it keeps |
|---|---|---|---|
| Add entries | on | 1 | Operators add attendance, advances, payments, stock, orders, workers, items and catalogue entries |
| Edit past entries | off | 1 | Operators can only undo their own entries from the same day |
| See prices | on | 1 | Operators see order prices and catalogue prices |
| Export | off | 1 | Only the owner exports |
| See wages | on | later; no toggle until the server removes wage data | Operators open the wage sheet, pay page and month report |

- **Always owner-only (no toggle):** settings, logins, pay rates, locking and unlocking months, and wage overrides (D-004).
- **How hiding works (stage 1, See prices off):**
  - For an operator's token, the server leaves out `order.pricePaise` and the catalogue's `costPaise` and `pricePaise` from every record it sends: pulls and the records echoed after a push. This is the same mechanism as for PIN hashes (SPEC-M11).
  - An operator's edit of an order or carpet that has no price gets the stored price copied by the server.
  - An operator record that carries a price while the toggle is off is refused (`forbidden_price`).
  - Figures derived from prices are not shown to the operator: the order's amount pending on the order, home and month screens, and the amount column of the Excel Orders sheet.
- **How the resync works:**
  - Every sync response says which view the server applied for this token, for example `view: { seePrices: false }`.
  - The device remembers the view it last synced under. When the view changes, the device deletes every local record that is not pending, resets the pull position to the start and pulls everything again before showing data.
  - Pending entries on the device are kept and pushed.
  - This happens when prices are hidden (they disappear) and when they are shown again (they come back).
- **Known limit, stated plainly:** data that already reached a phone cannot be taken back from a phone that never syncs again or from a modified app. The resync removes it from a normal phone at its next sync.
- **Details assumed (needs confirmation):**
  - **Stock-in purchase rates** are not covered by "See prices" in stage 1. They stay visible to operators. Should the toggle also hide them?
  - **Add entries off:** the operator can look but not enter anything, and the server refuses their writes (`forbidden_permission`). This could also be the read-only faculty viewer (brief P1-9).
  - **Edit past entries on:** the operator may correct entries by anyone, from any earlier day in an unlocked month, with a reason. With it off, the same-day check uses the server's IST date, not the date on the undo (fixes audit §16 P2).
  - **Export:** a screen-only control. It does not hide data, because the export uses only what the device holds, which already has prices removed when "See prices" is off.
  - **Home money tiles** (wages due, advances) stay owner-only, as today.
  - **Later, "See wages" off:** the server removes payment amounts, advance amounts, worker pay fields and piece rates in the same way; operator edits keep the stored values; wage and advance screens are hidden from the operator; attendance and piece counts stay; changing it forces the same resync.

## New module

### D-006 Finished carpet catalogue
- **Status:** decided by owner (2026-11-01; ways out of the catalogue decided 2026-11-02). Built 2026-11-02 (SPEC-M15).
- **Decision:** a catalogue of finished carpets.
  - **Each carpet:**
    - up to 4 photos, compressed
    - design name or code
    - size: length, width and unit
    - a quantity, or a unique piece tag
    - material notes
    - optional cost and selling price
    - status
    - notes
  - **Screens:** a photo grid with search and filters.
  - **Prices:** the owner can hide them from operators. This is the "See prices" toggle (D-005), removed by the server.
  - **Not yet:** custom fields; WhatsApp cards.
- **Ways a carpet leaves the catalogue** (decided 2026-11-02). Each has a date:
  1. **Delivered** against an order, after being reserved for it or straight from stock.
  2. **Sold directly**: no order needed; a note is required.
  3. **Written off**: for example damaged or lost; no order needed; a note is required.
- **Status values:** in stock, reserved, delivered, sold, written off.
- **Details assumed (needs confirmation):**
  - **Size units:** feet, metres or centimetres. Lengths are stored in whole thousandths of the unit, like other quantities.
  - **Two kinds of entry:**
    - A **unique piece** has a tag, unique within the unit, and a quantity of 1.
    - A **quantity entry** (several carpets of one design and size) shows counts per status.
  - **Status comes from entries, not from an editable field:** carpets added, reserved for an order, a reservation released (reversal with a reason), delivered, sold, written off.
  - **Delivery:** uses the existing order `delivery` record with a link to the carpet, so the order's delivered quantity and status update as today.
  - **Sold directly and written off** are one record type, `carpet_out` {carpetId, qty, kind `sold` | `written_off`, note}. Its `day` is the date: it can be back-dated, and locked months refuse it.
    - It takes carpets **from stock only**. A reserved carpet must be released first.
    - No sale price or buyer is recorded (order money tracking is out of scope).
    - An optional photo is allowed.
    - A mistake is undone by a reversal with a reason, which puts the carpets back in stock.
  - **Who:** operators with "Add entries" can create carpets, reserve, deliver, sell directly and write off, as they can adjust stock today. Editing a carpet's details follows the same rule as items. Price fields need "See prices".
  - **Limits, checked in the app and on the server:**
    - a delivery cannot exceed what is reserved for the order plus what is in stock, or the order's pending quantity;
    - a reservation cannot exceed what is in stock, or what the order still needs;
    - sold and written off cannot exceed what is in stock.
  - **Default view:** the grid hides delivered, sold and written-off carpets until the status filter asks for them.
  - **Photos:**
    - Same compression as other photos: JPEG, longest edge ≤ 1280 px, ≤ 300 KB.
    - Stored in Postgres and visible only with a login.
    - The first photo is the cover in the grid.
    - Four photos per carpet can grow the database quickly; watch its size (brief §12).
  - **Old finished-carpet items:** see DM-004.
  - **Added while building (2026-11-02, needs confirmation):**
    - A piece tag is unique among the unit's **active** carpets, ignoring upper/lower case and spaces ("BH-0042" = "bh-0042"). An inactive carpet frees its tag.
    - A carpet's counting mode (piece or quantity) cannot change once carpets were added.
    - More carpets can be added to a quantity entry later ("और कालीन जोड़ें"); a piece is added once, when it is created.
    - Taking back an "added" entry is refused when those carpets are no longer in stock (sold, delivered, reserved or written off first).
    - The grid also filters by a selling-price range; it is shown only to users who see prices.
    - Photos taken on one phone are fetched from the server by the other phones of the unit when online and kept for offline viewing.

## Look and feel

### D-007 Visual redesign "Loom and register"
- **Status:** decided by owner (2026-11-05, multiple-choice answers). Spec: SPECS.md SPEC-M17.
- **Decision:**
  - Redesign the whole interface, phone and desktop web, from zero. Features, data and rules stay.
  - Brand colour: indigo (neel). Red stays for money or stock going out and green for coming in.
  - Name on the logo and login: बुनकर / Bunkar for now. CarpetOps vs Bunkar stays open (brief §1).
  - Home title: the day and the unit name, no greeting.
  - Carpets without photos are drawn in code; partner photos can replace them later.
  - New libraries allowed: `motion`, `@number-flow/react`; React 19.2 → 19.3. While building, neither library was needed and both were removed (SPEC-M17 Motion); React 19.3.1 and the font Eczar were added.
  - One pass over all screens, reviewed at the end.
- **Details assumed (needs confirmation):**
  - The worker's own page keeps "नमस्ते, {name}" as its heading. It is a personal page opened from WhatsApp, and decision 4A was about the owner's Home.
  - Fonts: Mukta stays for the interface; Eczar replaces Tiro Devanagari Hindi for titles.

## Data-model differences

The brief says the code is authoritative about the data model, so record the difference and do not change the code. For each item the owner should either accept the current behaviour or ask for a spec to change it.

### DM-001 Migrations run automatically at server start
- **Status:** needs confirmation.
- **Brief §12:** "There is no automatic migration on push; migrations are applied by a human."
- **Code:** every server start runs `CREATE TABLE IF NOT EXISTS …` and `ALTER TABLE units ADD COLUMN IF NOT EXISTS short_code` (`server/db.mjs:26-41`).
  - These only add tables and columns.
  - `PG_RESET=1` drops a schema, but the code refuses to do that on `public` (`server/db.mjs:19`).
- **Options:** (a) accept it, and document in `docs/DEPLOY.md` that schema changes apply on deploy; (b) move schema changes into a separate migration command that a person runs.

### DM-002 The photo store overwrites an existing photo id
- **Status:** resolved 2026-11-02 by SPEC-M16 §6 (user goal), option (a).
  - The first unit to store an id owns it.
  - Another unit's upload of that id → 409 `photo_id_taken`, and nothing changes.
  - The same unit re-sending the same bytes → 200; different bytes → 409 `photo_exists`.
  - The app marks a 409 photo rejected and stops retrying (`server/db.mjs` `putPhoto`, `server/test/integrity.test.mjs` AC6).
- **Brief §6.2:** "Nothing is silently changed."
- **Code:** `putPhoto` is `INSERT … ON CONFLICT (id) DO UPDATE SET unit_id, mime, bytes` (`server/db.mjs:187`).
  - Uploading an existing id again replaces the photo's bytes.
  - An upload from another unit moves the photo to that unit. The original unit then gets 404 for it (probe P5 in `docs/audit.md` §16).
- **Options:** (a) refuse a second upload of an id with different bytes, and never change `unit_id`; (b) keep it as is. This is fix-list item P1 7a in the audit. It matters more once each catalogue carpet can have four photos.

### DM-003 The stored `wage_payment.snapshot` is not used for a paid month's lines
- **Status:** resolved 2026-11-02 by SPEC-M16 §1 (user goal), option (a).
  - New payments save `workingDays`, `perDayPaise`, `absentDeductPaise`, `halfDeductPaise`, `otRatePaise` and `advanceOutstandingPaise` in the snapshot.
  - `paidView()` (`app/src/domain/wage.ts`) builds every paid-month view from the payment alone: pay screen, WhatsApp slip text, worker page, and the wage sheet and export rows.
  - Payments made before this change show base salary and one combined attendance deduction, taken from the stored record.
  - The description below is the state before the fix.
- **Brief 8.4:** "Paid history comes from the stored wage_payment snapshot. Never recompute a paid month from current rates."
- **Code:**
  - The totals of a paid month come from the stored payment.
  - The pay screen's line items (base salary, absence and half-day deductions, days × rate, overtime) are rebuilt from today's attendance and rates (`app/src/features/wages/WagePayPage.tsx:50-51,81-88`).
  - The month report and Excel export take P/H/A from live attendance (`app/src/features/month/export.ts:33`).
  - The snapshot written at `WagePayPage.tsx:75` is read only by the worker's own page (`app/src/worker/WorkerHomePage.tsx:150`).
  - The snapshot does not store W, so the absence-deduction lines cannot be rebuilt exactly after W changes.
- **Options:** (a) build every paid-month view, the slip sections (D-003) and the override history (D-004) from the stored payment plus a fuller snapshot that also holds W, paid off days, the off-day policy and the rate; (b) keep it as is. This is fix-list item P0 3a in the audit.

### DM-004 Finished carpets: catalogue only for new ones, old items kept as legacy
- **Status:** decided by owner (2026-11-02).
- **Code today:**
  - Finished carpets are `item` records with `kind: 'finished'`, added with `finished_in` and delivered with `delivery.finishedItemId` (`app/src/db/types.ts`, `app/src/features/stock/StockMovePage.tsx`, `app/src/features/orders/OrderDetailPage.tsx:53`).
  - Items have no design, size, photo or price fields.
- **Decision:**
  - The catalogue (D-006) is the one place for new finished carpets.
  - Once the catalogue exists, the stock item form no longer offers the "finished" kind; new items are raw materials.
  - Existing finished items keep working: their balance, ledger and history stay, and they can still be delivered from and receive finished-in entries. They are labelled **legacy** wherever they appear (stock list, item page, delivery picker).
  - No automatic migration and nothing deleted. The owner can re-enter carpets in the catalogue if they want.
- **Details assumed (needs confirmation):** the Hindi label for "legacy" is "पुराना" (to be proofread).
- **Built 2026-11-02:** the item form offers only raw materials; old finished items show "पुराना" on the stock list, the item page, its edit form and the order's "from stock" picker; the stock screen's finished section links to the catalogue.
