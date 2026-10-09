# Bunkar OS P0 — Architecture contract (binding for all agents)

Source of truth for module boundaries. Data types: `app/src/db/types.ts` (do not change field names without the controller).
Decisions D1–D9: `TASKS.md`. Feature specs: `SPECS.md`. PRD: `docs/prd/Bunkar_OS_Product_Research.html`.

## Stack
- `app/`: React 19 + Vite 8 + TypeScript + Tailwind v4 (`@tailwindcss/vite`) + react-router-dom 7 + Dexie 4 (IndexedDB) + vite-plugin-pwa + lucide-react. shadcn-style components are hand-written in `src/components/ui/` (cva + tailwind-merge), no shadcn CLI.
- `server/`: zero-dependency Node 24 (`node:http`, `node:sqlite`, `node:crypto`). Port 8787. Vite dev proxies `/api` → `http://localhost:8787`.
- Tests: Vitest (`app/src/**/*.test.ts`, `server/**/*.test.mjs` via `node --test`), Playwright E2E in `app/e2e/`.

## Core model: append-only records (N1 + M3)
- Every write = one `Rec` (types.ts) saved to IndexedDB with `sync:'pending'`, then pushed by the sync client. Nothing is updated in place except `sync/serverSeq/rejectReason` bookkeeping.
- Masters (user, loom, thekedar, weaver, order, rate, norm, setting) are versioned by `payload.entityId`; latest `at` wins; older versions = audit "old value".
- Corrections: `reversal {targetId, reason}`; reversed records are ignored by all projections. Munshi may reverse only records of the same `day` he authored; owner may reverse anything (N2).
- Server wins: server may reject a record (e.g. second bazaar for same piece, non-owner rate edit). Client marks it `rejected` with reason; projections ignore rejected records; UI shows them in a "Rejected" list.

## Module ownership (one owner per folder; do not edit other folders' files)
| Path | Owner | Contents |
|---|---|---|
| `src/db/types.ts` | controller | contract above |
| `src/domain/` | domain agent | pure TS, no React/Dexie: `units.ts money.ts ids.ts wage.ts tauli.ts peshgi.ts rates.ts roker.ts board.ts digest.ts slip.ts permissions.ts`, `projections.ts` + `*.test.ts` |
| `src/db/db.ts repo.ts hooks.ts photos.ts` | foundation agent | Dexie schema, `addRecord`, `reverse`, live hooks, photo compression |
| `src/sync/` | server agent | sync client |
| `server/` | server agent | API + tests |
| `src/components/ui/`, `src/app/`, `src/i18n/`, `index.css`, `vite.config.ts`, `main.tsx` | foundation agent | design system, shell, router, auth, i18n |
| `src/features/<name>/` | feature agents | one folder per feature area |
| `e2e/` | QA agent | Playwright |

## Key APIs (names are binding)
`src/domain/` (pure):
- units: `ftInToIn(ft,in)`, `inToFtIn(inches)→{ft,in}`, `formatFtIn(inches)` → `8'0"`, `areaSqft(lengthIn,widthIn)` (2 dp), `gramsToKgStr(g)` → "12.000", `kgStrToGrams(s)`.
- money: `formatINR(paise, {paise?:boolean})` Indian grouping "₹3,015", `rupeesToPaise(n)`, `roundToRupee(paise)→{paid,rounding}` (half-up).
- wage: `computeWage({areaSqft, ratePaise, rateUnit})` → gross paise; `computeNet({gross, deductions, peshgiRecovered})`.
- tauli: `computeTauli({issuedG, returnedG, carpetG, wastagePct, areaSqft, normGPerSqft?})` → `TauliResult` (allowed = round(used×pct/100); gap = used−carpet; short = max(0,gap−allowed); extra = max(0, carpet−used)).
- projections (all take `recs: Rec[]` and ignore reversed + rejected): `activeRecords`, `latestEntities<T>(recs,type)`, `listLooms, listWeavers, listThekedars, listUsers, listOrders, listPieces` (piece = {pieceId, orderId, orderNo, seq, design, quality, colour, lengthIn, widthIn, exporter, loomId?, weaverId?, status:'not_started'|'on_loom'|'off_loom'|'delivered'|'on_hold', wovenIn, pctWoven, lastCheckinAt?, bazaarId?}), `getSettings`, `rateForPiece(recs, pieceId, onDay)` (D2: rate in force on first yarn issue day for that piece, else onDay), `normFor(recs, quality)`, `yarnBalances(recs)` (by holder & shade/lot with grams + oldest issue day), `pieceYarn(recs,pieceId)` → {issuedG, returnedG}, `peshgiBalance(recs, personKind, personId)`, `peshgiLedger(...)`, `rokerDay(recs, day)` → {openingCash, entries[], cashIn, cashOut, upiIn, upiOut, closingCash}, `loomBoard(recs, nowISO)` → per loom {status:'on_track'|'slow'|'idle'|'free', daysSinceProgress}, `digest(recs, day, nowISO)`, `weaverPassbook(recs, weaverId)`, `auditLog(recs)`.
- permissions: `can(role, action)` for actions `rate.edit, settings.edit, user.manage, record.reverse.any, record.reverse.ownToday, order.create, yarn.issue, bazaar.create, peshgi.give, checkin.create, roker.entry, digest.view, audit.view, loom.manage, weaver.manage`; thekedar sees only his looms (`visibleLoomIds(recs, user)`).
- slip: `buildBazaarSlip(...)`, `buildPeshgiSlip(...)` → `SlipP` minus token; `waMeLink(phone, text)` (India: prefix 91 to 10-digit numbers).

`src/db/` (foundation):
- `db` (Dexie, tables `records` [id, type, unitId, sync, day, at], `photos` [id, sync], `meta` [key]).
- `addRecord<P>(type, payload, {photoIds?}) → Promise<Rec<P>>` fills id/unitId/by/role/device/at/day/sync from the current session.
- `reverse(targetId, reason)`; `savePhoto(file) → photoId` (compress to max 1280px JPEG q≈0.7); `photoUrl(id)`.
- hooks: `useRecords()` (live, all records of current unit), `useSession()` {user, role, unitId, lang, logout}, `usePendingCount()`.

`src/sync/` (server agent): `syncNow()`, `startAutoSync()` (online event + every 30 s), `useSyncState()` → {pending, lastSyncAt, online, error}.

## Server API (`server/`, all JSON)
- `POST /api/units` {unitId, unitKey, name} → create/idempotent. Auth for unit APIs: headers `x-unit-id` + `x-unit-key` (constant-time compare against stored hash).
- `POST /api/sync` {records: Rec[], since: number} → {accepted: id[], rejected: {id, reason}[], records: Rec[] (serverSeq > since), cursor}. Idempotent by id. Server rules: one non-reversed bazaar per piece; `rate`/`setting`/`user` records only from users whose latest user record role is owner (first `user` + `setting` records of a new unit are allowed); records immutable.
- `PUT /api/photos/:id` (image body, ≤ 2 MB) / `GET /api/photos/:id` (unit auth).
- Public weaver slip: `GET /api/slips/:token` → {slip view, response?}; `POST /api/slips/:token/response` {answer, note?} → stores a `slip_response` record (role 'weaver') into the unit stream. Token must be ≥ 22 chars base64url; unknown token → 404; rate-limit simple per-IP.
- `GET /api/health`.

## Routes (`src/app/router.tsx`)
`/setup` (create unit + owner PIN, or join with unit code) · `/login` (pick user by photo/name + 4-digit PIN) · `/` role home (owner: K2 board + digest card; munshi: big action tiles; thekedar: his looms + check-in) · `/orders` `/orders/new` `/orders/:id` · `/looms` `/looms/new` `/looms/:id` · `/weavers` `/weavers/new` `/weavers/:id` · `/thekedars` `/thekedars/new` · `/yarn` `/yarn/issue` `/yarn/return` · `/rates` · `/bazaar/new` `/bazaar/:id` · `/peshgi/new` · `/checkin/new` · `/roker` · `/digest` · `/audit` · `/settings` · `/s/:token` (public, no login) · `/o/:orderId` (A2 static exporter mock).

## UI rules (M1, F-2, F-3)
- Hindi-first (`hi` default, toggle to `en`), all strings via `t('key')` from `src/i18n/`. Western digits with Indian grouping.
- Mobile-first (360–414 px), min tap target 48 px, base font 18 px, big numerals (tabular). Bottom nav per role.
- Colour meaning: red (`--madder`) = money/wool given out, green (`--jute`/ok) = received. Palette from PRD: madder #A8322A, indigo #26406B, saffron #C98A1C, jute #4F7545.
- Every WhatsApp share goes through `PreviewShareSheet` (recipient + full text preview + confirm) — nothing sent silently.
- Every screen works offline; header shows sync badge (pending count / synced / offline).
- Accessibility: labels on all inputs, focus-visible rings, contrast ≥ 4.5:1, `prefers-reduced-motion` respected.

## P0-completion batch (SPEC-014..018) — binding contract
Types (controller-owned, already added in `app/src/db/types.ts`): `RateUnit = 'sqft'|'sqgaj'|'piece'|'kg'|'day'`, `WorkKind`, `RateP.work?` (absent = weaving), record type `'job'` with `JobP`, `SlipP.speechHi?`.

### File ownership for this batch (one owner per file; others must not edit)
| Agent | Owns |
|---|---|
| **n2** (SPEC-014) | `server/{routes,db,token,auth,index}.mjs`, `server/test/devices.test.mjs` (+ existing token/sync tests), `app/src/sync/*`, `app/src/app/{session,LoginPage}.tsx`, `app/src/features/settings/*`, `app/src/i18n/devices.{hi,en}.ts`, `app/e2e/13-n2-devices.spec.ts`, `app/e2e/fixtures.ts` |
| **c9** (SPEC-015 + B1/B2 GPS check) | `app/src/domain/{speech,slip}.ts` (+tests), `server/slip-audio.mjs`, `server/tts/**` (isolated engine, own package.json), `server/test/slip-audio.test.mjs`, `app/src/features/slip/*`, `app/src/features/bazaar/BazaarDetailPage.tsx`, `app/src/features/{looms,checkin}/*` (GPS fixes only), `app/src/i18n/{audio,transactions}.{hi,en}.ts`, `app/e2e/14-c9-audio.spec.ts`, `app/e2e/17-gps.spec.ts` |
| **c2** (SPEC-016) | `app/src/domain/{wage,jobs,roker,permissions,projections}.ts` (+tests), `server/{amounts,rules}.mjs`, `server/test/jobs.test.mjs`, `app/src/features/{rates,jobs,roker,weavers}/*`, `app/src/features/bazaar/BazaarNewPage.tsx`, `app/src/app/router.tsx`, `app/src/i18n/{masters,jobs}.{hi,en}.ts`, `app/e2e/15-c2-jobs.spec.ts` |
| **k** (SPEC-017/018) | `app/src/domain/{board,owner,monthly,digest}.ts` (+tests), `app/src/features/{home,digest,exporter,demo}/*`, `app/src/i18n/{outputs,demo}.{hi,en}.ts`, `app/e2e/16-k2-k1.spec.ts` + updating existing specs that assert the board legend |

Cross-agent seams (fixed names — code to them even before they exist):
- **c9 → controller**: `server/slip-audio.mjs` exports `async function handleSlipAudio(req, res, { db, token, sendError })`; the controller wires `GET /api/slips/:token/audio` in `routes.mjs` after n2 lands.
- **c2 → k**: munshi home tile → route `/jobs/new` (c2 adds the route; k adds the tile, label key `home.munshi.job`). k computes job amounts for the monthly wage bill directly from `job` records (do not import `jobs.ts`).
- **k → c2**: k seeds job rates in the demo (straightening ₹7/kg, untying ₹10/kg, helper ₹350/day, effective 60 days ago, `quality: ''`).
- **n2**: client device id = existing localStorage `bunkar.device` (`src/lib/session-store.ts`).
- New domain helpers are imported from their own module files; the controller adds barrel exports to `projections.ts` afterwards (only c2 edits `projections.ts`).
- Board: `LoomStatus = 'on_track'|'slow'|'idle'|'no_wool'|'free'` (k), demo board = 17 / 3 / 3 / 1 no wool (PRD grid).

## Responsive layout contract (SPEC-019) — binding for the desktop batch
- Breakpoints: Tailwind defaults `md` 768, `lg` 1024, `xl` 1280. **Below `md` nothing may change** (phone layout + all mobile e2e unchanged).
- Shell (`src/app/AppLayout.tsx`): `lg+` → fixed left `SideNav` (w-64, `data-testid="side-nav"`), `BottomNav` hidden (`lg:hidden`, keep `data-testid="bottom-nav"`), header full width, `<main>` = `max-w-md md:max-w-3xl lg:max-w-6xl` with `lg:pl-64` offset.
- Shared primitives (shell agent creates, page agents use; import from `src/components/ui`):
  - `SideNav({ role })` — role destinations (same as BottomNav) + the "More" destinations (orders, looms, weavers, thekedars, yarn, rates, digest, audit, settings) filtered by `can()`; active item highlighted; ≥ 44 px rows.
  - `PageGrid({ main, aside, asideSticky? })` — one column below `lg`; at `lg` main 2/3 + aside 1/3 (aside sticky under the header when `asideSticky`).
  - `ResponsiveTable<T>({ rows, columns:[{key, header, cell(row), align?, className?}], rowKey, onRowClick?, renderCard(row), empty?, testid? })` — renders `renderCard` list below `lg` (exactly today's mobile cards) and a real `<table>` (`data-testid={testid ?? 'data-table'}`, sticky header, zebra rows, 44 px rows, row click/Enter opens) at `lg+`.
  - `FormGrid({ children })` — `grid gap-x-6 lg:grid-cols-2`; children may use `lg:col-span-2` for full-width fields.
  - `Sheet` — bottom sheet below `lg`, centered dialog (`max-w-lg`, rounded-2xl) at `lg+`. Same props/API.
- New i18n keys: each agent adds its own file `src/i18n/desktop-<agent>.{hi,en}.ts`.
- File ownership for the batch: **shell** = `src/app/AppLayout.tsx`, `src/components/ui/*`, `src/index.css`, `playwright.config.ts`, `e2e/20-desktop-shell.spec.ts`; **owner** = `features/{home,digest,exporter,slip}/*`, `app/{LoginPage,SetupPage}.tsx`; **lists** = `features/looms/{LoomsPage,LoomDetailPage,shared}.tsx`, `features/weavers/{WeaversPage,WeaverDetailPage}.tsx`, `features/orders/{OrdersPage,OrderDetailPage}.tsx`, `features/thekedars/ThekedarsPage.tsx`, `features/yarn/YarnPage.tsx`, `features/{roker,audit,rates}/*`; **forms** = `features/{bazaar,peshgi,jobs,checkin,settings,shared}/*`, `features/yarn/{YarnIssuePage,YarnReturnPage}.tsx`, `features/*/*NewPage.tsx`; e2e: each page agent owns `e2e/2x-desktop-<agent>.spec.ts`.
