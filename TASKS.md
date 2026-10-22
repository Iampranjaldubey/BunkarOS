# Bunkar MVP — Task Board

Status: TODO · DOING · BLOCKED · DONE. Spec ids in `SPECS.md`. Evidence required before DONE.

## Now
- All of M00–M06 built and verified (2026-10-23). Not yet deployed to Render: needs the user to connect the repo in the Render dashboard (render.yaml is ready). Branch `mvp` is not merged to main (open a PR when ready; contributions graph counts only after merge).
- Open items: real-device check on an Android phone; partner data entry; pilot usage review via /month → "ऐप का इस्तेमाल".

## Build sequence (after approval)
| # | Spec | Deliverable | Status | Evidence |
|---|---|---|---|---|
| 1 | M00 | Scaffold app + server + docker compose; copy foundation files; types; sync; login/setup; shell; i18n; photos | DONE | tsc 0 · build OK · server 12/12 · e2e 3/3 (2026-10-23) |
| 2 | M01 | Workers + attendance screens, domain, tests | DONE | vitest attendance 4/4 · e2e 02-workers-attendance 2/2 (2026-10-23) |
| 3 | M02 | Advances, wage engine, settlement, slip, lock | DONE | vitest wage 5/5 (AC1 exact) · e2e 03-wages 1/1 (2026-10-23) |
| 4 | M03 | Items, stock in/out/adjust, finished stock | TODO | |
| 5 | M04 | Buyers, orders, status, deliveries | DONE | vitest orders 2/2 · e2e 05-orders 1/1 (2026-10-23) |
| 6 | M05 | Dashboard, monthly analysis, xlsx export, print | DONE | vitest export 1/1 · e2e 06-dashboard-month 1/1 incl. real .xlsx download (2026-10-23) |
| 7 | M06 | render.yaml, seed demo, README, e2e green | DONE | seed 93 accepted / 0 rejected · full e2e 11/11 · vitest 15/15 · server 12/12 · build precache 90 / 1205 KiB (2026-10-23) |
| 8 | — | Git: branch `mvp` on Iampranjaldubey/BunkarOS (remote pinned to ShubhamKang account) | DONE | pushes 0be160f…9b9cc90 + final |

## Blocked
- Push to GitHub: needs the user's "yes" and ShubhamKang write access on Pranjal's repo (Git Credential Manager will prompt in the browser).
