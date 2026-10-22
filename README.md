# Bunkar MVP

Hindi-first, phone-first, offline-capable PWA for small carpet units in Bhadohi: **attendance, wages, inventory, orders and a monthly report**, for the owner and the munshi (staff). Phase 2 pilot build for the Sitare University Startup Program (Group 34).

- `app/` — React 19 + Vite 8 + TypeScript + Tailwind v4, Dexie (IndexedDB) + service worker. Three languages: हिंदी · Hinglish · English. Light and dark.
- `server/` — Node 24 + Postgres (`pg`). Append-only records, server-side rules, serves the built app.
- Specs and decisions: `SPECS.md`. Task board: `TASKS.md`. Log of every step: `WATCHINGLOGS.md`.

## Run locally

```bash
docker compose up -d db            # Postgres 16 on :5432 (bunkar/bunkar)
cd server && npm ci && npm start   # API on http://localhost:8791
cd app && npm ci && npm run dev    # app on http://localhost:5174 (proxies /api → :8791)
```

First open → **create a unit** (name, owner, 4-digit PIN). Add staff in Settings. A second phone joins with the unit code + key from Settings.

### Demo data

```bash
cd server && node seed-demo.mjs    # prints unit code, key and PIN 1234
```

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

## How it works

Every entry is an append-only record written to the phone first (IndexedDB) and pushed to the server when online. Edits create a new record and reverse the old one, so the owner always sees who wrote what, when, and the old value. The server verifies the author, owner-only record types, locked months, duplicate wage payments and wage arithmetic.

Money is in integer paise; quantities in integer thousandths (grams for kg). Days are `YYYY-MM-DD` in Asia/Kolkata.
