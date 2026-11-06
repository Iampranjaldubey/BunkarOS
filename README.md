# Bunkar MVP

Hindi-first, phone-first, offline-capable PWA for small carpet units in Bhadohi: **attendance, wages, inventory, orders and a monthly report**, for the owner and the munshi (staff). Phase 2 pilot build for the Sitare University Startup Program (Group 34).

- `app/` — React 19 + Vite 8 + TypeScript + Tailwind v4, Dexie (IndexedDB) + service worker. Three languages: हिंदी · Hinglish · English. Light and dark.
- `server/` — Node 24 + Postgres (`pg`). Append-only records, server-side rules, serves the built app.
- Specs and decisions: `SPECS.md`. Task board: `TASKS.md`. Log of every step: `WATCHINGLOGS.md`.

## Run locally

```bash
docker compose up -d db                                         # Postgres 16 on :5432 (bunkar/bunkar)
cd server && npm ci && ADMIN_KEYS="dev:<long-random-key>" npm start  # API on http://localhost:8791
cd app && npm ci && npm run dev                                 # app on http://localhost:5174 (proxies /api → :8791)
```

Organisations are created by the founders (SPEC-M18). Open **http://localhost:5174/admin**, sign in with the name and key from `ADMIN_KEYS`, choose **New organisation** (business, industry, modules, owner), and send the owner the invite link or 8-character code. The owner opens `/join/<link>` (or types the code on `/setup`) and sets a 4-digit PIN. Add staff in Settings. A second phone joins with the unit code + key from Settings. Creating a unit without an invite is refused.

The Playwright suite starts its own servers on :5174 and :8795; while it runs, start the dev app on another port (`npx vite --port 5175`).

### Demo data

```bash
cd server && SEED_ADMIN="dev:<long-random-key>" node seed-demo.mjs                 # carpet demo unit
cd server && SEED_ADMIN="dev:<long-random-key>" node seed-demo.mjs --industry bags  # bags demo unit
```
Each prints the unit code, key and PIN 1234.

## Tests

```bash
cd app && npm run typecheck && npm test          # tsc + Vitest (domain: attendance, wage, stock, orders, export)
cd server && npm test                            # node --test on a throwaway Postgres schema
cd app && npm run test:e2e                       # Playwright (mobile 390×844 + desktop 1440); starts its own servers
```

## Deploy (Render)

`render.yaml` defines one web service (builds the app, runs the server which serves `app/dist` and `/api`) and one Postgres. Render → New → Blueprint → this repo, branch `mvp`. Then run the seed against the public URL:

```bash
BASE=https://<service>.onrender.com node server/seed-demo.mjs
```

Environment: `DATABASE_URL` (from the database), `BUNKAR_SECRET` (generated), `TRUST_PROXY=1`, `PORT` (Render sets it).

## Worker's own page

Each worker can see their own month, pay history, advances and profile on their phone, with nothing to remember:

- **Link (normal way):** owner or munshi opens the worker → "लिंक भेजें" → WhatsApp preview → the worker taps the link once. The page is then remembered on that phone (`/w`). "लिंक बंद करें" cancels it.
- **Shop code (fallback):** the worker opens `/w/join`, enters the 6-digit shop code (Settings), taps their name and enters the 4-digit worker code shown on their worker page.

The page never shows login/logout vocabulary; "यह मेरा फ़ोन नहीं है" in the profile forgets the phone. Owner and staff logins last a year unless they log out.

## Platform admin (founders)

`/admin` is the founders' console (SPEC-M18): every organisation with its industry, status and this month's use; create an organisation and invite its owner; switch modules; pause or resume; a changes log of every founder action. Founders see usage only, never an organisation's workers, wages, stock or entries. It needs admin keys on the server:

```bash
ADMIN_KEYS="shubham:<long-random-key>,pranjal:<long-random-key>" node index.mjs   # locally
```

On Render add the same `ADMIN_KEYS` environment variable. Without it the admin login answers 403 and no organisation can be created. Admin tokens are separate from unit logins and can never write a unit's records. Every unit request runs under Postgres row-level security as the limited role `bunkar_app` (created at start-up when the database user may create roles).

## How it works

Every entry is an append-only record written to the phone first (IndexedDB) and pushed to the server when online. Edits create a new record and reverse the old one, so the owner always sees who wrote what, when, and the old value. The server verifies the author, owner-only record types, locked months, duplicate wage payments and wage arithmetic.

Money is in integer paise; quantities in integer thousandths (grams for kg). Days are `YYYY-MM-DD` in Asia/Kolkata.
