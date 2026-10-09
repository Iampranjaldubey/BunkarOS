# Bunkar OS

Hindi-first, phone-first, **offline-capable PWA** for small carpet (कालीन) units
in Bhadohi. Operators are owners / munshis / thekedars on low-end Android phones
with patchy connectivity — so every action is captured locally (IndexedDB) and
synced to the server when a connection returns.

- **`app/`** — React 19 + Vite 8 + TypeScript + Tailwind v4 PWA (service worker +
  IndexedDB via Dexie). Hindi default, English toggle.
- **`server/`** — zero-dependency Node 24 API (`node:http` + `node:sqlite` +
  `node:crypto`). Default port **8787**.
- Product research / PRD: `docs/prd/Bunkar_OS_Product_Research.html`.
  Specs: `SPECS.md`. Architecture contract: `docs/superpowers/specs/architecture.md`.

## Prerequisites

- **Node ≥ 24** (the project is built and tested on **v24.21.0**).
  With `nvm`:
  ```bash
  export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"
  node -v   # v24.21.0
  ```
- No global tools required. The server has **no npm dependencies**; the app's
  dependencies install with `npm install` inside `app/`.

## Run (two terminals)

```bash
# Terminal 1 — API server on http://localhost:8787
cd server
npm start               # == node index.mjs

# Terminal 2 — app dev server on http://localhost:5173 (proxies /api -> :8787)
cd app
npm install             # first time only
npm run dev
```

Open **http://localhost:5173**:
- First run → `/setup` to **create a unit** (name + owner + 4-digit PIN), or
  **join** an existing unit with its unit code + key.
- After setup you land on `/login` (pick a user by name, enter the 4-digit PIN).

### Production preview (service worker active)

```bash
cd app
npm run build           # tsc -b && vite build  → dist/
npm run preview         # http://localhost:4173 (preview proxies /api -> :8787/:8788)
```

### Optional Hindi voice engine (C9 audio slips)

The public slip page (`/s/:token`) can play a server-generated **Hindi audio
clip** of the wage slip (`GET /api/slips/:token/audio` → a short mono
11.025 kHz 16-bit PCM WAV). The clip is rendered by **espeak-ng**, a
**GPL-3.0-or-later** engine that is kept **isolated** in `server/tts/` with its
own `package.json` and is run as a **separate child process** — the
zero-dependency core server never links it, so Bunkar OS's own license is
unaffected. The engine is **optional**: install it only if you want generated
audio.

```bash
cd server/tts
npm ci                  # installs espeak-ng (GPL-3.0-or-later) for this folder only
```

When the engine is **not** installed (or synthesis fails/times out), the audio
endpoint returns **503 `tts_unavailable`** and the slip page **falls back to the
phone's on-device Hindi TTS** (`speechSynthesis`) automatically — nothing
breaks, sync is never blocked.

### Run locally (built app)

Serve the production build against a loopback-bound API (what the hosted
instance does — API on **127.0.0.1:8790**, built app preview on
**127.0.0.1:4180**):

```bash
# Terminal 1 — API bound to loopback only, stable secret, local db:
cd server
HOST=127.0.0.1 PORT=8790 BUNKAR_SECRET=<32+ random chars> node index.mjs

# Terminal 2 — build the PWA and serve the preview, proxying /api → :8790:
cd app
npm run build
VITE_API_TARGET=http://localhost:8790 npx vite preview --port 4180 --host 127.0.0.1
```

`HOST=127.0.0.1` binds the API to loopback so it is not exposed on the LAN;
`VITE_API_TARGET` points the preview's `/api` proxy at that API instead of the
E2E default (`:8788`). Set a **stable** `BUNKAR_SECRET` (≥ 32 chars) so auth
tokens survive restarts.

## Demo script (6-step loop)

The owner home has a **demo seed** (via Settings → "Load demo", or the
`window.__bunkarDemo.load()` hook used by the E2E harness). It seeds unit
**EX-118** (Sharma Exports / "Kashan 14", 12 pieces) plus looms, weavers,
thekedars, rates, roker opening cash ₹42,500 and the loom board (17 on-track /
3 slow / 3 idle / 1 free). Then walk:

1. **Order → pieces** (A1): order EX-118 splits into 12 pieces (`/orders`).
2. **Issue yarn** (E1): two 12 kg issues to piece EX-118/03 (`/yarn/issue`).
3. **Check-in** (B2): photo + woven length → % woven (`/checkin/new`).
4. **Bazaar** (C3/E2): piece 96×119 → area 79.33 sqft, gross **₹3,014.54**,
   tauli short **0.613 kg**, net **₹1,954.54**, paid **₹1,955** (+₹0.46 rounding)
   (`/bazaar/new`).
5. **Peshgi** (C5): ₹1,000 advance recovered in the bazaar → balance 0.
6. **Roker / slip** (O1/C8/C9): roker closes at **₹34,500**; share the Hindi
   wage slip via `PreviewShareSheet` → public `/s/:token` page with Hindi TTS +
   Agree/Dispute. The 8 pm digest (K1) summarises the day (`/digest`).

Public read-only exporter mock (A2): **http://localhost:5173/o/EX-118**.

### Two-device / join flow

A second device can **join** the same unit from `/setup` with the unit code +
key. On the `/login` screen the device bootstrap-pulls the unit's `user` records
(unit-key only, no token) so the operator can pick their identity and enter their
PIN; after a successful online login a full sync pulls the rest of the data.
(Only `user` records — names + PBKDF2 hashes, never raw PINs — are returned
before login; the server rejects any write without a valid per-user token.)

## Roles

| Role | Home | Can |
|------|------|-----|
| **Owner** | K2 loom board + K1 digest card | everything: rates, settings, user management, reverse any record |
| **Munshi** | big action tiles | create orders / yarn / bazaar / peshgi / roker entries; **rates & settings are read-only** (server rejects a forced non-owner `rate`/`setting`); reverse only own records from today |
| **Thekedar** | his looms + check-in | view and check-in on **only his looms** (`visibleLoomIds`) |
| **Weaver** | public slip `/s/:token` (no login) | read the Hindi slip, play TTS, Agree / Dispute |

## Tests

```bash
# App — type check, unit/property tests (Vitest), E2E (Playwright)
cd app
npx tsc -p tsconfig.app.json --noEmit      # type check (expect exit 0)
npm run test                               # Vitest  (unit + property)
npm run test:e2e                           # Playwright E2E (starts its own servers)

# Server — Node built-in test runner (ephemeral port + temp sqlite db)
cd server
npm test                                   # == node --test
```

## Performance (budget Android)

The app targets low-end Android phones on patchy mobile data, so the PWA shell is
tuned to load fast cold and instantly warm:

- **Font subsetting** — `src/main.tsx` imports only the Devanagari + Latin
  `@fontsource` subsets actually rendered (Mukta 400/500/700, Tiro Devanagari 400),
  not the full families, and the service worker **precaches only `woff2`** (the
  legacy `.woff` fallbacks are excluded).
- **Vendor chunk splitting** — `react`/`react-dom`, `react-router`, and `dexie`
  are split into long-term-cacheable chunks (`build.rollupOptions.output.manualChunks`),
  so an app-code change never busts the vendor cache on a repeat visit.

Measure it with `scripts/perf.mjs`. It builds nothing — point it at a running
preview. It applies **4× CPU throttling + "Slow 4G"** (~1.6 Mbps down, 150 ms RTT)
via CDP, loads `/setup` **cold** (fresh context, no service worker) and then
**warm** (reloaded with the service worker active), and prints
`{cold:{lcpMs,cls,transferKB,requests}, warm:{...}}`:

```bash
cd app
npx vite build && npx vite preview --port 4175 --strictPort &   # any free port
npm run perf -- http://localhost:4175                           # == node scripts/perf.mjs
```

Budgets (all met): **cold LCP ≤ 2500 ms**, **warm LCP ≤ 1200 ms**, **CLS ≤ 0.1**.

Latest numbers (4× CPU + Slow 4G, Pixel-7 viewport):

| | cold LCP | warm LCP | CLS | cold transfer |
|---|---|---|---|---|
| **before** | ~1424 ms | ~104 ms | 0.004 | ~181 KB |
| **after**  | ~1432 ms | ~88 ms  | 0.004 | ~225 KB |

Precache (the bytes a fresh install downloads for a full offline shell) dropped
from **108 entries / 1820.64 KiB** to **97 entries / ~1312 KiB** — the font subset
+ `woff2`-only precache removes ~500 KiB of never-used font data, and the main app
chunk shrank from **246 KB → 36 KB** as the vendor libraries moved into their own
long-term-cacheable chunks.

## Environment variables (server)

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `8787` | API listen port |
| `HOST` | all interfaces | bind address — set `HOST=127.0.0.1` to bind **loopback only** (not exposed on the LAN) |
| `BUNKAR_DB` | `server/data/bunkar.db` | SQLite file path (`:memory:` supported) |
| `BUNKAR_SECRET` | random per start | HMAC secret for auth tokens — **set a stable value ≥ 16 chars in production** |
| `TRUST_PROXY` | unset | set to `1` **only** behind a known reverse proxy (enables `X-Forwarded-For`) |

## Project layout

```
app/
  src/domain/   pure TS projections + formulas (money, tauli, wage, roker, board, …)
  src/db/       Dexie schema, addRecord, reverse, photos, live hooks
  src/sync/     local-first sync client (push/pull, auth token, bootstrap)
  src/app/      router, session/auth, setup/login
  src/features/ one folder per feature screen
  e2e/          Playwright specs
server/
  index.mjs     entry (createServer / CLI)
  routes.mjs    HTTP dispatch (sync, auth token, photos, public slips)
  rules.mjs     server-authoritative record validation
  db.mjs        SQLite schema + data access
  test/         node --test suites
```
