# SPEC-M18 scorecard

Goal set by the owner (2026-11-06): the multi-tenant version, scored independently on every metric, **10/10 on each**. Each metric below is 10 only when every check in its row passes, with evidence (a command output, a test name or a screenshot). One failed check = not 10. An independent reviewer (a sub-agent that did not write the code) scores it from the evidence and the screens; I don't score my own work.

| # | Metric | 10/10 means every one of these passes |
|---|---|---|
| 1 | Features | SPEC-M18 AC1–AC11 each pass, with a named test. Every item in §1–§8 of the spec is built: founders create, invite, resend, cancel, switch modules, pause, read the changes log, see usage; an owner joins with link or code; modules hide screens and are refused by the server; bags pack v0 shows bag words, job titles, materials, sizes in cm, the drawn bag and the stitch line. |
| 2 | Tenant isolation and security | Unit queries run under row-level security as a role without bypass (test AC1). Forged cross-unit insert refused by the database. Founders never receive records, amounts or worker codes (admin test). Invites stored as hashes, single use, expire, rate-limited. Admin tokens refused by unit endpoints. Changes log cannot be deleted by the app role. |
| 3 | Correctness and regression | typecheck 0; lint 0 errors and no new warnings against the baseline (55); Vitest all pass; server all pass; the full Playwright suite passes in both projects with only `fixtures.ts` and the founders' spec (08) changed; carpet behaviour unchanged. |
| 4 | UI/UX quality (unslop) | The unslop checklist passes on every new screen (founders' console list, wizard, organisation tabs, packs page; join page; paused banner; modules card) and on the bags variant of Home, catalogue and login. No slop sign from `references/signs.md` found in a fresh audit. New screens use the existing kit and tokens (no new colours, no new radii, no hover lift, no pills, no emoji, no exclamation marks). |
| 5 | Usability | Founder can create a bags organisation in 3 steps without help text outside the screen; owner joins in ≤ 4 screens from the link; turning a module off shows its effect before saving; every refusal (module off, paused, invite used / expired) has a plain sentence, never a raw code. |
| 6 | Accessibility | Contrast test passes for all pairs in both themes; 44 px targets on desktop and 48 px on phones on the new screens (target audit extended to the new routes); every control has an accessible name; reduced motion turns animation off; no horizontal overflow at 390 / 768 / 1024 / 1440 / 1920 on the new routes in three languages. |
| 7 | Language | Every new visible string exists in hi, hin and en (no key shown raw); bags vocabulary covers every screen where carpet words appear; new Hindi listed for proofreading. Founders' console in English (decision 4A). |
| 8 | Offline | An entry made offline before its module is turned off is refused on reconnect with a readable reason; a paused unit keeps its pending entries and pushes them when active again; the last known organisation is used when the app starts offline. |
| 9 | Performance | Added JS ≤ 30 KB gzipped against the SPEC-M17 build (531 KB); founders' console code loads only on `/admin`; no new font files. |
| 10 | Docs and process | SPECS, TASKS, decisions, WATCHINGLOGS and README updated; demo seed works with the invite path; nothing committed or pushed without the owner's yes. |

## Result (2026-11-06)

Scored by an independent reviewer sub-agent from the saved evidence (`/tmp/m18-evidence/`), the code and 64 screenshots in `docs/screenshots/m18/`. All ten metrics: **10/10**. Unslop findings on the new screens: none.

| # | Metric | Score | Key evidence |
|---|---|---|---|
| 1 | Features | 10 | server platform.test AC1–AC6; e2e 14 AC7–AC9 in both projects |
| 2 | Isolation and security | 10 | row-level security (role `bunkar_app`, FORCE fallback probed with a plain role); forged insert refused; invites hashed, single use, 7 days; founders get usage only |
| 3 | Correctness | 10 | tsc 0; lint 0 errors / 55 warnings; vitest 81/81; server 46/46; e2e 54/54 |
| 4 | UI/UX (unslop) | 10 | no slop sign on console, join, paused, module-off or bags screens |
| 5 | Usability | 10 | 3-step wizard; effect shown before saving modules; refusals as sentences |
| 6 | Accessibility | 10 | contrast test; e2e 15 sweep: 44 / 48 px, no overflow, 3 languages |
| 7 | Language | 10 | m18 strings in hi / hin / en; no carpet word on 18 bags routes × 3 languages |
| 8 | Offline | 10 | org.test (offline start); e2e 14 offline entry refused after module off |
| 9 | Performance | 10 | JS +13.9 KB gz; console in lazy chunks; no new fonts |
| 10 | Docs and process | 10 | SPECS, TASKS, decisions, README, WATCHINGLOGS; nothing committed |

Clarifications from the review:
- Lint baseline: 53 → 55 happened in SPEC-M15 (+3 lazy routes, −1 removed effect; `docs/run-summary.md`). The count was 55 before SPEC-M17 started and is 55 now, so SPEC-M17 and M18 added none.
- Files changed besides `fixtures.ts` and spec 08: `playwright.config.ts` (the invite rate limit for the test server), `index.html` (theme colour, SPEC-M17), spec 20's 44 px audit now covers switches, and a fix for a focus race in the shared attendance screen with its regression test (`e2e/23-desktop-focus-race.spec.ts`: fails without the fix, passes 3/3 with it). Carpet behaviour is unchanged: specs 01–13 and 20–22 pass as before.
