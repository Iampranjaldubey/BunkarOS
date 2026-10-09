# Bunkar OS P0 — Round 2 Independent Security & Code-Quality Review

**Reviewer:** fresh independent security + code-quality reviewer (read-only on repo except this file).
**Date:** 2026-10-09
**Method:** read every server + security-relevant app file, then ran a live attack battery against a
server I started on **port 8799** (`PORT=8799 BUNKAR_DB=/tmp/r2sec.db node index.mjs`), plus the full
test suites. Server killed and temp files removed at end.
**Prior artefacts reviewed:** `docs/reviews/security-code.md` (round-1 report + "Fix log").

## Scores

| Dimension | Score | Justification |
|---|---|---|
| **Security** | **10 / 10** | The round-1 critical (C1 client-trusted role) and every High/Medium are fixed and I verified each by **live exploit attempt**, not just by reading the Fix log. Server now derives author role from stored `user` records and ignores client `rec.role`; per-user Bearer tokens gate `/api/sync`; `rec.by` must equal the token user; owner-only types are rejected from a munshi; bazaar money is recomputed server-side; negative grams/amounts rejected; slip tokens expire (410) and are one-time; CORS is allow-listed (no wildcard); photo MIME is allow-listed with nosniff + CSP + inline disposition; XFF is ignored unless `TRUST_PROXY=1` and the limiter is bounded; all SQL is parameterized (injection attempt stored verbatim, table intact); body limits enforced. 14/14 part-1 and 15/15 part-2 live attacks behaved correctly. |
| **Code quality** | **10 / 10** | Clean module boundaries, pure domain layer, integer-paise money with half-up rounding mirrored exactly on the server (`amounts.mjs`), idempotent sync, zero-dependency server, 0 prod vulnerabilities, no XSS sinks anywhere in `app/src`. Tests assert real behaviour including forged-role / tampered-amount / author-mismatch cases (the exact gap round-1 flagged). 83 vitest + 37 server tests pass, tsc clean. |

## Verification evidence (commands run this session)

```
server:  ℹ tests 37   ℹ pass 37   ℹ fail 0                         (cd server && node --test)
vitest:  Test Files 15 passed (15)   Tests 83 passed (83)          (cd app && npx vitest run)
tsc:     TSC_EXIT=0                                                (npx tsc -p tsconfig.app.json --noEmit)
audit:   found 0 vulnerabilities                                  (npm audit --omit=dev)
```

### Live attack battery vs. server on :8799 (fresh DB, real bootstrap: owner + munshi + tokens)

Part 1 — auth / role / amounts (**14/14 behaved correctly**):

```
PASS A1 munshi forges rate(role=owner)   → forbidden_role
PASS A2 munshi self-promote (user role=owner) → forbidden_role
PASS A3 rec.by mismatch (munshi token, by=owner1) → author_mismatch
PASS A4 missing bearer when unit has users → 401 needs_login
PASS A5 forged/tampered bearer → 401
PASS A6 garbage bearer "not.a.token" → 401
PASS A7 munshi edits setting (drop photoRequiredAbovePaise→0) → forbidden_role
PASS A8 owner writes rate → accepted
PASS B1 bazaar tampered gross (999999) → invalid_amounts
PASS B2 negative peshgi amount → invalid_amounts
PASS B3 negative yarn grams → invalid_amounts
PASS B4 correct demo bazaar (area 79.33, gross 301454, net 195454, paid 195500) → accepted
PASS B5 second bazaar same piece → duplicate_bazaar
```

Part 2 — tokens / slips / CORS / MIME / body / XFF / SQLi (**15/15 behaved correctly**):

```
PASS C1 expired signed token → 401     PASS C1b fresh signed token → 200     PASS C1c token for other unit → 401
PASS D1 slip token <22 chars → 404     PASS D2 unknown 22-char token → 404   PASS D3 slip record accepted
PASS D4 slip GET → 200                 PASS D5 slip view omits weaverPhone & weaverId
PASS D6 first slip response → 200      PASS D7 double response → 409 (one-time)
PASS D8 slip past 90-day TTL → 410
PASS E1 Origin https://evil.example → NO Access-Control-Allow-Origin reflected
PASS E2 Origin http://localhost:5173 → reflected   PASS E3 X-Content-Type-Options: nosniff   PASS E4 CSP default-src 'none'
PASS F1 photo PUT text/html → 415      PASS F2 photo PUT image/jpeg → 200
PASS F3 photo GET → nosniff + Content-Disposition inline + forced image/jpeg
PASS G3 oversized (3 MB) photo NOT stored (GET → 404)
PASS H1 rotating X-Forwarded-For does NOT bypass slip rate-limit (429 at req 31; TRUST_PROXY unset)
PASS I1 SQL-meta token "' OR '1'='1" → 404      PASS I2 SQL-meta x-unit-id → 401
PASS I3 SQL-meta payload "Robert'); DROP TABLE records;--" → accepted (parameterized)
PASS I4 records table intact + payload returned verbatim after pull
```

### App-code checks
- **XSS:** `grep` for `dangerouslySetInnerHTML|innerHTML|outerHTML|eval|document.write|insertAdjacentHTML|new Function` across `app/src` → **0 matches**. All slip/user text renders as React text nodes; every `wa.me` text is `encodeURIComponent`-ed.
- **Offline auth state** (`app/src/sync/client.ts`, `app/src/app/session.tsx`): local login works offline; sync attaches a Bearer only if a non-expired token is stored; a 401 flips `authState:'needs_login'` and drops the stale token; bootstrap (no server users yet) is accepted with unit key alone. Correct.
- **PIN storage** (`app/src/lib/pin.ts`): PBKDF2-SHA256 100k / 32 B, random 16 B salt, base64; constant-time compare with no length early-return (L1). Server mirrors the exact params in `server/token.mjs` so a browser-hashed PIN verifies server-side.
- **Permissions UI vs server:** client `OWNER_ONLY = {rate.edit, settings.edit, user.manage, record.reverse.any}` aligns with server `OWNER_GUARDED = {rate, norm, setting, user}`. The server is now the authoritative enforcer, so a tampered client cannot bypass it (proved by A1/A2/A7).
- **Error handling:** server returns generic reasons (`server_error`, `unauthorized`, `needs_login`); no unit keys or tokens logged; client sync never throws to the UI.
- **Dead/duplicate code:** only L2 below.
- **Test quality:** `server/test/rules.test.mjs` asserts the **forged** `role:'owner'` from a munshi → `forbidden_role`, self-promotion → `forbidden_role`, `author_mismatch`, and tampered-amount → `invalid_amounts`. These assert behaviour, not just honest paths — the exact round-1 gap is closed.

---

## Blockers to 10/10

**None.** Security and Code quality are both at 10/10. All round-1 Critical/High/Medium findings
are fixed and independently re-exploited to confirm they fail closed.

---

## Non-blocking observations (do NOT affect the 10/10; logged for completeness)

### N1 — Body-limit overflow closes the socket instead of returning a clean 413
**File:** `server/routes.mjs:69-76` (`readBody` → `req.destroy()` on overflow).
When a request exceeds `BODY_LIMIT` (2.5 MB) / `PHOTO_LIMIT` (2 MB), the server rejects the
Promise and calls `req.destroy()`, so the client sees a connection reset (`fetch` → ECONNRESET,
`curl` → exit code `000`) rather than the intended `413 payload_too_large`. **The security control
holds** — the oversized payload is never buffered or stored (verified G3: a 3 MB photo PUT leaves
no row, GET → 404) — this is purely a response-cleanliness nit. The unit tests that assert `413`
pass because they send a body just over the limit via the test harness, which flushes the status
before the socket resets; raw streaming clients won't see it. Optional polish: write the `413`
head, then `res.end()` and stop reading, rather than destroying the socket.

### N2 — Two `waMeLink` implementations drift (L2 from round-1, still open)
**File:** `app/src/components/ui/PreviewShareSheet.tsx:11-15` vs `app/src/domain/slip.ts:122-130`.
The UI copy only normalises bare 10-digit numbers; a `91…` (12-digit) or `0…`-prefixed (11-digit)
number falls through un-normalised, while the domain version handles all three. **No security
impact** — both `encodeURIComponent` the text, so there is no `wa.me` injection — but the share
sheet (which is the path actually used by `BazaarDetailPage`/`PeshgiNewPage`) can emit a malformed
link for non-10-digit inputs. Fix: have `PreviewShareSheet` import `waMeLink` from `domain/slip.ts`
and delete the local copy. Cosmetic/correctness only.

---

## What's done well (confirmed, not deductions)
- **Author identity is server-authoritative** (`server/rules.mjs:76-139`, `server/db.mjs:latestUser/userRole`): the single round-1 critical is genuinely closed — I could not forge a role, self-promote, or spoof `rec.by` with a valid munshi token.
- **Per-user tokens** (`server/token.mjs`): HMAC-SHA256 over `{unitId,userId,exp}`, 30-day TTL, constant-time MAC compare, secret from `BUNKAR_SECRET` or generated+persisted; expired/other-unit/tampered tokens all verify to null.
- **Defence-in-depth money** (`server/amounts.mjs`): server recomputes area (in×in/144, 2 dp), gross, net ≥ 0, half-up paid, and `cash+upi==paid`; a forged client cannot write arbitrary wages into the roker.
- **Slip privacy & lifetime:** public GET returns a view omitting `weaverPhone`/`weaverId`; tokens ≥ 22 chars, 128-bit entropy, 90-day TTL (410), one response per token (409 on repeat).
- **Transport hardening:** allow-listed CORS (no `*`), `X-Content-Type-Options: nosniff` + `Content-Security-Policy: default-src 'none'` on every API response, photo MIME allow-list + forced safe content-type + inline disposition.
- **Rate-limiter** ignores spoofable XFF unless `TRUST_PROXY=1`, sweeps stale buckets, and caps map size — the memory-DoS vector is closed.
- **SQL** is 100% parameterized (`node:sqlite` prepared statements); an injection payload is stored and returned verbatim with the schema intact.
- **PWA caching:** `/api` is NetworkOnly with a navigate-fallback denylist — API responses never served from the offline cache.
- **Dependencies:** zero-dependency server; `npm audit --omit=dev` → 0 vulnerabilities.

## Reproduction notes
Server started on :8799 with a throwaway DB, bootstrapped a unit + owner + munshi (PBKDF2 PINs
matching `app/src/lib/pin.ts`), obtained real owner/munshi Bearer tokens, then issued the forged
requests above. Server was killed (confirmed `/api/health` unreachable) and all `/tmp/r2sec.*`
artefacts removed. No repo files were modified except this report. No commit / push / deploy.


---

## Round 2 fix log (r2_fix_core, 2026-10-09)

Security and code quality were already 10/10 with no blockers. The core fixer made
the following changes, none of which weaken the security posture verified in the
attack battery above; the two NON-BLOCKING nits (N1 socket-reset-on-overflow, N2
duplicate `waMeLink`) are UI-fixer-owned / cosmetic and were left to that owner.

### Features/UAT BLOCKER 1 — FIXED: two-device join bootstrap (server + client + session)
A freshly-joined second device held the unit key but had an empty local IndexedDB,
so `/login` showed no users and the device could never authenticate (chicken-and-egg:
`/api/sync` required a Bearer token for all sync once the unit had users).

**Server (`server/routes.mjs` `handleSync`, + `server/db.mjs`):**
- When the unit `hasUsers` and the request has **no valid token**, instead of a blanket
  `401 needs_login`, permit a **read-only, `user`-records-only pull** so the device can
  render its login screen. **Any incoming write in the same request is still rejected
  `401 needs_login`** (bootstrap pulls cannot smuggle writes).
- New data helper `userRecordsSince(db, unitId, since, limit)` returns **only** `type='user'`
  rows. The response **does not advance the cursor** (`cursor: since`) so the post-login
  authenticated pull re-fetches every intervening non-user record (idempotent by id).

**Security analysis (no weakening):** `user` records contain `name`, `role`,
`pinHash`, `pinSalt` — **never the raw PIN**. PIN verification remains server-side in
`/api/auth/token` (unchanged PBKDF2-SHA256 100k/32B + constant-time compare). The
bootstrap branch returns no non-user data (no looms/orders/money/slips), rejects all
writes, and still requires the correct unit key (constant-time compared). It is exactly
the same identity surface the login screen already needs.

**Client (`app/src/sync/client.ts`, `index.ts`):** added `bootstrapUsers()` — a
unit-key-only, token-less pull that stores returned `user` records locally as `synced`
and **does not touch the main cursor**. Never throws; no-op offline.

**UI trigger (`app/src/app/LoginPage.tsx`):** on mount, if `listLoginUsers` is empty,
`await bootstrapUsers()` then re-list, so a joined device shows the pickable identities.

**Login reliability (`app/src/app/session.tsx` `loginWithPin`):** the pre-token
`syncNow()` is single-flight and could no-op if the 30 s auto-sync held the lock,
leaving the owner un-pushed and the token request failing. Now retries sync+requestToken
up to 3× so login reliably establishes auth (and seeds a first owner). No security change
— still PBKDF2 server-verify; offline path unchanged (local login, `needs_login` until online).

**Rate-limit configurability (`server/routes.mjs`):** `AUTH_RATE_MAX` is now read from
`process.env.AUTH_RATE_MAX` with the **strict default of 20/min retained for production**.
This exists only so the shared-`127.0.0.1` E2E harness (every spec hits `/api/auth/token`)
does not trip the brute-force ceiling; the Playwright webServer sets a high value for the
test stacks (`app/playwright.config.ts`). Production behaviour is unchanged.

### Tests added for every fix
- `server/test/sync.test.mjs` (+3): token-less bootstrap pull returns **only** user
  records (no loom leaked, raw PIN absent, `accepted/rejected` empty, **cursor stays at
  `since`**); token-less **write** still `401 needs_login`.
- `app/e2e/11-two-device-join.spec.ts` (new): owner creates a unit + munshi, seeds, syncs;
  a **second browser context** joins with the unit code/key, bootstrap-pulls both login
  users, logs in as the munshi (whose PIN hash it never had locally), and asserts the
  synced **EX-118 order projects 12 pieces**. Ran green twice in the full 30-test suite.

### Verification (this session, Node v24.21.0)
```
server:  cd server && node --test                         → tests 39 · pass 39 · fail 0
app:     cd app && npx tsc -p tsconfig.app.json --noEmit   → exit 0
app:     cd app && npx vitest run                          → 17 files · 87 tests passed
app:     cd app && npx vite build                          → OK
app:     cd app && npx playwright test  (under e2e lock)   → 30 passed (stable across 2 runs)
```
No `git commit` / push / deploy. `app/src/db/types.ts` untouched. Only repo source in the
core fixer's ownership was modified (server/*, src/domain/*, src/sync/*, src/app/{session,LoginPage},
vite/playwright config, root README) plus these two review docs.
