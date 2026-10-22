# Bunkar MVP — Watching Logs (newest at bottom)

## 2026-10-23 — Project created; spec drafted for approval
- What: created `bunkar-mvp/` beside `BunkarOS/` with SPECS.md (SPEC-M00..M06 + decisions D1..D13), TASKS.md, AGENTS.md. No code yet.
- Why: user chose a fresh build limited to attendance, wages, inventory, orders, monthly analysis; MCQ answers recorded as decisions.
- Evidence: `ls bunkar-mvp` → AGENTS.md SPECS.md TASKS.md WATCHINGLOGS.md. Docker daemon OK (29.8.1), Node v24.22.0, remote Iampranjaldubey/BunkarOS reachable (main = ef25255).
- Next: user approves spec/assumptions → task 1 (scaffold + foundation).

## 2026-10-23 — M00 foundation built and verified; pushed to origin/mvp
- What: `app/` (React 19 + Vite 8 + TS + Tailwind v4 PWA, Dexie, 3-language i18n hi/hin/en, new teal/amber palette with dark scheme, responsive shell: bottom bar < lg, side rail ≥ lg), `server/` (Node 24 + pg, Postgres schema per env, rules: owner-only types, forged author, locked months, duplicate payment, staff reversal own-same-day, staff cannot change pay fields; static serving of app/dist), `docker-compose.yml` (Postgres 16). Screens: setup, login (PIN keypad), home stub, More, entry log (reverse with reason), settings (unit, language, theme, users, join code). Stand-in pages for M01–M05 routes.
- Why: SPEC-M00 approved; copied only PIN/session/sync/UI-kit foundation from BunkarOS (D1).
- Evidence: `npx tsc -p tsconfig.app.json --noEmit` → exit 0 · `npx vite build` → precache 53 entries / 1052 KiB · `cd server && node --test` → 12 pass / 0 fail · `npx playwright test` → 3 passed (mobile foundation ×2, desktop shell ×1). Fixed during verification: pg search_path race (now `options=-c search_path`), e2e schema reset moved into server boot (`PG_RESET=1`).
- Next: M01 workers + attendance.
