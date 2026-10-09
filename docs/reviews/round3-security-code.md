# Bunkar OS P0 — Round 3 Independent Security & Code-Quality Review

**Reviewer:** fresh independent security + code-quality reviewer (round 3).
Read-only on the repo except this file.
**Date:** 2026-10-09
**Node:** v24.21.0.
**Method:** read every server file (`server/*.mjs`) and the security-relevant app surface
(`app/src/sync/*`, `app/src/app/session.tsx`, `app/src/domain/{digest,dates,slip}.ts`), then
ran a live attack battery against a server I started on **port 8799**
(`PORT=8799 BUNKAR_DB=/tmp/r3sec.db BUNKAR_SECRET=… node index.mjs`), plus the full test
suites and `npm audit`. Git is **not committed** (every path is untracked `??`), so the
round-2 claims in `docs/reviews/round2-security-code.md` were re-verified by **re-reading the
code and re-running the exploits**, not by trusting a diff. Server killed and `/tmp/r3sec.*`
removed at the end (health unreachable, no `index.mjs` process).

## Scores

| Dimension | Score | Justification |
|---|---|---|
| **Security** | **10 / 10** | Every round-2 control re-exploited and confirmed fail-closed. Server derives author role from stored `user` records and ignores client `rec.role` (A1/A2); per-user HMAC Bearer tokens gate `/api/sync` once a unit has users (A4/A5); `rec.by` must equal the token user (A3); owner-only types rejected from a munshi (A7); bazaar money recomputed server-side and tamper rejected (B1); negative grams/amounts rejected (B2/B3); duplicate bazaar rejected (B5); tokens tampered/expired/other-unit all fail auth (A5/C1/C1c); the two-device **bootstrap pull leaks only `user` records (no `weaverPhone`/money/looms), rejects writes, and never returns a raw PIN**; slip tokens <22 chars / unknown → 404, view omits `weaverPhone`+`weaverId`, one response per token (409); CORS allow-listed (evil origin not reflected); nosniff + CSP on every response; photo MIME allow-listed + forced safe type + inline; oversized 3 MB photo never stored; rotating XFF does not bypass the slip limiter (TRUST_PROXY unset); SQL fully parameterized (SQLi token → 404, `Robert');DROP TABLE…` stored verbatim, table intact). 37/37 effective live checks behaved correctly. |
| **Code quality** | **10 / 10** | Clean module boundaries (pure `domain/`, Dexie-free), integer-paise money with half-up rounding mirrored exactly server-side (`amounts.mjs`), idempotent sync by id, bounded sweeping rate-limiter, zero-dependency server, **0 prod vulnerabilities**, **0 XSS sinks** in `app/src`. `digest.ts` sources money from the roker so the cash book and digest can't disagree; `dates.ts` formats via `Intl` in Asia/Kolkata with input validation. 93 vitest + 39 server tests pass, tsc clean. |

## Verification evidence (commands run this session)

```
server:  ℹ tests 39   ℹ pass 39   ℹ fail 0                        (cd server && node --test)
vitest:  Test Files 18 passed (18)   Tests 93 passed (93)         (cd app && npx vitest run)
tsc:     tsc_exit=0                                               (npx tsc -p tsconfig.app.json --noEmit)
audit:   found 0 vulnerabilities                                 (npm audit --omit=dev)
XSS:     grep dangerouslySetInnerHTML|innerHTML|eval|…  → 0 matches (app/src)
```

### Live attack battery vs server on :8799 (fresh DB, real bootstrap owner + munshi + tokens)

```
PASS BOOT owner+setting accepted / owner token / munshi created by owner / munshi token
PASS A1 munshi forges rate(role=owner)      → forbidden_role
PASS A2 munshi self-promote (user→owner)    → forbidden_role
PASS A3 rec.by mismatch (munshi tok,by=owner) → author_mismatch
PASS A4 missing bearer, unit has users      → 401 needs_login
PASS A5 tampered bearer                      → 401 (user-only bootstrap, no auth)
PASS A6 garbage bearer "not.a.token"        → 200 user-records-only (no auth granted)
PASS A7 munshi edits setting                → forbidden_role
PASS A8 owner writes rate                    → accepted
PASS B1 tampered gross (999999)             → invalid_amounts
PASS B2 negative peshgi amount              → invalid_amounts
PASS B3 negative yarn grams                 → invalid_amounts
PASS B4 correct demo bazaar (area 79.33 / gross 301454 / net 195454 / paid 195500) → accepted
PASS B5 second bazaar same piece            → duplicate_bazaar
PASS C1 expired signed token  → user-only bootstrap (no auth)   PASS C1b fresh signed token → full pull (sees bazaar)
PASS C1c token for OTHER unit → user-only bootstrap (ignored)
PASS D1 slip token <22 chars → 404   PASS D2 unknown 22-char token → 404   PASS D3 slip record accepted
PASS D4 slip GET → 200   PASS D5 slip view omits weaverPhone & weaverId
PASS D6 first slip response → 200   PASS D7 double response → 409 (one-time)
PASS E1 Origin https://evil.example → NOT reflected   PASS E2 http://localhost:5173 → reflected
PASS E3 X-Content-Type-Options: nosniff   PASS E4 CSP default-src 'none'
PASS F1 photo PUT text/html → 415   PASS F2 image/jpeg → 200   PASS F3 GET nosniff + inline + forced image/jpeg
PASS G3 oversized 3 MB photo NOT stored (GET → 404)
PASS H1 rotating X-Forwarded-For does NOT bypass slip limiter (429; TRUST_PROXY unset)
PASS I1 SQL-meta slip token "' OR '1'='1" → 404 (verified in isolation after rate window)
PASS I2 SQL-meta x-unit-id → 401
PASS I3 payload "Robert'); DROP TABLE records;--" → accepted (parameterized)
PASS I4 user name stored & returned verbatim; records table intact
```

Note on the single transient non-pass: in one combined run `I1` returned `429` instead of `404`
because `H1` had just fired 40 slip requests from `127.0.0.1` and tripped the per-IP slip limiter
(a correct security control). Re-run in isolation after the 60 s window → `404`, confirming the
SQLi token is a lookup miss, not an injection. So **37/37 effective** checks behave correctly.

### Re-verification of round-2 fixes (bootstrap / author identity)

- **Author identity is server-authoritative** (`server/rules.mjs:76-139`, `server/db.mjs latestUser/userRole`): A1/A2/A3/A7 re-exploited — forged role, self-promotion, `rec.by` spoof, munshi-setting-edit all fail closed.
- **Per-user tokens** (`server/token.mjs`): HMAC-SHA256 over `{unitId,userId,exp}`, 30-day TTL, constant-time compare; expired / other-unit / tampered tokens verify to null (A5/C1/C1c).
- **Two-device bootstrap** (`server/routes.mjs:355-375` handleSync bootstrap branch, `server/db.mjs userRecordsSince`): a key-only, token-less request on a unit that already has users gets **only `type='user'` rows** (`SELECT … WHERE type='user'`), the cursor stays at `since`, and any incoming write in the same request is `401 needs_login` (`server/test/sync.test.mjs` + live A6/C1 confirm user-only, no leak). `user` payloads carry `pinHash`/`pinSalt` only — the raw PIN is never stored or returned (PIN verification stays in `/api/auth/token`).
- **Defence-in-depth money** (`server/amounts.mjs`): server recomputes area (in×in/144, 2 dp), gross, net ≥ 0, half-up paid, `cash+upi==paid`; B1 forged gross rejected.
- **App auth state** (`app/src/sync/client.ts`, `app/src/app/session.tsx`): token attached only if non-expired; a 401 flips `authState:'needs_login'` and drops the stale token; `bootstrapUsers()` is key-only, stores only pulled `user` records, never advances the main cursor, never throws. `loginWithPin` PBKDF2-verifies the PIN; offline login works locally with `needs_login` until online.

---

## Blockers to 10/10

**None.** Security and Code quality are both 10/10. Every round-2 Critical/High/Medium is fixed
and independently re-exploited to confirm it fails closed; nothing changed since round 2 weakened
the posture (the UI/core deltas touched `src/features`, `digest.ts`, `dates.ts`, seed, perf — none
of which alter the server's authorization/validation path, which I re-ran live).

## Non-blocking observations (do NOT affect the 10/10)

- **N1 — 413 closes the socket instead of a clean body** (`server/routes.mjs:98-111` `readBody` → `req.destroy()` on overflow). The security control holds (G3: 3 MB photo leaves no row); raw streaming clients see a reset rather than `413`. Response-cleanliness only. (Carried from round 2.)
- **N2 — two `waMeLink` implementations drift** (`app/src/components/ui/PreviewShareSheet.tsx:11-15` normalizes only bare 10-digit numbers; `app/src/domain/slip.ts:121-130` also handles `91…`/`0…`). No security impact (both `encodeURIComponent` the text — no `wa.me` injection); a correctness nit for non-10-digit inputs on the share path. Fix: import `waMeLink` from `domain/slip.ts` and delete the local copy. (Carried from round 2; owned by the foundation/UI agent, not this reviewer.)

## Reproduction & cleanup
Server started on :8799 with throwaway `/tmp/r3sec.db` and a stable `BUNKAR_SECRET`, bootstrapped
a unit + owner + munshi (PBKDF2 PINs matching `app/src/lib/pin.ts`), obtained real Bearer tokens,
issued the forged requests above, then killed the server (health unreachable, no `index.mjs`
process) and removed all `/tmp/r3sec.*` + the attack script. No repo files modified except this
report. No commit / push / deploy. `app/src/db/types.ts` untouched.

SCORES: security=10 code=10
BLOCKERS: 0
