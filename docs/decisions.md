# Decisions

Product and data-model decisions for Bunkar / CarpetOps. The product brief (`.kiro/steering/product.md`) asks for every difference between the brief and the code to be recorded here.

Status values:
- **Decided by owner**: binding; implement as written.
- **Needs confirmation**: what the code does today, or a detail the agent had to assume. The owner has not confirmed it.

## Owner decisions

### D-001 Overtime is an owner setting, off by default
- **Status:** decided by owner (2026-11-01).
- **Replaces:** brief 8.2 ("Hide overtime fields and make the default overtime rate zero") and SPECS.md D2 / D12 (overtime always on).
- **Decision:** an owner-only unit setting "Overtime enabled" (`setting.overtimeEnabled`), **off** by default.
  - When it is off, overtime is hidden on every screen: worker form, attendance, wage sheet, pay page, slip, month report, Excel export and the worker's own page.
  - When it is off, new workers get an overtime rate of ₹0.
  - The overtime code stays.
- **Details assumed (needs confirmation):**
  - While the setting is off, overtime hours already recorded stay in the data but are not added to new payments. Turning the setting on shows and pays them again. Payments already made keep the overtime they stored.
  - When the setting is on, the default rate stays as today: monthly salary ÷ W ÷ 8, daily rate ÷ 8, piece-rate ₹0.
  - Units created before the setting existed start with it off.

### D-002 Daily-rate workers are paid for Sundays and holidays
- **Status:** decided by owner (2026-11-01). **Provisional business rule:** confirm with design partners before they rely on it.
- **Replaces:** the brief's 8.3 provisional design and its two open questions, and the daily formula in SPECS.md D2 and M02 (present days × rate only).
- **Decision:**
  - A daily-rate worker gets one paid day for each Sunday and for each holiday on the unit's list, if it falls on or after their joining date.
  - They do not get it if they were explicitly marked Absent that day.
  - Piece-rate workers get nothing for off days.
  - Monthly workers are unaffected.
- **Answers the brief's open questions:**
  - Workers who join mid-month count off days from their joining date only.
  - Absences on the days around an off day do not remove it. Only an Absent mark on the off day itself does.
- **Details assumed (needs confirmation):**
  - A Present or Half mark on a Sunday or holiday is counted once, as that one paid day, not twice. (The brief's interim workaround tells partners to mark daily workers Present on Sundays. Those marks will not double the pay.)
  - An Absent mark by anyone who may mark attendance (owner or munshi) removes the paid day, not only the owner's.
  - A holiday that falls on a Sunday counts once.
  - All off days of the month count, including ones after today, so the current month's expected pay already includes the Sundays still to come.

### D-003 The printed wage slip is a short A4 page
- **Status:** decided by owner (2026-11-01).
- **Replaces:** the "printable slip view" in SPECS.md M02 (today the screen page is printed) and the brief's 8.4 slip status.
- **Decision:**
  - Printing a paid month produces a real A4 page showing only these:
    - business name
    - worker name
    - month
    - gross, including for monthly workers
    - advance recovered
    - deductions
    - net pay
    - a signature line
  - The detailed breakdown stays on the pay screen and on the worker's own page.
- **Details assumed (needs confirmation):**
  - Gross on the slip = gross pay + overtime. Overtime is ₹0 while the D-001 setting is off.
  - Net pay = the amount handed over (`paidPaise`, which is net rounded to ₹1). The rounding (at most 50 paise) is not printed, so gross − advance − deductions can differ from net pay by up to 50 paise. Alternatives: add a rounding line, or print whole rupees only.
  - Each deduction is printed with its label. "₹0" is printed when there are none.
  - The slip is built from the stored payment record, not from today's rates or attendance (see DM-003).
  - The WhatsApp slip text is not covered by this decision. It still lists the detailed lines, without overtime while the setting is off. Should it match the printed slip?

## Data-model differences (from docs/audit.md §15)

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
- **Options:** (a) refuse a second upload of an id with different bytes, and never change `unit_id`; (b) keep it as is. This is fix-list item P1 7a in the audit.

### DM-003 The stored `wage_payment.snapshot` is not used for a paid month's lines
- **Status:** needs confirmation.
- **Brief 8.4:** "Paid history comes from the stored wage_payment snapshot. Never recompute a paid month from current rates."
- **Code:**
  - The totals of a paid month come from the stored payment.
  - The pay screen's line items (base salary, absence and half-day deductions, days × rate, overtime) are rebuilt from today's attendance and rates (`app/src/features/wages/WagePayPage.tsx:50-51,81-88`).
  - The month report and Excel export take P/H/A from live attendance (`app/src/features/month/export.ts:33`).
  - The snapshot written at `WagePayPage.tsx:75` is read only by the worker's own page (`app/src/worker/WorkerHomePage.tsx:150`).
  - The snapshot does not store W, so the absence-deduction lines cannot be rebuilt exactly after W changes.
- **Options:** (a) build every paid-month view, and the A4 slip (D-003), from the stored payment plus a fuller snapshot; (b) keep it as is. This is fix-list item P0 3a in the audit.
