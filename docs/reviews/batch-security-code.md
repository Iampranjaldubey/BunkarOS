# Completion batch (SPEC-014..018) — independent security + code review

Reviewer: `rev_security` (fresh, read-only except this file). Node v24.21.0.
Date: 2026-10-09. Live server tested on port 8799 (ephemeral `/tmp/batchsec.db`,
`AUTH_RATE_MAX=1000` so device/job probes were not rate-limited). Server killed
after testing; hosted instance on 4180/8790 untouched.

## Scores

- **Security: 10/10**
- **Code quality: 10/10**

## Verification evidence (commands run)

| Command | Result |
|---|---|
| `cd server && node --test` | tests **72 · pass 72 · fail 0** |
| `cd app && npx vitest run` | **200 passed (200)** |
| `cd app && npx tsc -p tsconfig.app.json --noEmit` | **exit 0** |
| `cd app && npm audit --omit=dev` | **found 0 vulnerabilities** |
| `cd server/tts && npm audit --omit=dev` | **found 0 vulnerabilities** |

## Live security tests (port 8799) — all passed

### SPEC-014 device binding (routes.mjs / token.mjs / db.mjs)
- Forged token, **wrong HMAC secret**, deviceId swapped → `/api/sync` does not
  authenticate (falls to token-less bootstrap pull of `user` records only;
  writes rejected `needs_login`). HMAC over the full payload (incl. `deviceId`,
  `token.mjs:84`) makes deviceId un-forgeable without the secret.
- Correct-secret token with a `deviceId` that is **not** the active binding →
  `401 device_revoked` on `/api/sync` (`tokenDeviceActive`, routes.mjs:150-168 +
  handleSync 374-377). Same guard on photos (`photoDeviceGuard`, routes.mjs) —
  revoked munshi token on `PUT /api/photos/:id` → `401 device_revoked`.
- Munshi second phone → `409 device_bound {boundAt}`; owner → takeover (old
  phone's token → `401 device_revoked`, owner never locks himself out).
- Munshi/thekedar token on `GET /api/devices` and
  `POST /api/devices/:userId/signout` → **403 forbidden** (`requireOwner`).
- Owner remote sign-out → `204`; signed-out phone's next sync → `401
  device_revoked` (client drops token, keeps pending records — client.ts
  `DeviceRevokedError`). Unknown user signout → `404`.
- Device id bounds enforced (routes.mjs:142-147): len `<8` or `>80`, or
  whitespace-containing → `400 invalid_device`; 8..80 accepted (an
  `<script>` string is accepted as an opaque id but is never reflected into
  HTML — it only lives in the token payload and the owner's JSON device list).
- Shared office phone: owner+munshi+thekedar all bind the **same** device id and
  all sync → `200` (AC5), verified with a clean binding set.

### SPEC-015 audio endpoint (slip-audio.mjs / tts/synth.mjs)
- Valid token → `200 audio/wav`, RIFF/WAVE header, `X-Content-Type-Options:
  nosniff`, `Cache-Control: private`. Second hit served from cache with the same
  content-type/length (no cache poisoning; cache keyed by token in a dedicated
  `slip_audio` table).
- Unknown/short token → `404`; expired slip → `410`; empty `speechHi`+`textHi` →
  `503 tts_unavailable`.
- **Command/arg injection**: `speechHi` containing `; rm -rf /`, backticks,
  `$(...)`, a `-w /tmp/evil.wav` flag and a NUL byte produced **no** file writes
  (`/tmp/PWNED`, `/tmp/evil.wav` absent) — text is fed on **stdin** to
  `spawn(process.execPath, [synthPath])` (no shell, no interpolation,
  slip-audio.mjs:60), and `synth.mjs` passes it only as a positional arg to the
  in-process espeak WASM module, never a CLI flag.
- **DoS / huge text**: a ~150 KB `speechHi` returned `503` in ~0.1 s (engine
  rejects oversized input) — backstopped by a 10 s `SIGKILL` timeout and a
  `MAX_WAV_BYTES` stdout overflow guard. Rate limit shared with the slip page
  (30/min per IP) confirmed: 40 rapid audio hits → 23×404 then **17×429**.
- Per-IP rate limiter is memory-bounded (sweep + `MAX_KEYS` cap, routes.mjs).

### SPEC-016 job + piece-rate bazaar (rules.mjs / amounts.mjs)
Server recomputes money (defence-in-depth); client numbers are never trusted.
- Valid munshi job accepted; **tampered amount**, **zero grams**, **negative
  grams**, **day=1.3** (non-0.5 multiple), **unit=kg with grams missing**, and
  **piece-rate `grossPaise != ratePaise`** / **cash+upi != paid** → all
  `invalid_amounts`.
- **Thekedar** authoring a `job` → `forbidden_role` (rules.mjs job branch
  allows only owner/munshi). `workerKind:'other'` with blank name → `invalid`.
- Munshi token with `by: u-owner` → `author_mismatch`. Piece-rate flat gross
  (₹8,000 regardless of size) accepted and recomputed correctly.

### GPL isolation
- `espeak-ng@1.0.2` (GPL-3.0-or-later, LICENSE present) lives **only** in
  `server/tts/node_modules` with its own `package.json`/`package-lock.json`
  (pinned exact). Core `server/package.json` has **no** dependencies block and
  no `node_modules`. No core server file `import`s the engine; `slip-audio.mjs`
  only spawns `node server/tts/synth.mjs` by path. Separate-process boundary is
  intact — the server's licensing is unaffected.

## Code quality
Server (routes/rules/amounts/token/db/slip-audio) and client sync
(`app/src/sync/client.ts`) are clean, well-documented, and consistent:
server never trusts client `rec.role` (role resolved from stored `user`
records); batch-level bootstrap snapshot prevents a mid-batch lockout; pull
never overwrites a locally-`rejected` record or a local payload; device-revoked
flow preserves unsynced records. No `eval`/shell/string-interpolated SQL
(all `db.prepare(...).run/get/all` parameterised).

## Blockers to a perfect 10
**None.** No security or code-quality blockers found. Every SPEC-014..018
acceptance criterion probed against the live server behaved exactly as specified,
and all five verification commands are green.

SCORES: security=10 code=10
BLOCKERS: 0

---

## Batch fix log — `fix_core` (core fixer), 2026-10-09, Node v24.21.0

**Outcome: no fix required — this review reported `BLOCKERS: 0`.**

Per the batch workflow, the core fixer resolves every blocker in this file and the
non-UI items of `batch-features-uat.md`. Both files carry **BLOCKERS: 0** (security
10/10, code 10/10; features 10/10, uat 10/10) and neither names a `file:line` fix in
a core-owned path. The one open blocker in the batch (`batch-ui-ux.md` Blocker 1,
negative "free in N days") is in `app/src/domain/owner.ts` — owned by agent **k** per
the architecture contract's per-file `domain/` split (`board,owner,monthly,digest.ts`
→ k), not by the core fixer, and the UI reviewer flagged it for the k/UI owner. No
core-owned file (`server/**`, `app/src/sync/*`, `app/src/app/session.tsx`,
`app/src/lib/*`, `app/src/domain/{units,money,ids,wage,tauli,peshgi,rates,roker,slip,
permissions,projections,jobs,speech}.ts`, `app/src/db/{db,repo,hooks,photos}.ts`,
`vite.config.ts`, `playwright.config.ts`, `scripts/*`, `README.md`, `e2e/fixtures.ts`)
requires a change. No files were edited this session except this log and the matching
log in `batch-features-uat.md`.

Independent re-verification (full suite re-run this session):

| Command | Result |
|---|---|
| `cd server && node --test` | **72 pass / 0 fail** |
| `cd app && npx tsc -p tsconfig.app.json --noEmit` | **exit 0** |
| `cd app && npx vitest run` | **200 passed / 23 files** |
| `cd app && npx vite build` | **exit 0** — precache 107 entries / 1372.99 KiB |
| `cd app && npx playwright test` (under `/tmp/bunkar-e2e.lock`, released) | **54 passed / 0 failed** (19 spec files) |
| `cd server && node --test test/slip-audio-route.test.mjs test/slip-audio.test.mjs` | **8 pass** (real espeak-ng path) |

GPL isolation re-confirmed: core `server/package.json` `dependencies` = `{}` and has no
`node_modules`; `espeak-ng` is present only under `server/tts/node_modules`.

Safety: nothing committed; e2e lock acquired then released on every path; shared ports
5173/8787/8788/4173 left clear after the run; the hosted instance on 4180/8790
(PIDs 151337/151174) stayed up and `server/data/bunkar-local.db` was untouched
(mtime 2026-10-09 09:09:58, before this session).
