# Bunkar MVP — Specs (Phase 2)

Fresh build for the Sitare Phase 2 pilot: **attendance, wages, inventory, orders, monthly analysis**
for owner + munshi at in-unit carpet shops in Bhadohi. Source of decisions: Phase 1 submission
(16/09/2026), Phase 2 MVP plan, and the user's MCQ answers on 2026-10-23.

Status legend: Draft | Approved | Built.

## Decisions (user, 2026-10-23)
| # | Topic | Decision |
|---|---|---|
| D1 | Start point | Fresh codebase beside BunkarOS. Copy by hand only: PIN hashing, session store, unit/auth/token server modules, sync client pattern, i18n loader, UI kit primitives, index.css. Nothing about looms, thekedars, pieces, tauli, voice, exporter. |
| D2 | Pay types | Weavers are mostly **monthly salaried**. Worker pay type ∈ {monthly, daily, piece}. Monthly: salary − (absent days × salary ÷ working days) − (half days × ½ that) + overtime. Daily: present days × rate (+ ½ for half) + overtime. Piece: Σ piece entries × rate. ("Mixed" is out; a piece-rate worker can still get overtime.) |
| D3 | Pay cycle | Monthly settlement per calendar month. Advances (kharcha/peshgi) recorded any day, deducted at settlement; balance carries forward. A paid month is **locked**. |
| D4 | Connectivity | **Offline-first PWA** (IndexedDB queue + service worker), sync when online. Server wins. |
| D5 | Hosting | Render (or Railway): one Node web service + managed Postgres. Local dev + tests on Docker Postgres. |
| D6 | Inventory | Raw materials (wool, yarn, dye…) with unit kg/pcs/litre/metre; purchase in, issue out, adjustment with reason, live balance, low-stock flag. Finished carpets counted by design+size, moved out on delivery. |
| D7 | Orders | Order-level: buyer, design, size, qty, due date, optional price, notes. Status New → In production → Finished → Delivered; partial delivery by qty. No per-carpet/loom records. |
| D8 | Photos | Photos allowed on **any** entry (stock, advance, payment, order note); mandatory above an owner-set amount (default ₹2,000). Stored as compressed JPEG ≤ 1280 px in Postgres `bytea` (≤ 300 KB each); move to object storage only if it grows. |
| D9 | Data load | Munshi types masters in on day one via the normal screens (no import tool). Screens must make 30 workers + 20 items + 10 orders keyable in under an hour: minimal required fields, "save & add another". |
| D10 | Git | Separate local repo in `bunkar-mvp/`; remote = github.com/Iampranjaldubey/BunkarOS, pushed as branch **`mvp`** (unrelated history). Push only on explicit "yes". |
| D11 | Language | **Three** choices, switchable on setup, login and in the header, remembered per device: हिंदी (Devanagari), **Hinglish** (Hindi in Roman script with everyday English words, e.g. "Aaj ki attendance", "Stock kam hai"), English. Hindi is the default. |
| D12 | Working days | Owner setting `workingDaysPerMonth` (default 26) drives per-day deduction. Overtime is entered in **hours**; each worker has an `otRatePaise` per hour (default salary ÷ working days ÷ 8). |
| D14 | UI quality (user, 2026-10-23) | "One of the best UI": a fresh palette (deep teal primary, warm off-white background, amber accent, coral = given out, green = received), 8-pt spacing, big tabular numerals, status always colour + icon + label, warm empty states, skeleton loading, 48 px tap targets, visible focus, AA contrast verified by script. **Responsive from day one**: phone (360–430), tablet (768+, two-column forms), desktop (1024+, side navigation, real tables, sticky summaries). No separate desktop pass later. |
| D13 | Usage evidence | Pilot pass thresholds need "entries per working day" and "owner opened the log". Entries/day are computed from records; owner opens of `/log` and `/` are stored as `usage` records (excluded from all business projections, visible to the team only). |

## Index
| ID | Title | Status |
|---|---|---|
| SPEC-M00 | Foundation: shell, login, roles, entry log, offline sync, photos, i18n | Built |
| SPEC-M01 | Workers + attendance | Built |
| SPEC-M02 | Wages: advances, monthly settlement, slip, lock | Built |
| SPEC-M03 | Inventory: items, in/out/adjust, finished carpets | Built |
| SPEC-M04 | Orders: buyers, orders, status, deliveries | Built |
| SPEC-M05 | Owner dashboard + monthly analysis + Excel export | Built |
| SPEC-M06 | Deploy: Docker Postgres locally, Render in prod | Built |
| SPEC-M07 | Worker page: WhatsApp link + shop-code fallback, stays signed in | Built |
| SPEC-M08 | UI polish pass + one-year logins | Built |
| SPEC-M09 | Platform admin: founders see every unit, its users, workers and details (read-only) | Approved (user 2026-10-23) |

---

### SPEC-M00 — Foundation
- **Goal**: Owner creates a unit, adds staff, everyone logs in by PIN on their phone; every write is an append-only record with who/when/device; works offline; Hindi/English.
- **Users**: owner, staff (munshi). No weaver/buyer logins.
- **Data model** (`src/db/types.ts`): `Rec<P>` {id, type, unitId, payload, by, role, device, at, day, sync, serverSeq?, rejectReason?, photoIds?}. Masters versioned by `payload.entityId` (latest `at` wins; old versions kept = "edited by, when"). Events corrected by `reversal{targetId, reason}` + a new record (the UI shows "edited by X at T" on the new one and "old value" on the log).
  - `user` {entityId, name, phone, role owner|staff, pinHash, pinSalt, active}
  - `setting` {entityId:'unit', unitName, ownerPhone, lang, workingDaysPerMonth=26, photoRequiredAbovePaise=200000, currency 'INR'}
  - `usage` {screen, at} (D13)
- **Roles** (`can(role, action)`): staff can create everything and reverse own records of the same day; only owner edits settings, users, pay rates, locks a month, reverses anything, views `/log` filter by user, exports.
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
- **Data**: `advance` {workerId, day, amountPaise, mode cash|upi, note?, photoIds?}. `wage_payment` {workerId, month 'YYYY-MM', grossPaise, otPaise, deductionLines[{label, amountPaise}], advanceRecoveredPaise, netPaise, paidPaise, mode, day, note?, photoIds?}. `period_lock` {month, lockedAt, by}.
- **Formulas** (`domain/wage.ts`, integer paise):
  - working days W = settings.workingDaysPerMonth (holidays do not reduce W; W is the divisor only).
  - monthly: perDay = round(salary ÷ W); gross = salary − absent×perDay − half×round(perDay÷2).
  - daily: gross = present×rate + half×round(rate÷2).
  - piece: gross = Σ count×pieceRate.
  - ot = round(otHours × otRate). net = gross + ot − Σ deductions − advanceRecovered. paid = net rounded to ₹1 (half-up; rounding shown).
  - advanceRecovered default = min(outstanding advances, max(0, gross+ot−deductions)); staff may lower it; balance carries.
- **Screens**: `/advances/new` (worker, amount, mode, photo if > limit); `/wages` (month picker; table: worker, P/½/A, OT, gross, advances, net, paid/pending; totals; "Lock month" owner-only when all paid or explicitly); `/wages/:month/:workerId` (breakdown, editable deduction lines, recovery amount, pay → `wage_payment`, then **preview-and-confirm** WhatsApp slip text via wa.me, printable slip view).
- **Rules**: one payment per worker+month (server rejects duplicates); any attendance/advance/payment dated in a locked month is rejected client + server; unlock = owner-only reversal of the lock, logged.
- **Acceptance**: AC1 salary ₹12,000, W=26, 2 absent, 1 half, 3 h OT at ₹58/h → gross 12,000−923−231=10,846; ot 174; net 11,020 with ₹1,000 advance → 10,020 paid. AC2 second payment same month rejected. AC3 locked month refuses new attendance with a Hindi message. AC4 slip text lists every line; share only after preview.

### SPEC-M03 — Inventory
- **Data**: `item` {entityId, name, kind raw|finished, unit kg|pcs|litre|metre, lowStockQty, active}. Quantities in **integer thousandths** (grams for kg; pcs×1000) to avoid float. `stock_in` {itemId, day, qty, ratePaise?, supplier?, note?, photoIds?}. `stock_out` {itemId, day, qty, purpose production|sale|other, workerId?, orderId?, note?}. `stock_adjust` {itemId, day, qtyDelta (±), reason wastage|count_correction|damage|other, note, photoIds?}. `finished_in` {itemId (kind finished), day, qty, orderId?}.
- **Projections**: `stockBalance(recs, itemId, asOfDay)`; `stockLedger(item, month)` opening/in/out/adjust/closing; `lowStock(recs)`; `finishedStock(recs)` by design+size with order link.
- **Screens**: `/stock` (items with balance, low-stock badge, finished section), `/stock/new` (item), `/stock/:itemId` (ledger), `/stock/in`, `/stock/out`, `/stock/adjust` (reason required, photo required for adjustments above limit value or always for wastage — owner setting).
- **Rules**: out/adjust that would take balance below 0 is blocked inline (owner may override with reason, logged). Finished carpets decrease on `delivery` (M04).
- **Acceptance**: AC1 in 25.000 kg, out 12.500, adjust −0.250 wastage → balance 12.250, ledger matches. AC2 low-stock at ≤ lowStockQty appears on dashboard. AC3 over-issue blocked.

### SPEC-M04 — Orders
- **Data**: `buyer` {entityId, name, phone?, city?, active}. `order` {entityId, buyerId, orderNo (auto `ORD-001`…, editable), design, size (free text e.g. 8x10), qty, dueDate, pricePaise?, notes?, receivedOn}. `order_status` {orderId, status new|in_production|finished|delivered, day, note?}. `delivery` {orderId, day, qty, note?, finishedItemId?} (reduces finished stock when linked). `order_note` {orderId, text, photoIds?}.
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

## Scope — Out (all modules)
GST/invoicing, payment gateway, subscription billing, multi-branch, AI/voice, push notifications, barcodes/QR, supplier ledger, per-carpet loom tracking, thekedar chain, tauli, exporter links, Tally export, IVR.

## Open assumptions to confirm (non-blocking; defaults applied)
A1 Overtime in hours with per-worker ₹/hour (D12). A2 Half day = ½ deduction / ½ rate. A3 Finished carpets as `item` kind=finished named "<design> <size>". A4 Order numbers auto `ORD-nnn`. A5 Photos capped 300 KB, stored in Postgres. A6 Staff can see wage amounts (they compute payday today); only owner can change rates.
