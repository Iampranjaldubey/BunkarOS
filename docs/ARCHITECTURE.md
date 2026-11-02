# Bunkar MVP — Architecture

How the app is built, what it stores and which rules the server enforces. Decisions and acceptance
criteria live in `SPECS.md`; this file describes the code as it is (branch `desktop-first`, 2026-11-01).

## 1. Shape of the system

```
 phone / laptop browser (PWA)                         server (Node 24)                 Postgres 16
 ┌──────────────────────────────┐   POST /api/sync    ┌──────────────────────┐       ┌───────────────┐
 │ React screens                │ ◀────────────────▶ │ routes.mjs (node:http)│ ────▶ │ units         │
 │ domain/* (pure projections)  │   PUT/GET photos    │ rules.mjs (validation)│       │ records (JSONB│
 │ Dexie: records/photos/meta   │                     │ token.mjs (HMAC, PIN) │       │ photos (bytea)│
 │ sync/client.ts (push + pull) │                     │ static.mjs (app/dist) │       │ worker_links  │
 │ service worker (offline)     │                     └──────────────────────┘       │ meta          │
 └──────────────────────────────┘                                                     └───────────────┘
```

- **Offline first.** Every entry is written to IndexedDB on the device first (`addRecord`, `sync: 'pending'`).
  The sync client pushes about 0.8 s after a write, every 30 s, and when the browser comes back online.
- **Append-only.** Nothing is updated or deleted. A master edit is a new version with the same `entityId`
  (latest `at` wins). A correction is a `reversal` record pointing at the old one, plus a new record.
- **Same maths everywhere.** The browser computes every number (wages, stock, orders, dashboard) with the
  pure functions in `app/src/domain/`. The server checks rules and wage arithmetic; it does not compute reports.
- **Units.** Money in integer paise. Quantities in integer thousandths of the item's unit (grams for kg,
  pcs × 1000). Days are `YYYY-MM-DD` in Asia/Kolkata.

Code size: about 7 500 lines in `app/src` (excluding tests) and 950 in `server/`.

## 2. Features

| Area | Screens | What it does |
|---|---|---|
| Setup & login | `/setup`, `/login` | Create a unit (shop name, owner, 4-digit PIN) or join with unit code + key. Pick a name, enter PIN. Logins last 365 days. Hindi / Hinglish / English on every screen; light / dark / auto theme. |
| Roles | — | Owner: everything. Staff (munshi): daily entries; cannot change settings, users, pay rates, lock a month, export, or reverse other people's records (own records of the same day only). |
| Workers | `/workers`, `/workers/new`, `/workers/:id` | Name, phone, job, pay type (monthly / daily / per piece) with rate, OT rate per hour, joining date, photo, 4-digit worker code. Detail: month grid P/H/A/OT, advances, last payment, balance, worker-page link. |
| Attendance | `/attendance` | One screen for all active workers: Present / Half / Absent, OT ± 0.5 h, "all present", piece entries. Re-marking a day reverses the old mark. Shows "छुट्टी" or "रविवार" when the day is off. Locked months refuse marks. |
| Advances | `/advances/new` | Cash or UPI, any unlocked day, photo above the owner's limit. |
| Wages | `/wages`, `/wages/:month/:workerId` | Month sheet with totals. Pay screen: line-by-line breakdown, deduction lines, advance recovery, ₹1 rounding, payment mode, photo above the limit, WhatsApp slip after preview, print. Owner locks / unlocks a month. |
| Stock | `/stock`, `/stock/new`, `/stock/:id`, `/stock/move/in|out|adjust` | Raw items (kg / pcs / litre / metre) and finished carpets, low-stock level, in / out / adjust with reason, month ledger. Going below zero is blocked (owner may override). |
| Orders | `/orders`, `/orders/new`, `/orders/:id`, `/buyers` | Buyer, design, size, quantity, due date, price. Status New → In production → Finished → Delivered; partial deliveries (optionally from finished stock); overdue and due-soon flags; notes; WhatsApp status after preview. |
| Catalogue (SPEC-M15) | `/catalogue`, `/catalogue/new`, `/catalogue/:id`, `/catalogue/:id/edit` | Finished carpets with up to 4 photos (JPEG ≤ 1280 px, ≤ 300 KB), design, size (length × width in ft / m / cm), a quantity or a unique piece tag, material notes, cost and selling price (hidden from operators while "see prices" is off), notes. Grid with search and filters (design, size, status, price). Reserve for an order, release with a reason, deliver (reservation first), sold directly or written off with a date and a note, undo with a reason. The order page reserves and delivers from the catalogue. Old finished items stay as "पुराना" (legacy, DM-004); the item form makes raw materials only. |
| Home | `/` | Today's attendance, wages due, advances outstanding, low stock, orders due / overdue, today's entries by user. Each tile opens its records. |
| Month report | `/month` | Attendance grid, wage sheet, stock movement, orders, cash / UPI out, usage per user. Excel export with 5 sheets (summary, attendance, wages, stock, orders); print. |
| Entry log | `/log` | Every record with author and time, filter by user, reverse with a reason (subject to role rules). |
| Settings | `/settings` | Language, theme, unit name, working days per month (W), photo limit, **holidays** (owner adds / removes dates), logins (add staff, deactivate), shop code, join code + key. |
| Worker's page | `/w/:token`, `/w`, `/w/join` | No login. Opened from a WhatsApp link or with shop code + name + worker code; remembered on that phone. Shows this month and expected pay, pay history with slip lines, advances, profile, "ask the owner". |
| Founders' admin | `/admin`, `/admin/units/:unitId` | Read-only, English. Every unit with owner, logins, workers, entries this month; per unit: workers, wage sheet, stock, orders, usage, last 50 entries. Needs `ADMIN_KEYS`. |

## 3. Data on the device (Dexie, database `bunkar-mvp`)

| Table | Key | Holds |
|---|---|---|
| `records` | `id` (indexes: type, unitId, sync, day, at) | Every `Rec` of the unit: own pending ones and everything pulled. |
| `photos` | `id` (index: sync) | Compressed JPEG blobs (longest edge ≤ 1280 px, quality ≈ 0.7) waiting for upload or already synced. |
| `meta` | `key` | `bunkar.unit` {unitId, unitKey, unitName}, `bunkar.auth` {token, exp, userId}, `cursor` (pull position), `unitRegistered`, `bunkar.lock.<userId>` (PIN lockout), `bunkar.pin.<userId>` (this phone's PIN verifier), `scrub.pin.v1`. |

`localStorage` holds the session (`bunkar.session`), device id, language, theme and the saved worker-page token.

## 4. Record model

Envelope (`app/src/db/types.ts`):

| Field | Meaning |
|---|---|
| `id` | UUID made on the device; the server is idempotent by id. |
| `type` | One of the record types below. |
| `unitId`, `payload` | Owning unit; type-specific data. |
| `by`, `role`, `device` | Author user id, role at the time, device id. |
| `at`, `day` | Real time (UTC ISO) and business day (IST, may be back-dated). |
| `sync`, `serverSeq`, `rejectReason` | `pending` / `synced` / `rejected`; server sequence; reason if rejected. |
| `photoIds`, `replaces` | Attached photos; id of the record this one replaced on an edit. |

Record types and payloads:

| Group | Type | Payload |
|---|---|---|
| Masters (versioned by `entityId`) | `user` | name, phone, role owner/staff, active. `pinHash`/`pinSalt` only on a device's own pending record (see §7). |
| | `setting` | entityId `'unit'`, unitName, ownerPhone, lang, workingDaysPerMonth (26), photoRequiredAbovePaise (200000), holidays[] |
| | `worker` | name, phone, jobTitle, payType, salaryPaise / dailyRatePaise / pieceRatePaise, otRatePaise, joinedOn, active, photoId, accessCode |
| | `item` | name, kind raw/finished, unit kg/pcs/litre/metre, lowStockQty, active |
| | `buyer` | name, phone, city, active |
| | `order` | buyerId, orderNo, design, size, qty, dueDate, pricePaise, notes, receivedOn |
| Attendance & wages | `attendance` | workerId, status present/half/absent, otHours (0–16, step 0.5), note |
| | `piece_entry` | workerId, count, pieceRatePaise |
| | `advance` | workerId, amountPaise, mode cash/upi, note |
| | `wage_payment` | workerId, month, grossPaise, otPaise, deductions[], advanceRecoveredPaise, netPaise, roundingPaise, paidPaise, mode, snapshot of inputs |
| | `period_lock` | month |
| Stock | `stock_in` | itemId, qty, ratePaise, supplier |
| | `stock_out` | itemId, qty, purpose production/sale/other, workerId, orderId |
| | `stock_adjust` | itemId, qtyDelta (±), reason wastage/count_correction/damage/other, note |
| | `finished_in` | itemId, qty, orderId |
| Orders | `order_status` | orderId, status |
| | `delivery` | orderId, qty, finishedItemId (legacy item) or carpetId (catalogue) |
| Catalogue | `carpet` (master) | entityId, design, lengthMilli, widthMilli, sizeUnit, mode piece/quantity, tag, materialNotes, costPaise, pricePaise, notes, photoIds (0–4), active |
| | `carpet_in` | carpetId, qty |
| | `carpet_reserve` | carpetId, orderId, qty (a release is a reversal) |
| | `carpet_out` | carpetId, qty, kind sold/written_off, note |
| | `order_note` | orderId, text |
| Meta | `usage` | screen (owner opens of `/` and `/log`; excluded from business numbers) |
| | `reversal` | targetId, reason |

## 5. Postgres schema (`server/db.mjs`)

| Table | Columns | Notes |
|---|---|---|
| `units` | `unit_id` PK, `key_hash`, `salt`, `name`, `created_at`, `short_code` | Unit key stored as scrypt hash. `short_code` = 6-digit shop code, unique index. |
| `records` | `seq` BIGSERIAL PK, `id` TEXT UNIQUE, `unit_id`, `type`, `json` JSONB, `at`, `day` | The full `Rec` as JSONB. Indexes `(unit_id, seq)` for pulls and `(unit_id, type)` for rule lookups. `seq` is the pull cursor. |
| `photos` | `id` PK, `unit_id`, `mime`, `bytes` BYTEA | JPEG / PNG / WebP, ≤ 400 KB per upload. |
| `worker_links` | `token` PK, `unit_id`, `worker_id`, `created_at`, `revoked_at` | Worker-page links; a new link revokes the old one. |
| `meta` | `key` PK, `value` | `hmac_secret` when `BUNKAR_SECRET` is not set. |

Tests and the e2e harness use their own Postgres schema (`PGSCHEMA`); `PG_RESET=1` drops it at start (never on `public`).

## 6. HTTP API (`server/routes.mjs`)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/health` | — | Health check. |
| `POST /api/units` | — | Create a unit `{unitId, unitKey, name}` or confirm an existing one with its key → `shortCode`. |
| `POST /api/auth/token` | unit key + `{userId, pin}` | PBKDF2 PIN check on the server → HMAC token (365 days). Rate-limited per IP. 401 wrong PIN, 429 too many tries. |
| `POST /api/sync` | unit key + Bearer token | Push `{records}` and pull `{since, limit ≤ 500}` → `{accepted, rejected[{id, reason}], records, cursor}`. Without a token, a unit that has users only allows a pull of `user` records (login screen bootstrap). |
| `GET /api/units/me` | unit key | Unit name and shop code. |
| `PUT /api/photos/:id`, `GET /api/photos/:id` | unit key + Bearer token (once the unit has users) | Store / read a photo. 401 `needs_login` without a valid token for that unit. |
| `POST /api/worker-links`, `POST /api/worker-links/revoke` | owner or staff token | Create / revoke a worker-page link. |
| `GET /api/w/shop/:code` | public, rate-limited | Unit name and active worker names for the join screen. |
| `POST /api/w/claim` | public, rate-limited | Shop code + worker + 4-digit code → worker-page token. |
| `GET /api/w/:token` | public, rate-limited | That worker's records only (attendance, pieces, advances, payments, reversals, locks, settings). 410 when revoked. Never returns the access code. |
| `POST /api/admin/login` | `ADMIN_KEYS` name + key, rate-limited | Admin token (30 days). 403 when admin is disabled. |
| `GET /api/admin/units`, `GET /api/admin/units/:unitId` | admin token | Read-only unit list and full records (PIN fields stripped). Admin tokens are refused by every unit endpoint. |

Any other `GET` serves the built app from `app/dist` (hashed assets cached for a year, `index.html` no-cache).

## 7. Rules enforced by the server

On every pushed record (`server/rules.mjs` + `handleSync`):

1. Shape: id 8–64 chars, known type, matching unit, payload object, valid `at` and `day`, no duplicate id in the batch. A known id is accepted again without a second insert.
2. Author: once the unit has users, a token is required and `by` must equal the token's user (`forged_author`). Before that, only `setting` and `user` are accepted (`bootstrap_only`).
3. Owner-only types: `setting`, `user`, `period_lock` (`forbidden_role`).
4. Staff reversals: only their own records whose day is the **server's IST date** when the reversal arrives; the reversal's own `day` is ignored (`forbidden_reversal`, SPEC-M16 §5).
5. Staff worker edits: pay type and rates must not change (`forbidden_rate_change`).
6. Locked months: attendance, pieces, advances, payments, stock moves and deliveries dated in a locked month are refused (`period_locked`). A **reversal** of such an entry is refused too, for everyone including the owner; only the lock's own reversal (unlock) is allowed, and within one push it reopens the month for the records after it (SPEC-M16 §2).
7. Wage payment:
   - `gross + ot − deductions − advanceRecovered = net` and `net + rounding = paid`, all integers;
   - `net < 0` → `negative_net`; `|rounding| > 50` paise → `invalid_rounding`; `paid < 0` → `negative_paid` (SPEC-M16 §3);
   - one payment per worker and month (`duplicate_payment`).
8. Stock (SPEC-M16 §4): the server keeps each item's balance (stock in + finished in − out ± adjust − deliveries from that finished item, reversed records excluded, records earlier in the same push counted). A stock out, a negative adjustment or a finished-stock delivery that would go below zero is refused (`insufficient_stock`), unless the record is by the owner with `allowNegative: true` and a non-empty `overrideReason`.
9. Field checks: attendance status and OT steps, positive integer amounts and quantities, non-zero stock adjustments with a note, orders with qty and number.
10. PIN fields (SPEC-M11): a `user` record without `pinHash`/`pinSalt` is an edit and keeps the stored values; a new user without them, or with empty values, is refused (`invalid_user`).
11. Photos (SPEC-M16 §6): the first unit to store an id owns it and it is never overwritten. Another unit gets 409 `photo_id_taken`; the same unit with other bytes gets 409 `photo_exists`; the same bytes again → 200.
12. Catalogue (SPEC-M15, `server/catalogue.mjs`): the server keeps each carpet's counts and each order's reservations from the stored records, in push order. It refuses a carpet without a design, with a bad size (`invalid_size`), more than 4 photos (`too_many_photos`), a negative price (`invalid_price`), a missing or duplicate piece tag among active carpets (`tag_required`, `duplicate_tag`) or a changed mode after carpets were added (`invalid_carpet`); a piece added twice (`piece_added`); a reservation above stock or above what the order still needs (`insufficient_stock`, `exceeds_order`); a delivery above the order's reservation + stock or above the order's pending quantity, or naming both a carpet and a legacy item (`invalid_delivery`); a sale or write-off without a note (`note_required`) or above stock; taking back added carpets that are gone. Catalogue movements in a locked month are refused like other entries.

What a client receives:

- `user` records never carry `pinHash`/`pinSalt` (bootstrap pull, authenticated pull, push echo, admin).
- The worker page gets only that worker's records and never the access code.
- With "see prices" off, an operator token never receives `order.pricePaise` or `carpet.costPaise` / `pricePaise` (pull and push echo; checked on the raw response text in `server/test/catalogue.test.mjs`). An operator record carrying a price is refused (`forbidden_price`); an operator edit keeps the stored prices.

## 8. Login and PIN handling

- PINs are hashed with PBKDF2-SHA256, 100 000 iterations, random 16-byte salt (`app/src/lib/pin.ts`; same parameters in `server/token.mjs`).
- **Online:** the server checks the PIN. 200 → token + session; the phone stores its own verifier for that user (`meta bunkar.pin.<userId>`, fresh salt). 401 → wrong PIN; 429 → "too many tries".
- **Offline or no answer:** the PIN is checked against this phone's verifier. A phone that never logged that user in online cannot log them in offline ("first login on this phone needs internet"). The phone that created the unit stores the owner's verifier at setup.
- Five wrong PINs lock that user on that phone for 1 min, then 5, 15, 60 min.
- After the server accepts a `user` record, the phone removes the PIN fields from its copy; a one-time start-up scrub (`scrub.pin.v1`) removes any that older builds pulled.
- Tokens: HMAC-SHA256 over `{unitId, userId, exp}` with `BUNKAR_SECRET` (or a generated secret in `meta`). The unit key travels in `x-unit-id` / `x-unit-key` headers and is stored as a scrypt hash.

## 9. Sync client (`app/src/sync/client.ts`)

1. Register the unit once (`POST /api/units`).
2. Push pending records in batches of 200. With a token, only the token holder's records are pushed; on a shared phone other users' records wait for their author.
3. Apply `accepted` (→ synced) and `rejected` (→ rejected with reason; shown in the log).
4. Pull every page since `cursor` until a short page. Pulled records never overwrite a local payload.
5. Upload pending photos last, with the token.
6. Errors back off from 2 s to 5 min; a 401 drops the token and the header badge asks for login.

## 10. Calculations (`app/src/domain/`)

- **Monthly pay:** per day = round(salary ÷ W); gross = salary − absent × per day − half × round(per day ÷ 2). W = working days per month (default 26); holidays do not change W.
- **Daily pay:** present × rate + half × round(rate ÷ 2). **Piece pay:** Σ count × rate at entry time.
- **OT:** round(hours × OT rate). **Net:** gross + OT − deductions − advance recovered. Recovery defaults to the smaller of outstanding advances and what is left; paid = net rounded to ₹1 (half-up).
- **Unmarked days:** past working days (not Sunday, not a holiday) with no mark.
- **Stock:** balance = Σ stock in + Σ finished in − Σ stock out ± adjustments − deliveries taken from that finished item; month ledger opening / in / out / adjust / closing.
- **Orders:** pending = qty − delivered; delivered status when pending reaches 0; overdue = open and past due; due soon = within 7 days.
- **Month orders sheet:** orders received by the month end, minus those fully delivered before the month started; delivered and pending counted up to the month end.

## 11. Front-end structure

```
app/src/
  app/         router, session (login, lockout, verifier), layout, guards, setup/login pages
  components/  UI kit (Button, Card, Field, Input, Sheet, ResponsiveTable, SideNav, BottomNav, …)
  db/          Dexie schema, addRecord/reverse, live hooks, photo compression
  domain/      pure projections + tests (attendance, wage, advances, stock, orders, dashboard, money, dates)
  features/    one folder per area (home, attendance, workers, wages, stock, orders, month, log, settings)
  i18n/        hi (default, in the main bundle), hin and en (lazy), per-feature dictionaries merged at load
  sync/        sync client
  worker/      public worker page
  admin/       founders' admin
```

Stack: React 19, React Router 7, Vite 8, TypeScript, Tailwind v4 with a hand-written UI kit, Dexie 4,
vite-plugin-pwa (auto-update; the page reloads when a new build takes over, hourly update check), exceljs
(lazy chunk, not precached), lucide icons, Mukta + Tiro Devanagari fonts.

Layouts (SPEC-M12, desktop-first). `useIsDesktop()` (≥ 1024 px) picks one markup or the other; nothing is
built twice and hidden with CSS.

| | Desktop ≥ 1024 px | Phone / tablet < 1024 px |
|---|---|---|
| Shell | Side menu 256 px (collapses to a 76 px icon rail, remembered in `localStorage bunkar.nav.collapsed`) with "नई एंट्री" quick-entry menu, links, user + logout; top bar with today's date, sync badge, language; content up to 88rem | Header with unit name, bottom bar, "More" page |
| Attendance | Roll-call table; keys P/H/A or 1/2/3 mark and move down, + / − change OT, ↑ / ↓ move; previous/next day, "आज", "सिर्फ़ बाकी" filter | Cards with P / H / A toggles |
| Entry log | Table (when, type, what, by, undo), filters by type and user | Cards, same filters |
| Home | Tiles + "देने वाले ऑर्डर" and "कम स्टॉक" panels + quick actions | Tiles + quick actions |
| Advance / stock forms | Form + context panel (balance, last 5 entries) | Form only |

Colours are CSS variables in `index.css` (light and dark). Text on filled surfaces uses `--color-on-fill`
(white in light, dark ink in dark); `src/theme.contrast.test.ts` checks every text/background pair is ≥ 4.5:1
in both themes.

## 12. Running, testing, deploying

| Task | Command |
|---|---|
| Database | `docker compose up -d db` (Postgres 16 on :5432, user/password `bunkar`) |
| API | `cd server && npm ci && npm start` (:8791; serves `app/dist` if built) |
| App (dev) | `cd app && npm ci && npm run dev` (:5174, proxies `/api` to :8791) |
| Demo data | `cd server && node seed-demo.mjs` (prints unit code, key, PIN 1234) |
| Unit tests | `cd app && npm run typecheck && npx vitest run` |
| Server tests | `cd server && npm test` (throwaway schema per file) |
| E2E | `cd app && npx playwright test` (starts API :8795 on schema `e2e` + Vite :5174). Functional specs 01–09 run in both projects (`mobile` 390×844, `desktop` 1440×900); 20/22 are desktop-only, 21 phone-only |
| Screenshots | `cd app && SHOTS_DIR=../../docs/screenshots/m12/after npx playwright test -c scripts/shots.config.ts` (seeded demo, API :8797 + Vite :5176; options `SHOTS_WIDTHS`, `SHOTS_ROUTES`, `SHOTS_THEME=dark`, `SHOTS_COLLAPSED=1`) |
| Deploy | `render.yaml`: one Node web service (builds the app, runs the server) + one Postgres. Env: `DATABASE_URL`, `BUNKAR_SECRET`, `TRUST_PROXY=1`, optional `ADMIN_KEYS`. The blueprint names branch `mvp`, which currently equals `main`. |

## 13. Known limits

- Rule checks re-read all records of a type per sync request (`reversedTargetIds`, `lockedMonths`, `paidPairs`). Fine for one shop; needs indexes or cached state before many busy units share a server.
- Photos live in Postgres `bytea`; move to object storage if the database grows past the plan limit.
- The server trusts the device for business-day dates inside unlocked months (back-dating is a feature).
- Old commits of the previous architecture may still be reachable on GitHub by SHA until GitHub garbage-collects them.
