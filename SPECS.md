# Bunkar MVP — Specs (Phase 2)

Fresh build for the Sitare Phase 2 pilot: **attendance, wages, inventory, orders, monthly analysis**
for owner + munshi at in-unit carpet shops in Bhadohi. Source of decisions: Phase 1 submission
(16/09/2026), Phase 2 MVP plan, and the user's MCQ answers on 2026-10-23.

Status legend: Draft | Approved | Built.

## Decisions (user, 2026-10-23)
| # | Topic | Decision |
|---|---|---|
| D1 | Start point | Fresh codebase beside BunkarOS. Copy by hand only: PIN hashing, session store, unit/auth/token server modules, sync client pattern, i18n loader, UI kit primitives, index.css. Nothing about looms, thekedars, pieces, tauli, voice, exporter. |
| D2 | Pay types | Weavers are mostly **monthly salaried**. Worker pay type ∈ {monthly, daily, piece}. Monthly: salary − (absent days × salary ÷ working days) − (half days × ½ that). Daily: (present days + paid off days) × rate (+ ½ rate for a half day). **Paid off days** follow the unit's **off-day policy** setting (`none`, `sundays`, or `sundays_and_holidays`, default `sundays_and_holidays`, a **provisional** default; owner 2026-11-01, `docs/decisions.md` D-002, SPEC-M13): each chosen day on or after the joining date, unless the worker is marked Absent that day. Piece: Σ piece entries × rate; nothing for off days. Overtime is added to any pay type only when the unit turns it on (D12). Every calculated line is a suggestion the owner can override with a reason (D15, SPEC-M14). ("Mixed" is out.) |
| D3 | Pay cycle | Monthly settlement per calendar month. Advances (kharcha/peshgi) recorded any day, deducted at settlement; balance carries forward. A paid month is **locked**. |
| D4 | Connectivity | **Offline-first PWA** (IndexedDB queue + service worker), sync when online. Server wins. |
| D5 | Hosting | Render (or Railway): one Node web service + managed Postgres. Local dev + tests on Docker Postgres. |
| D6 | Inventory | Raw materials (wool, yarn, dye…) with unit kg/pcs/litre/metre; purchase in, issue out, adjustment with reason, live balance, low-stock flag. Finished carpets counted by design+size, moved out on delivery. |
| D7 | Orders | Order-level: buyer, design, size, qty, due date, optional price, notes. Status New → In production → Finished → Delivered; partial delivery by qty. No per-carpet/loom records. |
| D8 | Photos | Photos allowed on **any** entry (stock, advance, payment, order note); mandatory above an owner-set amount (default ₹2,000). Stored as compressed JPEG ≤ 1280 px in Postgres `bytea` (≤ 300 KB each); move to object storage only if it grows. |
| D9 | Data load | Munshi types masters in on day one via the normal screens (no import tool). Screens must make 30 workers + 20 items + 10 orders keyable in under an hour: minimal required fields, "save & add another". |
| D10 | Git | Separate local repo in `bunkar-mvp/`; remote = github.com/Iampranjaldubey/BunkarOS, pushed as branch **`mvp`** (unrelated history). Push only on explicit "yes". |
| D11 | Language | **Three** choices, switchable on setup, login and in the header, remembered per device: हिंदी (Devanagari), **Hinglish** (Hindi in Roman script with everyday English words, e.g. "Aaj ki attendance", "Stock kam hai"), English. Hindi is the default. |
| D12 | Working days, overtime | Owner setting `workingDaysPerMonth` (default 26) drives per-day deduction. **Overtime is optional** (owner 2026-11-01, `docs/decisions.md` D-001): owner-only setting `overtimeEnabled`, default **off**. When on, overtime is entered in **hours** and each worker has an `otRatePaise` per hour (default salary ÷ working days ÷ 8; daily rate ÷ 8). When off, overtime is hidden on every screen (worker form, attendance, wage sheet, pay page, slip, month report, Excel export, worker page), new workers get `otRatePaise` 0, and recorded overtime is not added to new payments (assumed, needs confirmation); the code and stored hours stay. Every other mention of overtime in these specs (M01, M02, M05, M07, M12) applies only while it is on. |
| D14 | UI quality (user, 2026-10-23) | "One of the best UI": a fresh palette (deep teal primary, warm off-white background, amber accent, coral = given out, green = received), 8-pt spacing, big tabular numerals, status always colour + icon + label, warm empty states, skeleton loading, 48 px tap targets, visible focus, AA contrast verified by script. **Responsive from day one**: phone (360–430), tablet (768+, two-column forms), desktop (1024+, side navigation, real tables, sticky summaries). No separate desktop pass later. |
| D13 | Usage evidence | Pilot pass thresholds need "entries per working day" and "owner opened the log". Entries/day are computed from records; owner opens of `/log` and `/` are stored as `usage` records (excluded from all business projections, visible to the team only). |
| D15 | Product direction (owner, 2026-11-01) | A **digital register** for carpet units: attendance, workers, wages, orders and inventory, including a finished carpet catalogue. The **owner sees and edits everything**. The unit decides who operates it: the owner alone, or one or more **operators** (the `staff` role in the code, usually the munshi) whose permissions the owner sets (SPEC-M13). **Calculations are suggestions**: the owner can override any wage line before payment with a reason that is written to the history (SPEC-M14). Hidden values are removed by the server, never only on screen (SPEC-M13). **Rules are per-unit settings with sensible defaults**, not hard-coded decisions: overtime (D12), off-day policy (D2), slip sections (SPEC-M02), operator permissions (SPEC-M13). Not yet: custom fields, WhatsApp cards. Details: `docs/decisions.md` P-000, D-001…D-006. |

## Index
| ID | Title | Status |
|---|---|---|
| SPEC-M00 | Foundation: shell, login, roles, entry log, offline sync, photos, i18n | Built |
| SPEC-M01 | Workers + attendance | Built |
| SPEC-M02 | Wages: advances, monthly settlement, slip, lock | Built; AC5–AC7 (2026-11-01) not built |
| SPEC-M03 | Inventory: items, in/out/adjust, finished carpets | Built |
| SPEC-M04 | Orders: buyers, orders, status, deliveries | Built |
| SPEC-M05 | Owner dashboard + monthly analysis + Excel export | Built |
| SPEC-M06 | Deploy: Docker Postgres locally, Render in prod | Built |
| SPEC-M07 | Worker page: WhatsApp link + shop-code fallback, stays signed in | Built |
| SPEC-M08 | UI polish pass + one-year logins | Built |
| SPEC-M09 | Platform admin: founders see every unit, its users, workers and details (read-only) | Approved (user 2026-10-23) |
| SPEC-M10 | Gaps: holidays editor, orders sheet in the Excel export, TASKS status | Approved (user goal 2026-11-01) |
| SPEC-M11 | Security: PIN hashes never leave the server; photos need a user login | Approved (user goal 2026-11-01) |
| SPEC-M12 | Desktop-first UI/UX (phone keeps working) | Approved (user goal 2026-11-01) |
| SPEC-M13 | Unit rules as settings (overtime, off-day policy, slip sections) + operator permissions | Approved (owner 2026-11-01/02). Stage 1: see prices (server-side) now; "see wages" is a later stage |
| SPEC-M14 | Owner override on any wage line before payment, with a reason; logged correction of a paid month | Approved (owner 2026-11-01/02) |
| SPEC-M15 | Finished carpet catalogue: photos, design, size, piece tag or quantity, prices, reserve, deliver, sell directly, write off | Approved (owner 2026-11-01/02) |
| SPEC-M16 | Server integrity (locked-month reversals, wage amounts, stock below zero, same-day undo, photo ids) + paid month from the saved payment | Approved (user goal 2026-11-02) |

---

### SPEC-M00 — Foundation
- **Goal**: Owner creates a unit, adds staff, everyone logs in by PIN on their phone; every write is an append-only record with who/when/device; works offline; Hindi/English.
- **Users**: owner, staff (munshi). No weaver/buyer logins.
- **Data model** (`src/db/types.ts`): `Rec<P>` {id, type, unitId, payload, by, role, device, at, day, sync, serverSeq?, rejectReason?, photoIds?}. Masters versioned by `payload.entityId` (latest `at` wins; old versions kept = "edited by, when"). Events corrected by `reversal{targetId, reason}` + a new record (the UI shows "edited by X at T" on the new one and "old value" on the log).
  - `user` {entityId, name, phone, role owner|staff, pinHash, pinSalt, active}
  - `setting` {entityId:'unit', unitName, ownerPhone, lang, workingDaysPerMonth=26, photoRequiredAbovePaise=200000, currency 'INR'}
  - `usage` {screen, at} (D13)
- **Roles** (`can(role, action)`): staff can create everything and reverse own records of the same day; only owner edits settings, users, pay rates, locks a month, reverses anything, views `/log` filter by user, exports. Since D15 staff are called **operators**; what they may do is set by the owner's toggles (SPEC-M13), whose defaults are exactly these limits.
- **Offline**: Dexie tables `records`, `photos`, `meta`; `addRecord` stamps author/device/day; sync client pushes pending every 30 s + on online, pulls by cursor, marks rejected with reason; header badge pending/synced/offline.
- **Server** (`server/`, Node 24 + `pg`): `POST /api/units` (create/join by unitId + key), `POST /api/auth/token` (PIN verify, HMAC token 30 d), `POST /api/sync`, `PUT/GET /api/photos/:id` (≤ 300 KB JPEG, bytea), `GET /api/health`. Rules: records immutable + idempotent by id; `setting`/`user`/`worker` pay fields/`period_lock` only from owner; second `wage_payment` for the same worker+month rejected; any record dated inside a locked month rejected (`period_locked`).
- **Backdating**: every entry screen has a date field defaulting to today; staff may pick any unlocked past date (D-plan "backdated entries"). `day` = chosen date; `at` = real time (the log shows both).
- **Acceptance**: AC1 setup → login owner → add staff → staff logs in on a second browser context. AC2 record saved offline appears pending, syncs to 0 when online, survives reload. AC3 a staff reversal of yesterday's record is refused; owner's is accepted; `/log` shows old + new with author and time. AC4 Hindi default; EN toggle persists.

### SPEC-M01 — Workers + attendance
- **Goal**: one fast screen marks today's attendance for all workers; worker passbook shows days, advances, dues.
- **Data**: `worker` {entityId, name, phone?, jobTitle (weaver|finisher|helper|other), payType monthly|daily|piece, salaryPaise?, dailyRatePaise?, pieceRatePaise?, otRatePaise, joinedOn, active, photoId?}. `attendance` {workerId, day, status present|half|absent, otHours (0..12, step 0.5), note?}. `piece_entry` {workerId, day, count, pieceRatePaise, note?}.
- **Rules**: one active attendance per worker+day — a second one for the same day replaces the first (first is auto-reversed with reason 'edited', shown in log). Default status for an unmarked day = **unmarked** (not absent); the month view shows unmarked days so the owner sees gaps. Sunday/holiday: owner marks the day `holiday` in settings (per-unit list) → excluded from working days for deduction.
- **Screens**: `/attendance` (date picker, list of active workers, 3 big toggles P/½/A + OT hours stepper, "all present" shortcut, saves per tap, pending badge); `/workers` (list, search, active filter); `/workers/new`, `/workers/:id` (edit = new version; passbook: this month's days, OT, advances, last payment, balance).
- **Acceptance**: AC1 mark 3 workers P/½/A + 2 h OT → month summary shows 1 present, 0.5, 1 absent, OT 2. AC2 re-marking a day replaces and logs "edited by". AC3 inactive workers hidden from attendance but kept in history.

### SPEC-M02 — Wages
- **Goal**: compute each worker's month from attendance/pieces, net advances, pay, slip, lock.
- **Data**: `advance` {workerId, day, amountPaise, mode cash|upi, note?, photoIds?}. `wage_payment` {workerId, month 'YYYY-MM', grossPaise, otPaise, deductionLines[{label, amountPaise}], advanceRecoveredPaise, netPaise, paidPaise, mode, day, note?, photoIds?}. `period_lock` {month, lockedAt, by}. Unit settings used here (owner only, SPEC-M13): `overtimeEnabled` (default false; D12), `offDayPolicy` (default `sundays_and_holidays`; D2), `slipSections` (default below). Owner overrides: SPEC-M14.
- **Formulas** (`domain/wage.ts`, integer paise):
  - working days W = settings.workingDaysPerMonth (holidays do not reduce W; W is the divisor only).
  - monthly: perDay = round(salary ÷ W); gross = salary − absent×perDay − half×round(perDay÷2). Sundays and holidays change nothing.
  - daily: offDays = the days chosen by `offDayPolicy` (`none` → no days; `sundays` → Sundays; `sundays_and_holidays` → Sundays + listed holidays) in the month, on or after joinedOn, minus those marked absent. A holiday on a Sunday counts once; a present or half mark on an off day is not counted again (assumed, needs confirmation). gross = (present + offDays)×rate + half×round(rate÷2). Default policy is **provisional** (D2; `docs/decisions.md` D-002).
  - piece: gross = Σ count×pieceRate (nothing for off days).
  - ot = round(otHours × otRate) when `overtimeEnabled`, else 0. net = gross + ot − Σ deductions − advanceRecovered. paid = net rounded to ₹1 (half-up; rounding shown on the pay screen).
  - advanceRecovered default = min(outstanding advances, max(0, gross+ot−deductions)); staff may lower it; balance carries.
- **Screens**: `/advances/new` (worker, amount, mode, photo if > limit); `/wages` (month picker; table: worker, P/½/A, OT (only when overtime is on), gross, advances, net, paid/pending; totals; "Lock month" owner-only when all paid or explicitly); `/wages/:month/:workerId` (detailed breakdown, including paid off days for daily workers, editable deduction lines, recovery amount, pay → `wage_payment`, then **preview-and-confirm** WhatsApp slip text via wa.me). **Printed slip** (paid months only, `docs/decisions.md` D-003): one A4 page built from the stored `wage_payment`, showing the sections switched on in `slipSections`. Fixed list of sections: business name, worker name, month, gross (gross pay + overtime, also for monthly workers), advance recovered, deductions, net pay, signature line (these 8 on by default) and attendance summary, paid off days, pieces, overtime (only while overtime is on), rate, rounding, owner changes, advance balance, payment date and mode (off by default). Business name, worker name, month and net pay cannot be switched off (assumed). The WhatsApp slip text uses the same sections (assumed). The detailed breakdown stays on the pay screen and the worker page.
- **Rules**: one payment per worker+month (server rejects duplicates); any attendance/advance/payment dated in a locked month is rejected client + server; unlock = owner-only reversal of the lock, logged with a reason; changing a paid month follows SPEC-M14 (unlock, reverse the payment, pay again, lock again, each with a reason).
- **Acceptance**: AC1 (overtime on) salary ₹12,000, W=26, 2 absent, 1 half, 3 h OT at ₹58/h → gross 12,000−923−231=10,846; ot 174; net 11,020 with ₹1,000 advance → 10,020 paid. AC2 second payment same month rejected. AC3 locked month refuses new attendance with a Hindi message. AC4 WhatsApp slip text shows the switched-on slip sections; share only after preview. AC5 (inputs and values: `docs/wage-examples.md` Example A) overtime off (the default): worker form, attendance, wage sheet, pay page, slip, month report, export and worker page show no overtime; a new worker's `otRatePaise` is 0; the AC1 worker without the OT line → paid ₹9,846. AC6 (`docs/wage-examples.md` Example B) daily ₹400, month 2026-11 (Sundays 1, 8, 15, 22, 29), holiday 2026-11-09, joined 2026-11-05, 18 present, 1 half, marked absent on 22 Nov → paid off days 8, 9, 15, 29 = 4 → gross (18 + 4) × 400 + 200 = ₹9,000; the same marks add nothing for a piece-rate worker; a monthly worker's pay is unchanged. AC7 with default `slipSections` the printed slip fits one A4 page with exactly business name, worker name, month, gross, advance recovered, deductions, net pay and a signature line; a monthly worker's slip shows a gross line; no attendance, piece or overtime lines. AC8 (`docs/wage-examples.md` Example B) `offDayPolicy` with the AC6 marks: `none` → gross ₹7,400; `sundays` → off days 8, 15, 29 → ₹8,600; `sundays_and_holidays` → ₹9,000. AC9 the owner switches on "attendance summary" and switches off "signature line" → the next printed slip shows the summary and no signature line; the setting change is in the entry log.

### SPEC-M03 — Inventory
- **Data**: `item` {entityId, name, kind raw|finished, unit kg|pcs|litre|metre, lowStockQty, active}. Quantities in **integer thousandths** (grams for kg; pcs×1000) to avoid float. `stock_in` {itemId, day, qty, ratePaise?, supplier?, note?, photoIds?}. `stock_out` {itemId, day, qty, purpose production|sale|other, workerId?, orderId?, note?}. `stock_adjust` {itemId, day, qtyDelta (±), reason wastage|count_correction|damage|other, note, photoIds?}. `finished_in` {itemId (kind finished), day, qty, orderId?}.
- **Projections**: `stockBalance(recs, itemId, asOfDay)`; `stockLedger(item, month)` opening/in/out/adjust/closing; `lowStock(recs)`; `finishedStock(recs)` by design+size with order link.
- **Screens**: `/stock` (items with balance, low-stock badge, finished section), `/stock/new` (item), `/stock/:itemId` (ledger), `/stock/in`, `/stock/out`, `/stock/adjust` (reason required, photo required for adjustments above limit value or always for wastage — owner setting).
- **Rules**: out/adjust that would take balance below 0 is blocked inline (owner may override with reason, logged). Finished carpets decrease on `delivery` (M04).
- **Finished carpets** (D15, owner decision DM-004 2026-11-02): the catalogue (SPEC-M15) is the one place for new finished carpets. Once it exists, the item form no longer offers the "finished" kind. Existing `kind: finished` items keep their balance, ledger and history, can still receive finished-in entries and be delivered from, and are labelled legacy ("पुराना"); nothing is migrated automatically.
- **Acceptance**: AC1 in 25.000 kg, out 12.500, adjust −0.250 wastage → balance 12.250, ledger matches. AC2 low-stock at ≤ lowStockQty appears on dashboard. AC3 over-issue blocked.

### SPEC-M04 — Orders
- **Data**: `buyer` {entityId, name, phone?, city?, active}. `order` {entityId, buyerId, orderNo (auto `ORD-001`…, editable), design, size (free text e.g. 8x10), qty, dueDate, pricePaise?, notes?, receivedOn}. `order_status` {orderId, status new|in_production|finished|delivered, day, note?}. `delivery` {orderId, day, qty, note?, finishedItemId?, carpetId?} (reduces finished stock or the catalogue carpet when linked; SPEC-M15). `order_note` {orderId, text, photoIds?}.
- **Projections**: `orderView` (latest status, deliveredQty, pendingQty, overdue = dueDate < today and pending>0, dueSoon ≤ 7 days, amountPending = price×pending if price). Status auto-moves to `delivered` when deliveredQty ≥ qty.
- **Screens**: `/orders` (filter by status; overdue first), `/orders/new`, `/orders/:id` (timeline of status/notes/deliveries; buttons: start production, finished, deliver qty; WhatsApp status text with preview-and-confirm), `/buyers`.
- **Acceptance**: AC1 order 20 pcs, deliver 12 → pending 8, status stays; deliver 8 → delivered. AC2 due 3 days ago with pending → overdue on list + dashboard. AC3 status share text in Hindi via preview.

### SPEC-M05 — Dashboard + monthly analysis + export
- **Dashboard `/`** (owner; staff sees the same minus money tiles): today's attendance (marked/present/absent, link `/attendance`), wages due this month (Σ net unpaid), advances outstanding, low-stock items, orders due this week + overdue, deliveries pending, today's entries by user (usage). Every tile opens its records.
- **Monthly `/month`** (month picker): attendance sheet (worker × day grid P/½/A/OT), wage sheet (per worker gross/OT/deductions/advances/net/paid/pending + totals), stock movement (per item opening/in/out/adjust/closing), orders (received, delivered, pending, overdue, amount pending), cash out total (advances + payments by cash/UPI). Entry counts per user per working day + owner log opens (D13).
- **Export**: `.xlsx` with one sheet per table above (client-side, `exceljs` or `xlsx`), file name `BunkarMVP_<unit>_<YYYY-MM>.xlsx`; shared via the browser share sheet / download. Printable (PDF via browser print) wage slip + monthly wage sheet with print CSS.
- **Acceptance**: AC1 every dashboard number equals the corresponding projection on the seeded data. AC2 xlsx opens in Excel/LibreOffice with 5 sheets and matching totals. AC3 month with a reversed payment excludes it.

### SPEC-M06 — Deploy
- Local: `docker compose up db` (Postgres 16, port 5432), server `DATABASE_URL`, `npm run dev` for app (proxy /api). Tests: Vitest (domain + sync), `node --test` server suites against the Docker DB (ephemeral schema per run), Playwright e2e (mobile 390×844 + offline project with built PWA).
- Prod: Render **web service** (Node, `server/`, serves the built app from `app/dist` as static + `/api`), Render **Postgres** (free → starter), env `DATABASE_URL`, `BUNKAR_SECRET`, `TRUST_PROXY=1`. HTTPS by Render. One `render.yaml` blueprint in repo. Demo unit seeded by `npm run seed:demo` with a documented demo login for faculty.
- **Acceptance**: AC1 `render.yaml` deploy from branch `mvp` reaches `/api/health` 200 and the app installs as PWA on Android Chrome. AC2 a record entered offline on a phone appears in Postgres after reconnect.

### SPEC-M07 — Worker page (कारीगर का पन्ना)
- **Goal**: a worker sees their own month, pay history, advances and profile on their phone with nothing to remember. Opened once from a WhatsApp link (or shop code + name + 4-digit code), then remembered on that phone until the owner cancels it.
- **Server**: `units.short_code` (6 digits, unique, generated at unit creation; `GET /api/units/me` returns it with unit-key auth). Table `worker_links(token pk, unit_id, worker_id, created_at, revoked_at)`. `POST /api/worker-links` (owner/staff token) {workerId, regenerate?} → active token (new one revokes old). `POST /api/w/claim` {shopCode, workerId, code} (rate-limited) → checks the latest active `worker` record's `accessCode` → token. `GET /api/w/shop/:shopCode` → unit name + active worker names/ids (rate-limited). `GET /api/w/:token` → {unitName, ownerPhone, shopCode, worker, settings{workingDaysPerMonth, holidays}, records} where records = this worker's active attendance / piece_entry / advance / wage_payment + reversals + period_lock (so the same domain code computes everything in the browser). A revoked token → 410.
- **App**: public routes `/w/:token` (stores token in localStorage, → `/w`), `/w` (saved token → page; none → join screen), `/w/join` (shop code → pick name → 4-digit code). Page sections (cards, one scroll): इस महीने (P/H/A/OT, pieces, expected pay with advance deduction), पगार (months grouped by year, yearly total, tap → slip lines), एडवांस (list + outstanding), प्रोफ़ाइल (job, pay type and rate, joined; "मालिक से पूछें" → wa.me to ownerPhone with prefilled text; "यह मेरा फ़ोन नहीं है" forgets the token after confirm). Last fetched data cached in localStorage for offline viewing with a "last updated" line. Three languages; no login/logout vocabulary anywhere on this page.
- **Owner side**: `WorkerP.accessCode` (4 digits, generated on create, visible on the worker page to owner/staff, regenerable). Worker detail gets "लिंक भेजें" (creates link → PreviewShareSheet with the URL) and "लिंक रद्द करें".
- **Acceptance**: AC1 owner sends link → opening `/w/<token>` shows the worker's month with the same numbers as the owner's wage sheet; reload → still there, no prompt. AC2 join by shop code + name + code works; wrong code refused. AC3 after regenerate, the old link shows "लिंक बंद है" and the new one works. AC4 pay history lists a paid month with the slip lines and the year total.

### SPEC-M08 — UI polish + one-year logins
- Owner/staff token TTL 365 days; PIN only on first login per phone or after explicit logout.
- Home: hero header (greeting, date, shop name, one-line status), tiles with icon chips and sub-lines, "needs attention" ordering. Forms: taller inputs, sticky save bar on phones, inline success. Lists: worker photos in avatars, status chips with icons, zebra tables. Login/setup: shop-name card, role chips, larger PIN pad, step hints.
- **Acceptance**: all existing e2e stay green; phone + desktop overflow sweeps green; screenshots reviewed.

### SPEC-M09 — Platform admin (founders)
- **Goal**: Shubham and Pranjal see every unit on the server, each unit's users, workers, month, stock, orders, usage and entry log. Read-only. English UI (internal).
- **Auth**: server env `ADMIN_KEYS="shubham:<key>,pranjal:<key>"` (admin disabled when unset → 403 `admin_disabled`). `POST /api/admin/login {name, key}` (rate-limited 10/min) → HMAC token (30 d) stored in localStorage `bunkar.admin`. Admin tokens are separate from unit tokens and never grant unit writes.
- **API**: `GET /api/admin/units` → per unit: id, name, shortCode, createdAt, ownerName/phone, counts (users, workers, records), entries this month, days with entries this month, last activity. `GET /api/admin/units/:unitId` → unit + all records (pinHash/pinSalt stripped) so the browser reuses the domain projections.
- **App**: `/admin` (login when no token; else units table sorted by last activity, search, totals), `/admin/units/:unitId` (overview tiles, users, workers table incl. worker code, month: attendance summary + wage sheet, stock balances, orders, usage per user, last 50 log entries; month picker). Logout button (admins can handle it).
- **Acceptance**: AC1 wrong key → 401; no env → 403. AC2 units list shows a unit created a minute ago with its owner and worker counts. AC3 unit page shows the worker, today's entries and the month's wage sheet with the same numbers as the owner sees. AC4 an admin token cannot call `/api/sync` or `/api/worker-links`.

### SPEC-M10 — Gaps found in the 2026-11-01 analysis
- **Goal**: close three gaps between SPECS and the code.
- **Holidays editor** (`/settings`, owner only; staff sees the list read-only): card "छुट्टियाँ" under the unit card. Date input (any date, no max) + "छुट्टी जोड़ें" adds the day to `setting.holidays` (sorted, unique) by writing a new `setting` version; each holiday is a chip with the formatted date and a remove button (`aria-label` "{day} हटाएँ") that writes a new version without it. Empty state "अभी कोई छुट्टी नहीं". Hint: Sundays are always off; holidays are not counted as unmarked days and do not change the divisor W. `data-testid="holidays-card"`, chips `data-testid="holiday-<YYYY-MM-DD>"`. The attendance page already shows `att.holiday` when the picked day is a holiday (keep/verify).
- **Orders sheet**: `MonthReport.orderList` = orders with `receivedOn <= last day of month` that were not fully delivered before the month started (latest delivery day < month start and pending 0 ⇒ excluded); fields orderNo, buyer name, design, size, qty, delivered (all time up to month end), pending, dueDate, status, overdue, amountPendingPaise. Excel gets a 5th sheet `month.sheet.orders` with those columns + a bold total row (qty, delivered, pending, amount pending ₹). Sheet order: summary, attendance, wages, stock, orders.
- **TASKS.md**: M03 row → DONE with its evidence.
- **Acceptance**: AC1 owner adds 2026-11-14 → chip appears, a reload keeps it, attendance on that day shows the holiday note; remove → gone. Staff sees no add/remove buttons. AC2 export workbook has 5 sheets; the orders sheet row 2 = the order (orderNo, buyer, qty, delivered, pending) and totals match `MonthReport.orders.amountPendingPaise`. AC3 unit test for `orderList` inclusion rule (open order, delivered-this-month order included; delivered-last-month order excluded).

### SPEC-M11 — Security: PIN hashes stay on the server; photos need a user login
- **Problem** (found 2026-11-01): every `/api/sync` pull, including the token-less bootstrap pull, returns `user` records with `pinHash`/`pinSalt`. Anyone holding the unit key (any staff phone) can brute-force a 4-digit PIN offline in minutes (10 000 × PBKDF2-100k), including the owner's PIN, and then sign as the owner. Photos (`PUT/GET /api/photos/:id`) need only the unit key.
- **Server**:
  - Pull (`/api/sync` records, both bootstrap and authenticated) strips `payload.pinHash` and `payload.pinSalt` from `user` records. Admin already strips (keep).
  - Push: a `user` record without `pinHash`/`pinSalt` is an edit of an existing user: the server copies both from that user's latest stored version before inserting. A `user` record for an unknown `entityId` without both fields → rejected `invalid_user`. When present they must be non-empty strings.
  - Photos: once the unit has users, `PUT` and `GET /api/photos/:id` need the unit key **and** a valid user token for that unit (`Authorization: Bearer`), else 401 `needs_login`. Bootstrap (no users yet) keeps unit-key-only.
- **App**:
  - After the server accepts a `user` record, the phone removes `pinHash`/`pinSalt` from its local copy. On start, a one-time scrub removes them from every local `synced` `user` record (`meta 'scrub.pin.v1'`). Pending user records keep them until accepted (the server needs them).
  - Login: online → the server checks the PIN (`/api/auth/token`). 200 → session + store a **device verifier** for that user only (`meta 'bunkar.pin.<userId>'` = fresh-salt PBKDF2 of the PIN). 401 → wrong PIN (counts toward the existing lockout). 429 → "बहुत ज़्यादा कोशिशें". Network failure or offline → verify against the device verifier; none → "इस फ़ोन पर पहली बार लॉगिन के लिए इंटरनेट चाहिए" (`login.needsInternet`). Unit creation stores the owner's verifier (first login works offline on the setup phone).
  - `requestToken` returns `{ok:false, reason:'wrong_pin'|'rate_limited'|'network'|'needs_login'}`.
  - Photo upload/download sends the Bearer token (records pushed by another user on a shared phone are unaffected — photos are unit-scoped).
  - `UserP.pinHash` / `pinSalt` become optional in the type.
- **Acceptance**: AC1 server test: bootstrap pull and authenticated pull return user records with no `pinHash`/`pinSalt`; `/api/auth/token` still works afterwards; a `user` edit without hash keeps login working; unknown user without hash → `invalid_user`. AC2 server test: photo GET/PUT without a token → 401 `needs_login`; with token → 200. AC3 unit test: after an accepted push the local user record has no hash; the start-up scrub removes hashes from synced user records and keeps them on pending ones. AC4 unit test: login online wrong PIN → `wrong_pin`; offline with no verifier → `needs_internet`; offline with verifier → ok. AC5 e2e 01 (setup → staff login on a second context) and the full suite stay green.

### SPEC-M12 — Desktop-first UI/UX (phone keeps working)
- **Goal** (user goal 2026-11-01): the owner and munshi mostly work on a laptop or desktop; design for that first, while phones keep today's layout and pass the same tests. Found in the 2026-11-01 screenshot review (`docs/screenshots/m12/before/`): desktop is the phone layout stretched — attendance is 3 cards per row with no keyboard, the log is 300 tall cards, home leaves half the screen empty, the top bar only shows the user's name, the side menu has no logout or quick entry and cannot collapse.
- **Layout contract** (breakpoint `lg` = 1024 px, `useIsDesktop()`; below it the phone/tablet markup is unchanged):
  - Shell ≥ lg: left side menu 256 px (collapsible to a 76 px icon rail; choice remembered in `localStorage 'bunkar.nav.collapsed'`), top bar with today's IST date on the left and sync badge + language on the right, content up to 1408 px wide (`max-w-[88rem]`, 32 px side padding). Forms keep their own narrow width.
  - Side menu: brand block (logo + unit name + role), a **"नई एंट्री"** button that opens a menu of quick entries filtered by `can()` (attendance, advance, stock in, stock out, new order, new worker), the existing two groups of links, and a footer with the user's name, role and **logout**. Collapsed: icons only, every link keeps an accessible name and a tooltip (`title`).
  - Below lg: bottom bar + "More" page exactly as today.
- **Screens (≥ lg)**:
  - **Attendance**: a roll-call table (`data-testid="attendance-table"`): worker (photo, name, job), P / H / A as one radio group with full labels, OT stepper, pieces (piece-rate workers), status chip. Toolbar: previous / next day, date input, "आज", filter "सिर्फ़ बाकी" (unmarked only), "सब हाज़िर". **Keyboard**: each row is focusable; `P`/`H`/`A` (or `1`/`2`/`3`) mark, `+`/`−` change OT by 0.5 h, `↑`/`↓` move between rows; a hint line explains it. Phones keep the cards; every P/H/A radio gets the full word as its accessible name (today phones announce "P").
  - **Entry log**: a table (when, type, what, by, undo) with filters by user and by type; reversed rows struck through with the reason under them. Phones keep the cards and get the same two filters.
  - **Home**: under the tiles, two panels — "देने वाले ऑर्डर" (overdue first, then due within 7 days; up to 6, each opens the order) and "कम स्टॉक" (item, balance, low level; each opens the item).
  - **Forms with context**: advance form shows the picked worker's balance and last 5 advances on the right; stock in/out/adjust shows the picked item's balance and last 5 moves on the right. Phones show nothing extra.
- **Quality bar**: no horizontal overflow at 1024 / 1280 / 1440 / 1920 or at 390 / 768 in all three languages; visible focus on every control; 44 px minimum targets on desktop, 48 px on phones; no new page errors; dark theme keeps working.
- **Tests**: the functional e2e specs (01–09) run in **both** projects (mobile 390×844 and desktop 1440×900); new `e2e/22-desktop-ux.spec.ts` covers keyboard attendance, the log table + type filter, quick entry menu, collapse remembered after reload, logout from the side menu, and home panels; the desktop sweep covers 1024 and 1920 too. Screenshots after the change at 390 / 768 / 1280 / 1440 in `docs/screenshots/m12/after/`.
- **Out**: command palette, global search, drag-and-drop, multi-select bulk edit, printing changes.

### SPEC-M13 — Unit rules as settings + operator permissions
- **Goal** (owner direction 2026-11-01, D15): rules that differ between units become owner settings with sensible defaults; the owner decides what operators may do. Details and assumptions: `docs/decisions.md` D-001, D-002, D-003, D-005.
- **Data** (new fields on the `setting` record; a missing field means its default, so older units keep working):
  - `overtimeEnabled`: boolean, default `false` (D12).
  - `offDayPolicy`: `none` | `sundays` | `sundays_and_holidays`, default `sundays_and_holidays` (D2).
  - `slipSections`: map of section → on/off, defaults in SPEC-M02 (D-003).
  - `operatorPerms` (stage 1): `{ addEntries: true, editPast: false, seePrices: true, export: false }` (D-005). "Operator" = the `staff` role. One set of toggles for all operators of the unit.
  - Sync responses gain `view: { seePrices: boolean }`: what the server hid for this token (owner: everything visible).
- **Screens** (`/settings`, owner edits, operators see read-only):
  - "पगार के नियम" card: overtime on/off, off-day policy (3 choices with a one-line example each), slip sections checklist with a live preview of the A4 slip.
  - "ऑपरेटर क्या कर सकते हैं" card: the 4 stage-1 toggles, each with a one-line explanation. **No "see wages" toggle** until stage 2.
  - With overtime off, every overtime field, column, line and keyboard key listed in D12 is not rendered.
- **Rules:**
  - Permission checks use the unit's `operatorPerms` in the app (`can(role, action, perms)`) and on the server.
  - **Add entries off:** the server refuses every operator write (`forbidden_permission`).
  - **Edit past entries on:** operators may reverse any record from an earlier day of an unlocked month, with a reason. **Off:** only their own records from today, where "today" is the server's IST date, not the reversal's `day` (fixes audit §16 P2).
  - **See prices off is enforced by the server, not only on screen:**
    - For an operator token, the server removes `order.pricePaise` and `carpet.costPaise` / `carpet.pricePaise` from every record it sends (pull and push echo).
    - An operator edit of an order or carpet without those fields gets the stored values copied.
    - An operator record carrying a price while the toggle is off is refused (`forbidden_price`).
    - The app hides price fields, price columns and amounts derived from prices: amount pending on order, home and month screens, and the Excel Orders amount column.
    - Stock-in rates are not covered in stage 1 (needs confirmation).
  - **Forced resync:** the device stores the `view` it last synced under (meta `sync.view`). When a sync response carries a different `view`, the device deletes every local record that is not pending, resets the pull cursor to 0 and pulls everything again, showing "डेटा नया हो रहा है" until done. Pending entries are kept and pushed. This runs when prices are hidden and when they are shown again.
  - **Export off:** export button hidden for operators (a screen-only control; the export only contains what the device holds).
  - Settings, logins, pay rates, month lock and wage overrides stay owner-only, with no toggle.
  - **Known limit:** data already on a phone cannot be taken back from a phone that never syncs again or from a modified app; the resync removes it from a normal phone at its next sync.
- **Acceptance (stage 1):**
  - AC1 a new unit has overtime off, policy `sundays_and_holidays`, the 8 default slip sections and toggles add entries on, edit past off, see prices on, export off. Settings shows those 4 toggles and no "see wages" toggle. An operator can do exactly what staff can do today, except that nobody sees overtime.
  - AC2 the owner turns overtime on → OT stepper, columns and lines appear; off → they disappear; recorded hours stay in the entry log.
  - AC3 add entries off → the operator's attendance toggles and entry buttons are disabled; a pushed operator record is refused with `forbidden_permission`.
  - AC4 edit past entries on → the operator reverses another user's entry from yesterday with a reason → accepted. Off → refused (`forbidden_reversal`), including a reversal back-dated to the target's day.
  - AC5 see prices off → the operator's pull and push echo contain no `pricePaise` on orders and no `costPaise` / `pricePaise` on carpets (server test); the operator sees no price field, price column or amount pending; the owner still sees every price.
  - AC6 see prices off → an operator changes an order's due date → the stored price is kept; an operator record that carries a price is refused with `forbidden_price`.
  - AC7 an operator phone holds order prices; the owner turns see prices off → at the operator's next sync the phone clears its synced records and pulls again; afterwards its IndexedDB holds no order or carpet price; an operator entry left pending before the change is still pushed. The owner turns it on again → the next sync brings the prices back.
  - AC8 two operators in one unit: one toggle change applies to both.
  - AC9 export off (default) → no export button for operators; on → the operator can export.
  - AC10 every settings change is a new `setting` version shown in the entry log with author and time.
- **Stage 2 (later task, not now): "See wages".** Built only together with server-side wage redaction:
  - For an operator token with the toggle off, the server removes `wage_payment` and `advance` amounts, worker pay fields (salary, daily, piece and overtime rates) and `piece_entry` rates.
  - Operator edits keep the stored values.
  - The wage and advance screens are hidden from the operator; attendance and piece counts stay.
  - Changing the toggle forces the same resync.
  - Until stage 2 is built, there is no toggle and operators see wages as today.
  - Stage 2 acceptance tests are written with that task.

### SPEC-M14 — Owner override on a wage line
- **Goal** (D15): calculations are suggestions. The owner can change any calculated wage line before paying, with a reason that is written to the history. Details and assumptions: `docs/decisions.md` D-004.
- **Data:**
  - `wage_payment.overrides?: [{ line, computedPaise, finalPaise, reason }]`, with `line` ∈ `base`, `absent_deduct`, `half_deduct`, `days`, `off_days`, `pieces`, `overtime`, `advance_recovered`, `rounding`. The payment's totals are the final amounts; `snapshot` keeps the computed inputs.
  - `wage_payment.correctionReason?`: required on a new payment when the worker already has a reversed payment for that month.
  - `period_lock.reason?`: required when the month was locked before.
- **Formulas:** each overridden line uses `finalPaise`; gross, net and paid follow SPEC-M02 with the final values. Net may never be negative. Worked example: `docs/wage-examples.md` Example C.
- **Screens:**
  - Pay page (owner only, **before the payment is confirmed**): each calculated line has "बदलें". It opens a sheet with the computed amount, the new amount and a required reason. An overridden line shows the new amount, the computed amount struck through, and the reason.
  - A paid month shows no "बदलें"; it shows the steps to change it (below).
  - Entry log: shows each override with the line, both amounts, the reason, who and when, and each correction step with its reason.
  - Worker's own page: marks overridden lines "मालिक ने बदला"; shows only the payment that is not reversed.
- **Changing a paid month:** the owner does these steps in order, each with a required reason, each written to the history:
  1. Unlock the month (if locked): a reversal of the `period_lock`.
  2. Reverse the payment. The reversed payment stays in the history.
  3. Pay again, with `correctionReason`; overrides are allowed again.
  4. Lock the month again, with `reason`.
- **Rules (app and server):**
  - The server refuses a payment with overrides that is not from the owner (`forbidden_override`), has an empty reason, names an unknown line, or would make net negative (`invalid_amounts`).
  - The server checks the arithmetic on the final amounts.
  - Overrides never change the worker's rates.
  - The server refuses to reverse a `wage_payment` whose month is locked (`period_locked`).
  - The server refuses an unlock, a re-payment or a re-lock without a reason (`reason_required`).
- **Acceptance:**
  - AC1 the SPEC-M02 AC5 worker (overtime off, ₹1,000 advance) has a computed absence deduction of ₹923.08. The owner sets it to ₹500 with reason "एक दिन की छुट्टी दी थी" → gross ₹11,269.23, paid ₹10,269. The stored payment has `overrides: [{ line: 'absent_deduct', computedPaise: 92308, finalPaise: 50000, reason }]` (exact values in `docs/wage-examples.md` Example C).
  - AC2 without a reason the override cannot be saved.
  - AC3 an operator sees no "बदलें"; an operator payment carrying overrides is refused with `forbidden_override`.
  - AC4 an override that would make net negative is refused in the app and by the server.
  - AC5 the entry log shows the override with ₹923.08 → ₹500 and the reason; the worker's page marks the line "मालिक ने बदला".
  - AC6 after the payment, the worker's salary is still ₹12,000.
  - AC7 the AC1 month is paid and locked. Reversing the payment while locked is refused (`period_locked`). The owner then:
    - unlocks with reason "पगार दोबारा देनी है";
    - reverses the payment with reason "छुट्टी का दिन ग़लत लगा";
    - pays again with correction reason "सही छुट्टी के साथ" and a new override;
    - locks again with reason "सुधार पूरा".
    The second payment is accepted because the first is reversed. The entry log shows the four steps in order with author, time and reason. The reversed payment is still listed (struck through). The worker's page shows only the new payment.
  - AC8 an unlock, a re-payment or a re-lock without a reason is refused in the app and by the server (`reason_required`).
  - AC9 a paid month's pay page shows no "बदलें".

### SPEC-M15 — Finished carpet catalogue
- **Goal** (D15): one place for new finished carpets, with photos, design and size, that the owner and operators can search, reserve for an order, deliver, sell directly or write off. Details and assumptions: `docs/decisions.md` D-006, DM-004.
- **Data:**
  - `carpet` (master, versioned by `entityId`): `design` (name or code), `lengthMilli`, `widthMilli`, `sizeUnit` `ft` | `m` | `cm`, `mode` `piece` | `quantity`, `tag?` (piece mode, unique in the unit), `materialNotes?`, `costPaise?`, `pricePaise?`, `notes?`, `photoIds` (0–4), `active`.
  - `carpet_in` {carpetId, qty}: carpets added (piece mode: exactly one, qty 1).
  - `carpet_reserve` {carpetId, orderId, qty}: carpets set aside for an order. A release is a `reversal` with a reason.
  - `carpet_out` {carpetId, qty, kind `sold` | `written_off`, note}: sold directly or written off. No order. `note` is required. The record's `day` is the date (back-dating allowed). Optional photo.
  - `delivery` (SPEC-M04) gets `carpetId?`. A delivery against an order uses that order's reservation of the carpet first, then stock.
- **Projections** (pure, tested), per carpet:
  - `added`
  - `reserved` = open reservations − deliveries made from them
  - `delivered`, `sold`, `writtenOff`
  - `inStock` = added − reserved − delivered − sold − writtenOff
  - piece status = written off / sold / delivered / reserved / in stock
  - per order: reserved and delivered from the catalogue
- **Screens:**
  - `/catalogue`: photo grid (cover = first photo), design, size, status chip with counts, selling price if allowed. Search by design, tag or notes; filters by status, size and design. Delivered, sold and written-off carpets are hidden unless the status filter includes them. Desktop: 4–6 cards per row with a filter panel. Phone: 2 per row with a filter sheet.
  - `/catalogue/new` and `/catalogue/:id/edit`: up to 4 photos, design, length × width + unit, piece tag or quantity, material notes, cost, selling price, notes, "save and add another".
  - `/catalogue/:id`: photos, details, counts, history, and these actions:
    - "ऑर्डर के लिए रखें" (order + qty)
    - "डिलीवर करें" (order + qty)
    - "सीधे बेचा" (qty, date, note)
    - "बट्टे खाते में डालें" (qty, date, note, optional photo)
    - release a reservation (reason required)
    Hindi labels to be proofread.
  - Order detail: "कैटलॉग से रखें" and "कैटलॉग से डिलीवर करें".
  - The stock screen links its finished-carpet section to the catalogue. Old finished items are labelled "पुराना" (legacy).
  - The stock item form no longer offers the "finished" kind once the catalogue exists (DM-004).
- **Rules** (app and server):
  - Piece tags are unique among the unit's active carpets (`duplicate_tag`).
  - At most 4 photos (`too_many_photos`).
  - A reservation is ≤ in stock and ≤ what the order still needs after its other reservations.
  - A delivery is ≤ reserved for that order + in stock, and ≤ the order's pending quantity.
  - Sold or written off is ≤ in stock (reserved carpets must be released first) and needs a non-empty note (`note_required`).
  - Sizes and quantities are positive; a piece is added once.
  - Prices follow "See prices", enforced by the server (SPEC-M13).
  - Edits are new versions; nothing is deleted. Corrections are reversals with a reason. Locked months refuse catalogue movements dated inside them.
  - **Legacy items (DM-004):** existing `kind: finished` items keep their balance, ledger and history, still accept `finished_in` and can still be delivered from. No automatic migration.
- **Acceptance:**
  - AC1 the owner adds quantity entry "Kashan 101", 8 × 10 ft, qty 5, 3 photos → the grid shows the cover photo and "5 in stock".
  - AC2 a fifth photo cannot be added.
  - AC3 piece tag "BH-0042" exists → a second carpet with the same tag is refused in the app and by the server.
  - AC4 order ORD-001 for 4 → reserve 3 from Kashan 101 → in stock 2, reserved 3. Reserving 2 more is refused (the order needs only 1 more).
  - AC5 deliver 2 from the reservation → reserved 1, delivered 2, order 2/4 delivered, pending 2, status unchanged. Delivering 3 more is refused (pending is 2).
  - AC6 piece "BH-0042" reserved, then delivered → status delivered; hidden from the default grid; shown when the status filter includes delivered.
  - AC7 search "kashan" and the size filter 8 × 10 find it; the "reserved" filter shows only carpets with a reservation.
  - AC8 "See prices" off → an operator sees no cost or price in the grid or detail, and their pull has no `costPaise` or `pricePaise`; the owner still sees them.
  - AC9 photos are JPEG, longest edge ≤ 1280 px, ≤ 300 KB; adding a carpet works offline and syncs later.
  - AC10 releasing a reservation with a reason puts the carpets back in stock, and the log shows it.
  - AC11 **sold directly:** Kashan 101 after AC5 (in stock 2, reserved 1) → "सीधे बेचा" qty 1, date yesterday, note "दुकान पर बेचा" → in stock 1, sold 1; no order needed; the entry log shows the sale with its date and note.
  - AC12 **written off:** → "बट्टे खाते में डालें" qty 1, note "पानी से ख़राब" → in stock 0, written off 1. Piece "BH-0043" written off → status written off, hidden from the default grid, shown with the "written off" filter.
  - AC13 **limits:**
    - Selling or writing off without a note is refused (`note_required`).
    - Selling 2 when 1 is in stock is refused.
    - Selling the reserved carpet is refused until the reservation is released.
    - Sold or written off dated inside a locked month is refused (`period_locked`).
    - Each is refused in the app and by the server.
  - AC14 reversing the sale with reason "ग़लती से दर्ज" puts the carpet back in stock (in stock +1, sold −1) and the log shows both entries.
  - AC15 **legacy:**
    - the stock item form offers no "finished" kind;
    - an existing finished item "Kashan 8x10" is shown with the "पुराना" label;
    - it keeps its balance and history;
    - it can still be delivered against an order.
- **Out:** custom fields, WhatsApp cards, barcodes or QR codes, per-carpet production tracking, price lists, sale amounts or buyers for direct sales.

### SPEC-M16 — Server integrity and paid-month display
- **Goal** (user goal 2026-11-02; audit §16 P1–P5 and DM-002, DM-003): the server refuses records that would break locked months, wage arithmetic, stock or photo ownership, and a paid month always shows what was saved.
- **1. A paid month comes from the saved payment.**
  - New payments store a fuller `snapshot`: `workingDays`, `perDayPaise`, `absentDeductPaise`, `halfDeductPaise`, `otRatePaise`, `advanceOutstandingPaise` (balance before this payment), next to the existing counts, pay type and rate.
  - A pure `paidView(payment)` builds the counts and every line only from the payment record. It is used by:
    - the pay screen (header counts, lines, paid amount, balance after);
    - the WhatsApp slip text;
    - the worker's own page (this month and pay history);
    - the paid rows of the wage sheet, month report and Excel export.
  - Older payments without the new fields show the base salary and one combined attendance deduction (rate − gross), both taken from the stored record. Nothing is recomputed from current rates or attendance.
- **2. Locked months cannot be changed by a reversal.**
  - A `reversal` is refused (`period_locked`) for everyone, including the owner, when its target is an attendance, piece, advance, payment, stock or delivery record dated in a locked month. A payment also counts as locked when its `payload.month` is locked.
  - The lock's own reversal (unlock) stays allowed; the owner unlocks first. In one push, an accepted unlock reopens the month for the records after it.
  - The entry log shows no undo button for those entries, only a lock mark.
- **3. Wage payment amounts.**
  - The server refuses a `wage_payment` with `netPaise < 0` (`negative_net`), `|roundingPaise| > 50` (`invalid_rounding`) or `paidPaise < 0` (`negative_paid`), besides the existing arithmetic check.
  - The pay screen refuses to confirm a payment whose net is below zero and says why.
- **4. Stock cannot go below zero on the server.**
  - The server keeps each item's balance: stock in + finished in − stock out ± adjustments − deliveries taken from that finished item. Reversed records do not count; records earlier in the same push count in order.
  - A `stock_out`, a negative `stock_adjust` or a `delivery` from a finished item that would take the balance below zero is refused (`insufficient_stock`). The exception is a record by the owner that carries `allowNegative: true` and a non-empty `overrideReason`.
  - App: an operator is blocked as today. The owner sees a required "माइनस में जाने की वजह" field and the record carries the flag and reason, so the override is in the history.
- **5. Same-day undo uses the server's date.** A staff reversal is accepted only for the staff member's own record whose `day` equals the server's IST date when the reversal is received. The reversal's own `day` is ignored, so back-dating an undo is refused.
- **6. Photo ids belong to one unit.**
  - The first unit to store a photo id owns it.
  - Another unit uploading the same id is refused with 409 `photo_id_taken`, and nothing changes.
  - The owning unit re-sending the same bytes gets 200 (a retry). Different bytes get 409 `photo_exists`.
  - A photo can only be read by its own unit.
  - The app marks a photo refused with 409 as rejected and stops retrying it.
- **Acceptance:**
  - AC1 the SPEC-M02 AC1 worker is paid ₹10,020, then the owner changes the salary to ₹15,000. The pay screen still shows base ₹12,000, absence ₹923.08 and paid ₹10,020, the slip text is unchanged, and the worker's page shows the same paid amount and lines (e2e 03, 07; unit test with a rate change and a later attendance mark).
  - AC2 with the month locked, the owner's and the staff's reversals of an attendance mark, an advance and the payment in that month are refused (`period_locked`). The unlock is accepted, and after it the owner's reversal is accepted (server test). The entry log shows no undo button for the locked month's entries (e2e 03).
  - AC3 server tests: net −30 with rounding +30 → `negative_net`; rounding +99 or −60 → `invalid_rounding`; net 20 with rounding −40 (paid −20) → `negative_paid`. A correct payment with rounding +50 is accepted.
  - AC4 server tests: stock out with zero stock by staff → `insufficient_stock`; by the owner without the flag → `insufficient_stock`; by the owner with flag and reason → accepted; by staff with the flag → `insufficient_stock`. In one push, in 5 kg then out 3 kg then out 3 kg → the second out is refused. Negative adjustments and deliveries from finished stock follow the same rule. e2e 04: the owner over-issues only after giving a reason.
  - AC5 server test: staff reverses their own record dated today → accepted. Their own record dated yesterday, with the reversal also dated yesterday → `forbidden_reversal`. Another user's record from today → `forbidden_reversal`.
  - AC6 server test: unit A stores photo X; unit B uploads X → 409 `photo_id_taken`; A still reads its original bytes; B reads X → 404; A re-sends the same bytes → 200; A sends other bytes → 409 `photo_exists` and the original stays. Unit test: the sync client marks a 409 photo rejected.

## Scope — Out (all modules)
Custom fields and WhatsApp cards (not yet, D15), GST/invoicing, payment gateway, subscription billing, multi-branch, AI/voice, push notifications, barcodes/QR, supplier ledger, per-carpet loom tracking, thekedar chain, tauli, exporter links, Tally export, IVR.

## Open assumptions to confirm (non-blocking; defaults applied)
A1 Overtime in hours with per-worker ₹/hour (D12). A2 Half day = ½ deduction / ½ rate. A3 ~~Finished carpets as `item` kind=finished named "<design> <size>".~~ Superseded by the catalogue (SPEC-M15). A4 Order numbers auto `ORD-nnn`. A5 Photos capped 300 KB, stored in Postgres. A6 Staff (operators) see wage amounts; a "See wages" toggle comes later, only with server-side wage redaction (SPEC-M13 stage 2); only owner can change rates.
