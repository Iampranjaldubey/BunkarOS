# Bunkar OS P0 — Independent Security & Code-Quality Review

**Reviewer role:** independent security + code-quality reviewer (read-only).
**Date:** 2026-10-09
**Scope:** `server/` (API), `app/src/sync/`, `app/src/lib/pin.ts`, `app/src/app/session.tsx`,
`app/src/domain/*`, `app/src/db/*`, public slip page, PWA config.

## Scores

| Dimension | Score | One-line justification |
|---|---|---|
| **Security** | **4 / 10** | Append-only model, PBKDF2 PINs, scrypt+timing-safe unit keys, parameterized SQL and a token-length gate are solid — but the sync endpoint trusts the client-supplied `role`/`by` fields, so any authenticated munshi device can forge owner-only records (rate/setting/user) and self-promote. That single flaw collapses the whole role model. |
| **Code quality** | **8 / 10** | Clean module boundaries, pure domain layer, integer-paise money math with half-up rounding, idempotent sync, zero-dependency server, 0 npm vulnerabilities, strong tests. Deductions are for the role-trust gap, a pull-cursor advancement bug, and unbounded in-memory maps. |

## Verification evidence (commands run this session)

```
$ cd app && npx vitest run
 Test Files  14 passed (14)
      Tests  74 passed (74)                      exit 0

$ cd server && node --test
ℹ tests 17   ℹ pass 17   ℹ fail 0               exit 0

$ cd app && npx tsc -p tsconfig.app.json --noEmit
TSC_EXIT=0                                        (no output → clean)

$ cd app && npm audit --omit=dev
found 0 vulnerabilities                           AUDIT_EXIT=0
```

All suites green, types clean, no prod dependency vulnerabilities. The findings
below are logic/design defects the existing tests do not cover (notably the role
tests only exercise an honest `role` value, never a forged one).

---

## CRITICAL

### C1 — Server trusts client-supplied `role`; munshi can forge owner records & self-promote
**File:** `server/rules.mjs:60-66` (also `:44-48`, and author field in `server/routes.mjs:198-210`)

```js
// rules.mjs:60
if (OWNER_GUARDED.has(rec.type)) {
  const hasUsers = latestUserRole(db, headerUnitId) > 0;
  const bootstrap = !hasUsers;
  if (!bootstrap && rec.role !== 'owner') return { ok: false, reason: 'forbidden_role' };
  return { ok: true };
}
```

The guard checks `rec.role` — a field that is part of the **client-generated record body**
(`app/src/db/types.ts:22`, filled by `addRecord` from the local session at
`app/src/db/repo.ts:36`). The server never looks up the author's *actual* role from the
unit's `user` records. `latestUserRole` (rules.mjs:44) is misleadingly named: it returns a
**count** of user records, used only to detect bootstrap, not the author's role.

**Exploit scenario:** A munshi has valid unit credentials (`x-unit-id` + `x-unit-key`) because
every device in a unit shares the same key (see H1). The munshi crafts a sync POST with a
record `{type:'user', role:'owner', payload:{entityId:<self>, role:'owner', ...}}`. The guard
sees `rec.role === 'owner'` and accepts it. The munshi is now an owner on next pull. The same
forgery accepts arbitrary `rate` edits (money impact) and `setting` edits (e.g. drop
`photoRequiredAbovePaise` to 0, disabling the M5/D4 photo-evidence requirement) — all
attributable in the audit log to a forged author. The entire N2 permission model is
client-side-only against a motivated insider.

**Exact fix:** Derive the author's role on the server from stored state, ignore `rec.role` for
authorization. In `evaluate`, resolve the author id (`rec.by`) to the latest non-reversed
`user` record for that unit and read *its* `role`:

```js
function authorRole(db, unitId, by) {
  const rows = recordsOfType(db, unitId, 'user');     // ordered by seq asc
  let role;
  for (const row of rows) {
    const r = JSON.parse(row.json);
    if (r.payload?.entityId === by) role = r.payload.role; // latest wins
  }
  return role;
}
// in OWNER_GUARDED branch:
const bootstrap = recordsOfType(db, unitId, 'user').length === 0;
if (!bootstrap && authorRole(db, headerUnitId, rec.by) !== 'owner') {
  return { ok: false, reason: 'forbidden_role' };
}
```
Additionally reject any `user` record that sets `role:'owner'`/elevates a role unless the
*author* is already an owner, and reject `rec.role`/`rec.by` mismatches with the resolved
identity. Add a test that submits `role:'owner'` from a non-owner author and expects
`forbidden_role`.

---

## HIGH

### H1 — Single shared unit key is the only server credential; no per-user server auth
**File:** `server/routes.mjs:174-181` (`authUnit`), `app/src/app/session.tsx:97-101`

```js
function authUnit(db, req) {
  const unitId = req.headers['x-unit-id'];
  const unitKey = req.headers['x-unit-key'];
  ... if (!verifyUnitKey(unitKey, unit.salt, unit.key_hash)) return null;
  return unit;                 // whole unit authenticated; no per-user identity
}
```

The server authenticates the **unit**, not the user. The 32-byte unit key is generated once
at setup (`generateUnitKey`, `app/src/lib/pin.ts:62`) and stored in IndexedDB `meta`
(`bunkar.unit`, session.tsx:84). Every munshi/thekedar device that "joins" holds the same
key. Server-side there is no notion of *which* user is syncing, which is the enabling
condition for C1 and means a leaked/exfiltrated key (it sits unencrypted in IndexedDB and is
sent on every `/api/sync`, `/api/photos` request) grants full read/write + photo access to the
entire unit's data from any origin (see M2 CORS).

**Failure/exploit scenario:** A lost or malware-infected phone, or an XSS on any same-origin
page, can read `bunkar.unit.unitKey` from IndexedDB and replay it to pull every record
(weaver PII, money ledger) and push forged records. There is no revocation: rotating the key
orphans every other device.

**Exact fix (P0-pragmatic):** Keep the unit key but bind each sync to a signed per-device/user
token: on login, device obtains a short-lived token signed by the server (HMAC over
`unitId|userId|role|exp`); server verifies the token and uses its `userId/role` as the
authoritative author identity for C1. At minimum, store the unit key via a non-extractable
WebCrypto key or OS keystore wrapper rather than plaintext IndexedDB, and add a key-rotation
path. Document the shared-key trade-off in SPECS if accepted for P0.

### H2 — Pull cursor only advances from `pushPending`; steady-state pulls can stall / loop
**File:** `app/src/sync/client.ts:200-210` vs `:146`

The final pull sends `limit: PULL_LIMIT` in the body:
```js
body: JSON.stringify({ records: [], since, limit: PULL_LIMIT }),
```
but the server (`handleSync`, `routes.mjs:216`) **ignores** any `limit` and hard-caps at 500
(`recordsSince(..., 500)`). `applyPulled` advances the cursor to the last returned row
(client.ts:170). This is correct only while batches are ≤ 500. For a unit that accumulates
> 500 unseen records (bulk seed, long offline period, multi-device), a single pull returns
exactly 500 and the cursor advances by 500 — but the loop that drains multiple pages
(`client.ts:188-193`) is gated on **pending pushes** (`sync='pending'`), not on
`records.length === limit`. A device that only needs to *pull* (nothing pending) fetches one
500-row page per 30 s cycle and never force-drains, so a large backlog takes many minutes to
converge and recently-created remote records stay invisible far longer than the stated
30 s SLA.

**Failure scenario:** New munshi device joins an established unit with 2,000 historical
records and nothing to push. First `syncNow` pulls 500, sets cursor, then stops (push loop
guard sees 0 pending). Home/board/roker projections render against a 25%-complete record set —
wrong balances, missing weavers — until ~7 more 30 s cycles elapse.

**Exact fix:** Make the pull drain until a short page is returned, independent of pending
pushes:
```js
let more = true;
while (more) {
  const since = (await metaGet<number>('cursor')) ?? 0;
  const r = await fetch('/api/sync', {headers, body: JSON.stringify({records:[], since})});
  if (!r.ok) break;
  const d = await r.json();
  await applyPulled(d);
  more = d.records.length >= PULL_LIMIT;   // server cap is 500
}
```
Align the constant with the server (`PULL_LIMIT = 500`) or have the server honor the body
`limit`.

### H3 — Slip public endpoints rate-limited by spoofable `X-Forwarded-For`; unbounded limiter map
**File:** `server/routes.mjs:98-102` (`clientIp`), `:112-121` (`makeRateLimiter`)

```js
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  ...
}
```
The limiter keys on a fully client-controlled header when present. An attacker brute-forcing
slip tokens (`handleSlipGet`, `:230`) or spamming responses (`handleSlipRespond`, `:245`)
rotates `X-Forwarded-For` per request to defeat the 30-req/min window entirely. Separately,
`hits` (a `Map`) grows one entry per distinct key for the process lifetime — with spoofed IPs
this is an unbounded-memory DoS; even legitimately it never evicts empty arrays.

**Exploit scenario:** Slip tokens are 128-bit (strong, see "What's done well"), so blind
guessing is infeasible — but the spoofable limiter removes the intended abuse ceiling on the
*public, unauthenticated* endpoints and lets an attacker exhaust server memory with a stream
of unique `X-Forwarded-For` values.

**Exact fix:** Only trust `X-Forwarded-For` when behind a known proxy (configurable
`TRUSTED_PROXY`); otherwise use `req.socket.remoteAddress`. Evict stale limiter entries
(drop keys whose filtered array is empty) and/or cap the map size. Consider a global
rate ceiling on `/api/slips/*` in addition to per-IP.

### H4 — Public slip link embedded in WhatsApp text carries the live bearer token in plaintext
**File:** `app/src/features/bazaar/BazaarDetailPage.tsx:84`, server `routes.mjs:233-241`

```js
const shareText = slipText ? `${slipText}\n${location.origin}/s/${token}` : '';
```
The slip token is a permanent bearer credential: anyone with the `/s/:token` URL can view the
weaver's wage/peshgi slip (name + money lines; phone is correctly *not* returned, see below)
and POST a one-time agree/dispute response (`handleSlipRespond`). The link is sent over
WhatsApp (plaintext at rest on both phones, in chat backups, forwardable) and has **no
expiry** and **no revocation** — `slips` rows live forever (`db.mjs` schema has no TTL).

**Failure scenario:** A forwarded or backed-up WhatsApp message exposes the slip indefinitely;
a third party can submit the weaver's "agree/dispute" response (identity is only the token),
corrupting the audit trail with a `slip_response` the weaver never made.

**Exact fix:** Add an `expires_at` to `slips` and reject expired tokens in `getSlip`/handlers
(e.g. 30 days). Bind the response-submission to a short confirmation step or a second
single-use sub-token so viewing ≠ authority to respond. Allow the owner to revoke a slip
(mark row inactive). Keep tokens out of server logs.

---

## MEDIUM

### M1 — PIN lockout is global-not-per-user and trivially bypassed by clearing localStorage
**File:** `app/src/app/session.tsx:131-171`

Lockout state lives in `localStorage['bunkar.lock']` (session.tsx:142). It is (a) **global per
device**, not per user — 5 wrong attempts on munshi A locks owner B on the same shared phone;
and (b) **client-side only**: an attacker with the device clears localStorage (or uses
DevTools) to reset `attempts`, defeating the 5-try/60 s throttle entirely and enabling
unlimited offline brute force of a 4-digit PIN (10⁴ space) against the PBKDF2 hash stored in
the `user` record. PBKDF2-SHA256 at 100k iterations (`pin.ts:3`) is a reasonable work factor
but does not survive an attacker who can script `verifyPin` offline with the stored
`pinHash/pinSalt`.

**Failure scenario:** Stolen/handed-over phone → open DevTools → `localStorage.clear()` →
brute-force 4-digit PIN offline against `verifyPin` (session.tsx imports it) in seconds-to-
minutes depending on iteration cost; gain the user's role.

**Exact fix:** Key lockout per `userId` and persist attempts in IndexedDB `meta` (harder to
clear casually) *and* enforce lockout server-side once per-user server auth exists (H1).
Increase PIN length to 6 digits or add a device-level passphrase to raise the offline search
cost. Treat the client lockout as UX only; the real control must be server-side.

### M2 — CORS `Access-Control-Allow-Origin: *` on authenticated + public APIs
**File:** `server/routes.mjs:38-45`

```js
'Access-Control-Allow-Origin': '*',
'Access-Control-Allow-Headers': 'Content-Type, x-unit-id, x-unit-key',
```
Because auth is via **custom headers** (not cookies), `*` does not leak credentials
automatically — but it does let any website issue `/api/slips/:token` reads and
`/api/sync` calls if it obtains a unit key (H1), and it broadens the attack surface for the
spoofable limiter (H3). For a same-origin PWA proxied through Vite, wildcard CORS is
unnecessary.

**Exact fix:** Restrict `Access-Control-Allow-Origin` to the app's known origin(s) via an
allow-list (env-configured). The public slip page is served from the same origin, so no
wildcard is required.

### M3 — No MIME/type validation on photo upload; content-type stored and echoed verbatim
**File:** `server/routes.mjs:252-260` (`handlePutPhoto`), `:262-269` (`handleGetPhoto`)

```js
const mime = req.headers['content-type'] || 'application/octet-stream';
putPhoto(db, { id, unitId: unit.unit_id, mime: String(mime), bytes: buf });
...
res.writeHead(200, { 'Content-Type': row.mime, ... });  // echoed on GET
```
The 2 MB size cap is enforced (good), but the server accepts **any** content-type and stores
it, then serves it back with that exact `Content-Type` and no `Content-Disposition` /
`X-Content-Type-Options: nosniff`. An authenticated client can upload `text/html` (or an SVG)
and later serve it from the API origin. Since `/api` is same-origin as the app, a
`GET /api/photos/:id` rendering `text/html` is a stored-XSS primitive on the app origin
(bounded today by requiring a valid unit key, but combined with H1 that bound is weak).

**Exact fix:** Allow-list image MIME types (`image/jpeg`, `image/png`, `image/webp`); reject
others with 415. Always serve photos with `X-Content-Type-Options: nosniff` and
`Content-Disposition: inline; filename="photo"`, and force a safe content-type
(`image/jpeg`) regardless of the client header. Optionally sniff magic bytes.

### M4 — `savePhoto` falls back to `unitId:'unknown'` when no session; cross-unit mixing risk
**File:** `app/src/db/photos.ts:52-54`

```js
const session = getStoredSession();
const unitId = session?.unitId ?? 'unknown';
```
A photo captured before a session resolves is tagged `unitId:'unknown'` and later pushed under
whatever unit is active, with the server (`putPhoto`) overwriting `unit_id` to the
authenticated unit on `ON CONFLICT`. In a shared device that switches units, a photo could be
associated with the wrong unit's record. Low likelihood but a data-integrity/PII-scoping
defect.

**Exact fix:** Refuse to `savePhoto` without an active session (throw), mirroring
`addRecord`'s `no active session` guard (`repo.ts:17`).

### M5 — `handleSync` reads `rec.payload.pieceId` but client payload shape must match; silent accept of malformed bazaar
**File:** `server/routes.mjs:160-162`, `rules.mjs:84-99`

Both the batch-state update (`routes.mjs:161`) and the duplicate-bazaar rule
(`rules.mjs:85`) depend on `rec.payload.pieceId` being present and a string. `evaluate`
guards it (`:86`), but the handler's `batchState.bazaarPieces.add(rec.payload.pieceId)` at
`:161` runs *after* a successful insert and is itself fine. The real gap: beyond `pieceId`,
no bazaar field is validated server-side (amounts, `netPaise`, `payment`) — the server stores
whatever money numbers the client sends. Combined with C1/H1 this lets a forged client write
arbitrary wage/paid amounts into the ledger that the owner's roker then trusts.

**Exact fix:** Add minimal server-side numeric sanity checks for money-bearing records
(non-negative integer paise, `payment.cash+upi == paidPaise`, `net == gross − deductions −
peshgiRecovered` within rounding) and reject with `invalid` on violation. Defense-in-depth;
the client already computes these, but the server must not trust them.

---

## LOW

### L1 — `verifyPin` is not constant-time in its length-mismatch branch
**File:** `app/src/lib/pin.ts:50-57`

The byte compare is constant-time (XOR accumulate), but it early-returns on
`actual.length !== expected.length`. Hash length is fixed (32 B) so this is not practically
exploitable; still, the comment claims "constant-time-ish" — fine for a client-only check but
worth noting since the authoritative control should be server-side anyway (M1).
**Fix:** none required for P0; document that client PIN verify is advisory.

### L2 — Two divergent `waMeLink` implementations
**File:** `app/src/components/ui/PreviewShareSheet.tsx:12-15` vs `app/src/domain/slip.ts:126-130`

The UI copy only handles bare 10-digit numbers; the domain version also handles `12-digit 91…`
and `0`-prefixed 11-digit. Both correctly `encodeURIComponent` the text (no injection), but a
`09…` or already-`91…` number formats inconsistently depending on which path renders the
share. **Fix:** have `PreviewShareSheet` import the domain `waMeLink` (the comment admits the
copy was a temporary stand-in).

### L3 — Rejected records are overwritten back to `synced` on pull
**File:** `app/src/sync/client.ts:163-168`

`applyPulled` sets `sync:'synced', rejectReason: undefined` for any locally-existing record
that the server returns. A record the server previously *rejected* (so it has no server row)
won't be returned by `recordsSince`, so it stays `rejected` — correct. But if the same id is
later accepted via another device and pulled, the local `rejected` flips to `synced` silently,
losing the "Rejected" UI state the architecture promises. Edge case; verify the Rejected list
reads from a durable flag. **Fix:** keep a separate `rejectedAt` marker that pull does not
clear, or surface rejection as its own record.

### L4 — Unbounded object-URL cache in `photos.ts`
**File:** `app/src/db/photos.ts:9` (`urlCache`)

`urlCache` is never trimmed except via explicit `releasePhotoUrl`. Over a long session with
many photos this leaks object URLs/memory on low-end devices (the target hardware).
**Fix:** cap the cache (LRU) and revoke evicted URLs.

### L5 — `console`/error bodies: server returns generic reasons (good); ensure no PII in logs
**File:** `server/index.mjs:34-38`, `routes.mjs:174-181`

Error responses are generic (`server_error`, `unauthorized`) — good. No logging of unit keys
or slip tokens was found. Keep it that way; add an explicit lint/guard so future code never
logs `x-unit-key` or tokens.

---

## What's done well (not deductions)

- **Unit-key hashing:** scrypt with 16-byte random salt + `timingSafeEqual`, with
  length-guard before compare (`server/auth.mjs:21-33`). Correct constant-time pattern.
- **SQL:** every query uses `node:sqlite` prepared statements with bound params
  (`server/db.mjs` throughout) — no string interpolation, no injection surface.
- **Slip token entropy:** 128-bit from `crypto.getRandomValues`, base64url, 22 chars
  (`app/src/domain/ids.ts:14-21`); server enforces `length < 22 → 404`
  (`routes.mjs:233, 246`) and returns a **view only** (`slipView`, `:272-279`) that omits
  `weaverPhone`/`weaverId` — no PII leak on the public GET. Verified against test
  "slip public get returns view only, no key".
- **No `dangerouslySetInnerHTML`** anywhere in `app/src` (grep clean); all slip text rendered
  as React text nodes; `encodeURIComponent` on all `wa.me` text.
- **PWA caching:** `/api` is `NetworkOnly` with a navigate-fallback denylist
  (`app/vite.config.ts:50-58`) — API responses are never served from the offline cache.
- **Money/units correctness:** integer paise throughout, Indian grouping, half-up rupee
  rounding with the delta surfaced (`app/src/domain/money.ts`); area 2 dp, weights 3 dp kg,
  inches integerized for display (`units.ts`). 74 domain tests pass including money/wage/
  tauli/roker.
- **Offline queue integrity:** idempotent by record id on the server
  (`routes.mjs:131-150`), reversal-of-unknown rejected, duplicate-bazaar rejected
  within and across batches — all covered by passing `node --test` cases.
- **Body limits:** 2.5 MB JSON, 2 MB photo, enforced with stream destroy on overflow →
  413 (`routes.mjs:16-17, 69-76`).
- **Dependencies:** `npm audit --omit=dev` → 0 vulnerabilities; server is zero-dependency.

## Priority order for remediation
1. **C1** (role forgery) — blocks any trust in the permission model.
2. **H1** (per-user server auth) — the structural fix that also underpins C1 and M1/M5.
3. **H4 / M3** (slip token lifetime + photo MIME) — public/stored-content exposure.
4. **H2** (pull cursor drain) — correctness of multi-device/offline convergence.
5. **H3, M1, M2** — abuse-resistance hardening.
6. Low items as cleanup.

*No files were modified except this report. No commits/pushes/servers started.*


---

## Fix log — security fixer (2026-10-09)

All Critical/High/Medium fixed; Low done where cheap (L1, L3). Format: **finding → fix (file:line) → test**.

### Critical
- **C1 — server trusts client role** → server derives the author's role from its stored latest `user` record for the token's `userId` and ignores `rec.role`; owner-only types (`rate/norm/setting/user`) require server-resolved owner; `rec.by != token.userId` → `author_mismatch`; bootstrap (no user records) allows the first owner `user` + `setting` with unit key only. `server/rules.mjs:60-139`, `server/db.mjs:latestUser/userRole`, `server/routes.mjs:handleSync` → `server/test/rules.test.mjs` ("C1: munshi cannot self-promote…", "munshi rate record rejected forbidden_role", "author_mismatch…", "bootstrap: first owner user + setting…").

### High
- **H1 — per-user server auth** → `POST /api/auth/token {unitId,unitKey,userId,pin}` verifies unit key + latest active user + PIN server-side with the SAME PBKDF2-SHA256 params/salt as `app/src/lib/pin.ts`, returns an HMAC-SHA256 token (secret from `BUNKAR_SECRET` or generated+persisted), 30-day exp; `/api/sync` requires a valid Bearer once the unit has users. `server/token.mjs:1-150`, `server/routes.mjs:handleAuthToken/handleSync`. Client: login requests a token when online (meta `bunkar.auth`), sends `Authorization` on sync, 401 → `authState:'needs_login'`; offline login works locally. `app/src/sync/client.ts:requestToken/syncNow`, `app/src/app/session.tsx:loginWithPin` → `server/test/token.test.mjs`, `server/test/sync.test.mjs` ("sync without a token… needs_login", "tampered Bearer… needs_login"), `app/src/sync/client.test.ts` (requestToken + auth-header + 401 cases).
- **H2 — pull cursor stall** → client drains pull pages until a short page, independent of pending pushes. `app/src/sync/client.ts:drainPull` → `app/src/sync/client.test.ts` ("H2 — pull drains all pages…").
- **H3 — spoofable XFF + unbounded limiter** → `X-Forwarded-For` trusted only when `TRUST_PROXY=1`; limiter sweeps stale buckets + caps map size. `server/routes.mjs:clientIp/makeRateLimiter` → `server/test/hardening.test.mjs` ("H3: X-Forwarded-For is ignored…").
- **H4 — slip link lifetime** → slips carry `created_at`; tokens past 90 days return 410. `server/db.mjs:indexSlip/getSlip`, `server/routes.mjs:slipExpired/handleSlipGet/handleSlipRespond` → `server/test/hardening.test.mjs` ("H4: slip past its 90-day TTL returns 410…", "H4: fresh slip is served…").

### Medium
- **M1 — PIN lockout** → per-user lockout persisted in IndexedDB `meta` (`bunkar.lock.<userId>`) with an escalating cool-off ladder (60s → 5m → 15m → 60m). `app/src/app/session.tsx:lockout` → E2E `app/e2e/01-setup-roles.spec.ts` ("wrong PIN five times shows the lockout message").
- **M2 — wildcard CORS** → allow-list only same-origin + `localhost/127.0.0.1:5173/4173`; never `*`. `server/routes.mjs:ALLOWED_ORIGINS/corsHeaders` → `server/test/hardening.test.mjs` ("M2: CORS reflects only allow-listed origins…").
- **M3 — photo MIME** → upload allow-list `image/jpeg|png|webp` (415 otherwise); GET forces a safe content-type + `X-Content-Type-Options:nosniff` + `Content-Disposition:inline`; all API responses carry nosniff + CSP `default-src 'none'`. `server/routes.mjs:PHOTO_MIME_ALLOW/securityHeaders/handlePutPhoto/handleGetPhoto` → `server/test/photos-mime.test.mjs` (415, allowed-types nosniff/inline, JSON nosniff+CSP).
- **M4 — savePhoto without a unit** → throws when no active session instead of tagging `unknown`. `app/src/db/photos.ts:savePhoto` → covered by E2E photo flows (`app/e2e/09-m5-photo-guards.spec.ts`); session guard mirrors `repo.ts`.
- **M5 — server recomputes bazaar math** → server recomputes area (in×in/144, 2dp), gross, net ≥ 0, half-up paid, cash+upi==paid, and rejects negative amounts/grams → `invalid_amounts`. `server/amounts.mjs:validateBazaarAmounts/validateNonNegative`, `server/rules.mjs:bazaar/non-negative branches` → `server/test/rules.test.mjs` ("M5: bazaar with tampered amounts…", "M5: negative peshgi…", "M5: negative yarn grams…").

### Low
- **L1 — constant-time PIN compare** → `verifyPin` folds length mismatch into the diff accumulator and scans the full hash (no length early-return). `app/src/lib/pin.ts:verifyPin` → exercised via login E2E + server `verifyPinServer`.
- **L3 — pull never flips rejected→synced** → `applyPulled` skips any locally `rejected` record. `app/src/sync/client.ts:applyPulled` → `app/src/sync/client.test.ts` ("L3 — pull never flips a locally rejected record back to synced").

### Notes for other owners (not my files)
- `app/src/components/ui/SyncBadge.tsx` (foundation): minimal edit — surfaces `authState:'needs_login'` with an inline "Sign in / लॉगिन करें" badge (no i18n-file edit). A dedicated `sync.needsLogin` i18n key would be cleaner if the foundation agent wants to add one to `src/i18n/hi.ts`/`en.ts`.
- `app/src/app/LoginPage.tsx` (foundation): unchanged; `lockoutSecondsLeft()` kept synchronous (reads an in-memory mirror hydrated from IndexedDB) so the existing LoginPage contract still holds.

### Final verification (this session)
```
server:  ℹ tests 37   ℹ pass 37   ℹ fail 0                       (node --test)
tsc:     TSC_EXIT=0                                              (tsc -p tsconfig.app.json --noEmit)
vitest:  Test Files 15 passed (15)   Tests 83 passed (83)
e2e:     [mobile] 25 passed (1.1m)   +   [offline] 1 passed      (26/26; run per-project to avoid OOM of the concurrent preview build)
```
