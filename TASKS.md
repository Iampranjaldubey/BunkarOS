# Bunkar MVP — Task Board

Status: TODO · DOING · BLOCKED · DONE. Spec ids in `SPECS.md`. Evidence required before DONE.

## Now
- All of M00–M06 built and verified (2026-10-23). Not yet deployed to Render: needs the user to connect the repo in the Render dashboard (render.yaml is ready). Since 2026-10-31, `main` = `mvp` (7a1cc1a): the old SQLite-based BunkarOS main was replaced by force-push at the user's request. Render can deploy from either branch.
- Open items: real-device check on an Android phone; partner data entry; pilot usage review via /month → "ऐप का इस्तेमाल".

## Build sequence (after approval)
| # | Spec | Deliverable | Status | Evidence |
|---|---|---|---|---|
| 1 | M00 | Scaffold app + server + docker compose; copy foundation files; types; sync; login/setup; shell; i18n; photos | DONE | tsc 0 · build OK · server 12/12 · e2e 3/3 (2026-10-23) |
| 2 | M01 | Workers + attendance screens, domain, tests | DONE | vitest attendance 4/4 · e2e 02-workers-attendance 2/2 (2026-10-23) |
| 3 | M02 | Advances, wage engine, settlement, slip, lock | DONE | vitest wage 5/5 (AC1 exact) · e2e 03-wages 1/1 (2026-10-23) |
| 4 | M03 | Items, stock in/out/adjust, finished stock | DONE | commit 4d625a9 · vitest stock 3/3 · e2e 04-stock 1/1 (re-verified 2026-11-01) |
| 5 | M04 | Buyers, orders, status, deliveries | DONE | vitest orders 2/2 · e2e 05-orders 1/1 (2026-10-23) |
| 6 | M05 | Dashboard, monthly analysis, xlsx export, print | DONE | vitest export 1/1 · e2e 06-dashboard-month 1/1 incl. real .xlsx download (2026-10-23) |
| 7 | M06 | render.yaml, seed demo, README, e2e green | DONE | seed 93 accepted / 0 rejected · full e2e 11/11 · vitest 15/15 · server 12/12 · build precache 90 / 1205 KiB (2026-10-23) |
| 8 | — | Git: branch `mvp` on Iampranjaldubey/BunkarOS (remote pinned to ShubhamKang account) | DONE | pushes 0be160f…9b9cc90 + final |

## Round 2 (approved 2026-10-23)
| # | Spec | Deliverable | Status | Evidence |
|---|---|---|---|---|
| 9 | M07 | Server: short_code, worker_links, /api/worker-links, /api/w/* + tests | DONE | server 16/16 (worker-links 4 new) |
| 10 | M07 | App: /w routes, worker page (month, pay history, advances, profile), owner "send link", access code | DONE | e2e 07-worker-page 1/1 (link, shop code, reload, revoke) |
| 11 | M08 | One-year tokens; UI polish (home, forms, lists, login/setup) | DONE | full e2e 12/12 · screenshots reviewed |
| 12 | M09 | Platform admin: ADMIN_KEYS login, /api/admin/*, /admin pages | DONE | server admin.test 4/4 (20/20 total) · e2e 08-admin 1/1 (13/13 total) |

## Round 3 (user goal 2026-11-01, branch `desktop-first`, not committed)
| # | Spec | Deliverable | Status | Evidence |
|---|---|---|---|---|
| 13 | — | Full test run on the new main; fix date-dependent e2e (03, 07) | DONE | tsc 0 · vitest 17/17 · server 20/20 · e2e 13/13 |
| 14 | M10 | Holidays editor (Settings), holiday note on attendance, orders sheet in Excel (5 sheets), TASKS M03 status | DONE | vitest dashboard 4/4 + export 1/1 · e2e 09-holidays 1/1 · full e2e 14/14 |
| 15 | M11 | PIN hashes never sent to phones; user edits keep the stored hash; photos need a login; login checked by the server, offline only with this phone's verifier | DONE | server security.test 6/6 (26/26) · vitest session 8/8 (29/29) · seed 31 accepted / 0 rejected · full e2e 14/14 |
| 16 | — | docs/ARCHITECTURE.md (features, schema, API, rules) | DONE | 213 lines; versions, routes, rules and formulas checked against package.json, routes.mjs, rules.mjs, domain/* |
| 17 | M12 | Desktop-first UI/UX, phone keeps working | DONE | tsc 0 · build OK · vitest 9 files / 33 (incl. contrast AA both themes) · server 26/26 · e2e 27/27 twice (12 mobile + 15 desktop; 01–09 in both projects, new 22-desktop-ux, sweeps 1024/1440/1920 + 390/768 × 3 languages, 44 px target audit) · screenshots docs/screenshots/m12/after (4 widths × 19 routes, 0 overflow, 0 page errors) |
| 18 | — | Commit branch `desktop-first` | DONE | commit fcacb46 on desktop-first (190 files, +2974/−233); push waits for the user (agent config denies `git push`) |
| 19 | — | docs/audit.md: code vs product brief, fix list in §9 order | DONE | 367 lines; probe of 5 server gaps; checks in audit §17 |
| 20 | — | Owner decisions D-001 overtime setting, D-002 paid off days (provisional), D-003 A4 slip → docs/decisions.md + SPECS D2/D12/M02 + brief updated; DM-001..003 recorded as needs confirmation | DONE | docs only, no code; AC5/AC6 numbers checked by script (₹9,846; off days 8, 9, 15, 29 → ₹9,000) |
| 21 | M02 | Implement D-001, D-002, D-003 | TODO | needs a plan; specs are now in SPECS.md M02 |
| 22 | — | Product direction (D15): brief "Product direction" section; decisions P-000, D-001…D-006, DM-004; SPECS D2, M00, M02, M03, M04, M13, M14, M15 | DONE | docs only, no code; override and off-day example amounts checked by script |
| 23 | M13 | Unit settings (overtime, off-day policy, slip sections) + operator permission toggles | TODO | needs a plan; replaces row 21's setting work |
| 24 | M14 | Owner override on any wage line, with a reason | TODO | needs a plan |
| 25 | M15 | Finished carpet catalogue | TODO | needs a plan; decide DM-004 first |

## Blocked
- Push to GitHub: needs the user's "yes" and ShubhamKang write access on Pranjal's repo (Git Credential Manager will prompt in the browser).
