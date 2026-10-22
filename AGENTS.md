# Bunkar MVP — Agent Instructions

Phase 2 pilot build: attendance, wages, inventory, orders, monthly analysis for owner + munshi
at in-unit carpet shops in Bhadohi. Hindi-first, phone-first, offline-first PWA.
Reference (do not copy wholesale): `../BunkarOS` — only the foundation files listed in SPECS.md D1.

## Stack (locked)
React + Vite + TypeScript + Tailwind, hand-written shadcn-style UI kit, Dexie (IndexedDB) + service worker.
Server: Node 24 + `pg` (Postgres). Local Postgres via Docker; prod on Render (web service + Postgres).

## Workflow rules (binding)
a. Session start: read `TASKS.md` and the latest `WATCHINGLOGS.md` entries.
b. New feature: spec in `SPECS.md` → user approval → tasks in `TASKS.md`.
c. Keep `TASKS.md` current.
d. Append a `WATCHINGLOGS.md` entry after every meaningful action — What / Why / Evidence / Next.
e. Evidence before claims — never say done/passing without cited output.
f. Never commit / push / deploy without an explicit user "yes".

## Domain rules
Money in integer paise; quantities in integer thousandths; dates `YYYY-MM-DD` in Asia/Kolkata.
Red = money/stock given out, green = received. Preview-and-confirm before any WhatsApp share.
No SMS/contacts permissions.
