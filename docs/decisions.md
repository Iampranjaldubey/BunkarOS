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
  - No separate "who operates this unit" switch. A unit with no operator login is operated by the owner. A unit may have more than one operator, as today.
  - "Calculations are suggestions" applies to wage figures for now (D-004). Stock balances and order counts are sums of entries; they are corrected with entries (adjustment, reversal), not overridden.

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
| Rounding | off |
| Owner changes (overridden lines with their reason, D-004) | off |
| Advance balance after this payment | off |
| Payment date and mode (cash or UPI) | off |

- **Details assumed (needs confirmation):**
  - Business name, worker name, month and net pay cannot be switched off; a slip without them is not a slip.
  - The slip is built from the stored payment record, not from today's rates or attendance (see DM-003).
  - Net pay is the amount handed over: net rounded to ₹1. With the rounding section off, gross − advance − deductions can differ from net pay by up to 50 paise.
  - "₹0" is printed when there are no deductions.
  - The WhatsApp slip text uses the same sections as the printed slip, so the worker gets the same content both ways.

### D-004 Owner override on wage lines
- **Status:** decided by owner (2026-11-01).
- **Decision:**
  - On the pay screen, the owner can change the amount of any calculated wage line. A reason is required.
  - The change is written to the history: computed amount, new amount, reason, who and when.
- **Details assumed (needs confirmation):**
  - **Lines that can be overridden:** base salary, absence deduction, half-day deduction, days × rate, paid off days, pieces, overtime, advance recovered and rounding.
  - **When:** overrides are made before the payment is confirmed. To change a paid month, the owner reverses the payment with a reason and pays again, as today.
  - **What is stored:** the `wage_payment` record gets `overrides: [{line, computedPaise, finalPaise, reason}]`. Its totals are the final amounts, and the snapshot keeps the computed inputs.
  - **Who:** only the owner can override. The server refuses a payment with overrides from anyone else (`forbidden_override`) and refuses an empty reason.
  - Operators can still lower the advance recovery up to the cap without a reason, as today. That is a choice on the pay screen, not an override.
  - An override can never make net pay negative (client and server).
  - The entry log shows each override. The worker's own page marks overridden lines as "changed by owner".
  - Overrides apply to that one payment. They never change the worker's rates.

### D-005 Operator permissions
- **Status:** decided by owner (2026-11-01).
- **Decision:** five owner-only toggles. The defaults match what staff can do today.

| Toggle | Default | Today's behaviour it keeps |
|---|---|---|
| Add entries | on | Staff add attendance, advances, payments, stock, orders, workers and items |
| Edit past entries | off | Staff can only undo their own entries from the same day |
| See wages | on | Staff open the wage sheet, pay page and month report |
| See prices | on | Staff see order prices, stock-in rates and catalogue prices |
| Export | off | Only the owner exports |

- **Always owner-only (no toggle):** settings, logins, pay rates, locking and unlocking months, and wage overrides (D-004).
- **Details assumed (needs confirmation):**
  - The toggles apply to every operator of the unit, not to each operator separately.
  - **Add entries off:** the operator can look but not enter anything. The server refuses their writes (`forbidden_permission`). This could also be the read-only faculty viewer (brief P1-9).
  - **Edit past entries on:** the operator may correct entries by anyone, from any earlier day in an unlocked month, with a reason. Corrections are a reversal plus a new entry, as today. The same-day check uses the server's IST date, not the date on the undo (fixes audit §16 P2).
  - **Hiding means not sending.** Every record is stored on the operator's phone, so hiding a value on screen is not enough. With "See wages" or "See prices" off, the server leaves the hidden values out of what it sends to an operator, as it already does for PIN hashes (SPEC-M11).
    - Hidden with "See wages" off: payments, advances, worker pay fields and piece rates.
    - Hidden with "See prices" off: order prices, stock-in rates and catalogue cost and selling prices.
    - When the operator edits a record without those values, the server copies the stored ones.
    - A phone that already holds data from before the change keeps it until it is cleared. The app clears hidden data on the next sync.
  - **See wages off:** the operator can still mark attendance and enter piece counts. The piece rate comes from the worker's stored rate. They cannot give advances or pay wages, because those screens show balances and amounts.
  - **Export:** a screen-only control. The export runs in the browser, so the server cannot enforce it beyond what it sends.
  - Home money tiles (wages due, advances) stay owner-only, as today, whatever "See wages" says.

## New module

### D-006 Finished carpet catalogue
- **Status:** decided by owner (2026-11-01).
- **Decision:** a catalogue of finished carpets.
  - **Each carpet:**
    - up to 4 photos, compressed
    - design name or code
    - size: length, width and unit
    - a quantity, or a unique piece tag
    - material notes
    - optional cost and selling price
    - status: in stock, reserved or delivered
    - notes
  - **Screens:** a photo grid with search and filters. A carpet can be reserved for an order and delivered from it.
  - **Prices:** the owner can hide them from operators. This is the "See prices" toggle (D-005).
  - **Not yet:** custom fields; WhatsApp cards.
- **Details assumed (needs confirmation):**
  - **Size units:** feet, metres or centimetres. Lengths are stored in whole thousandths of the unit, like other quantities.
  - **Two kinds of entry:**
    - A **unique piece** has a tag, unique within the unit, and a quantity of 1. Its status is one of the three.
    - A **quantity entry** (several carpets of one design and size) shows counts for in stock, reserved and delivered.
  - **Status comes from entries, not from an editable field:** pieces added, reserved for an order, a reservation released (reversal with a reason), delivered against an order.
  - **Delivery:** uses the existing order `delivery` record with a link to the carpet, so the order's delivered quantity and status update as today.
  - **Limits, checked in the app and on the server:** a delivery cannot exceed what is reserved plus in stock, or the order's pending quantity. A reservation cannot exceed what is in stock, or what the order still needs.
  - **No sale without an order:** a carpet leaves the catalogue only by delivery against an order.
  - **Default view:** the grid hides delivered carpets until the status filter asks for them.
  - **Permissions:**
    - Operators with "Add entries" can create carpets, reserve and deliver.
    - Editing a carpet's details follows the same rule as items today.
    - Price fields need "See prices".
  - **Photos:**
    - Same compression as other photos: JPEG, longest edge ≤ 1280 px, ≤ 300 KB.
    - Stored in Postgres and visible only with a login.
    - The first photo is the cover in the grid.
    - Four photos per carpet can grow the database quickly; watch its size (brief §12).
  - **Old finished-carpet items:** the catalogue becomes the one place for finished carpets. See DM-004.

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
- **Status:** needs confirmation.
- **Brief §6.2:** "Nothing is silently changed."
- **Code:** `putPhoto` is `INSERT … ON CONFLICT (id) DO UPDATE SET unit_id, mime, bytes` (`server/db.mjs:187`).
  - Uploading an existing id again replaces the photo's bytes.
  - An upload from another unit moves the photo to that unit. The original unit then gets 404 for it (probe P5 in `docs/audit.md` §16).
- **Options:** (a) refuse a second upload of an id with different bytes, and never change `unit_id`; (b) keep it as is. This is fix-list item P1 7a in the audit. It matters more once each catalogue carpet can have four photos.

### DM-003 The stored `wage_payment.snapshot` is not used for a paid month's lines
- **Status:** needs confirmation.
- **Brief 8.4:** "Paid history comes from the stored wage_payment snapshot. Never recompute a paid month from current rates."
- **Code:**
  - The totals of a paid month come from the stored payment.
  - The pay screen's line items (base salary, absence and half-day deductions, days × rate, overtime) are rebuilt from today's attendance and rates (`app/src/features/wages/WagePayPage.tsx:50-51,81-88`).
  - The month report and Excel export take P/H/A from live attendance (`app/src/features/month/export.ts:33`).
  - The snapshot written at `WagePayPage.tsx:75` is read only by the worker's own page (`app/src/worker/WorkerHomePage.tsx:150`).
  - The snapshot does not store W, so the absence-deduction lines cannot be rebuilt exactly after W changes.
- **Options:** (a) build every paid-month view, the slip sections (D-003) and the override history (D-004) from the stored payment plus a fuller snapshot that also holds W, paid off days, the off-day policy and the rate; (b) keep it as is. This is fix-list item P0 3a in the audit.

### DM-004 Finished carpets live in two places once the catalogue exists
- **Status:** needs confirmation.
- **Code today:**
  - Finished carpets are `item` records with `kind: 'finished'`, added with `finished_in` and delivered with `delivery.finishedItemId` (`app/src/db/types.ts`, `app/src/features/stock/StockMovePage.tsx`, `app/src/features/orders/OrderDetailPage.tsx:53`).
  - Items have no design, size, photo or price fields.
- **Proposal:**
  - The catalogue (D-006) becomes the one place for finished carpets.
  - The stock screen keeps raw materials; its finished-carpet section links to the catalogue.
  - Existing finished items and their history stay readable, and can still be delivered from.
  - The owner re-enters them in the catalogue. There is no automatic migration; nothing is deleted.
- **Options:** (a) as proposed; (b) extend `item` with the catalogue fields instead of adding new record types; (c) migrate existing finished items into catalogue entries automatically.
