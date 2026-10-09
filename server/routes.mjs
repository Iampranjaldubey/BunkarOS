// Bunkar OS server — HTTP routing (zero deps). Pure request dispatcher built on
// node:http request/response. All responses JSON unless a photo body is returned.
import { randomUUID } from 'node:crypto';
import {
  getUnit, insertUnit,
  getRecordById, insertRecord, recordsSince,
  putPhoto, getPhoto,
  indexSlip, getSlip, getSlipResponse,
  userRecordCount, latestUser, userRole, userRecordsSince,
  getActiveDevice, bindDevice, revokeActiveDevice, touchDeviceLastSeen, listDevices,
} from './db.mjs';
import { hashUnitKey, verifyUnitKey } from './auth.mjs';
import { evaluate } from './rules.mjs';
import { signToken, verifyToken, verifyPinServer } from './token.mjs';
import { handleSlipAudio } from './slip-audio.mjs';

const BODY_LIMIT = Math.round(2.5 * 1024 * 1024); // 2.5 MB
const PHOTO_LIMIT = 2 * 1024 * 1024; // 2 MB
const SLIP_RATE_MAX = 30; // requests / window
const SLIP_RATE_WINDOW_MS = 60 * 1000;
// token requests / window (brute-force ceiling). Configurable via env so the
// shared-localhost E2E harness (every test hits /api/auth/token from 127.0.0.1)
// can raise it; production keeps the strict default of 20.
const AUTH_RATE_MAX = Number.isFinite(Number(process.env.AUTH_RATE_MAX))
  && Number(process.env.AUTH_RATE_MAX) > 0
  ? Number(process.env.AUTH_RATE_MAX)
  : 20;
const PULL_LIMIT = 500;
const SLIP_TTL_MS = 90 * 24 * 60 * 60 * 1000; // H4: 90-day slip link lifetime
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Allowed photo MIME types (M3). Anything else is rejected 415.
const PHOTO_MIME_ALLOW = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Trust X-Forwarded-For only behind a known proxy (H3).
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

function istDay(date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// M2: CORS allow-list — same-origin PWA + dev/preview origins. No wildcard.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
]);

function corsHeaders(req) {
  const origin = req && req.headers ? req.headers.origin : undefined;
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-unit-id, x-unit-key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  // Reflect only allow-listed origins; same-origin requests send no Origin and
  // need no CORS header at all.
  if (typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

// M3: X-Content-Type-Options nosniff + locked-down CSP on every API response.
function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'",
  };
}

function sendJson(res, status, obj, req) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...securityHeaders(),
    ...corsHeaders(req),
  });
  res.end(body);
}

function sendError(res, status, error, req, extra) {
  sendJson(res, status, { ok: false, error, ...(extra || {}) }, req);
}

/** Read a request body up to limit bytes. Resolves Buffer, or rejects on overflow. */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req, limit) {
  const buf = await readBody(req, limit);
  if (buf.length === 0) return {};
  return JSON.parse(buf.toString('utf8'));
}

/** Authenticate a unit request from headers; returns the unit row or null. */
function authUnit(db, req) {
  const unitId = req.headers['x-unit-id'];
  const unitKey = req.headers['x-unit-key'];
  if (typeof unitId !== 'string' || typeof unitKey !== 'string') return null;
  const unit = getUnit(db, unitId);
  if (!unit) return null;
  if (!verifyUnitKey(unitKey, unit.salt, unit.key_hash)) return null;
  return unit;
}

/** Extract and verify a Bearer token; returns {unitId, userId, deviceId?, exp} or null. */
function bearerAuth(db, req) {
  const h = req.headers['authorization'];
  if (typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/);
  if (!m) return null;
  return verifyToken(db, m[1]);
}

// SPEC-014: device id bounds for the per-user binding.
const DEVICE_ID_MIN = 8;
const DEVICE_ID_MAX = 80;

function validDeviceId(id) {
  return typeof id === 'string' && id.length >= DEVICE_ID_MIN && id.length <= DEVICE_ID_MAX;
}

/**
 * SPEC-014: a token-authenticated request is only valid if the token's device
 * is the user's CURRENT active binding. A token with no deviceId (legacy, from
 * before SPEC-014) is treated as device-less and accepted for back-compat only
 * when the user has no active binding at all. Returns true if the token's device
 * is still the active binding.
 */
function tokenDeviceActive(db, unitId, token) {
  const active = getActiveDevice(db, unitId, token.userId);
  // A SPEC-014 token names its device: it is valid only while that device is the
  // user's current active binding. If the binding was revoked (takeover or
  // owner sign-out) there is either no active binding or a different one → 401.
  if (typeof token.deviceId === 'string') {
    return Boolean(active) && active.device_id === token.deviceId;
  }
  // Legacy device-less token (pre-SPEC-014): accepted only when the user has no
  // active binding at all; any binding supersedes a device-less token.
  return !active;
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  }
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

/**
 * Make a per-IP sliding-window rate limiter. Sweeps stale buckets once a minute
 * and caps the map size to bound memory under spoofed/abusive traffic (H3).
 */
function makeRateLimiter(max, windowMs) {
  const hits = new Map();
  const MAX_KEYS = 10_000;
  let lastSweep = Date.now();

  function sweep(now) {
    for (const [key, arr] of hits) {
      const live = arr.filter((t) => now - t < windowMs);
      if (live.length === 0) hits.delete(key);
      else hits.set(key, live);
    }
    lastSweep = now;
  }

  return (ip) => {
    const now = Date.now();
    if (now - lastSweep > windowMs) sweep(now);
    const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(ip, arr);
    // Hard cap: if the map explodes (spoofed IPs with TRUST_PROXY), force a sweep.
    if (hits.size > MAX_KEYS) sweep(now);
    return arr.length <= max;
  };
}

/**
 * Build the request handler bound to an open database.
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function makeHandler(db) {
  const slipLimiter = makeRateLimiter(SLIP_RATE_MAX, SLIP_RATE_WINDOW_MS);
  const authLimiter = makeRateLimiter(AUTH_RATE_MAX, SLIP_RATE_WINDOW_MS);

  return async function handler(req, res) {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { ...securityHeaders(), ...corsHeaders(req) });
        res.end();
        return;
      }

      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;

      if (req.method === 'GET' && path === '/api/health') {
        return sendJson(res, 200, { ok: true, status: 'healthy' }, req);
      }

      if (req.method === 'POST' && path === '/api/units') {
        return await handleCreateUnit(db, req, res);
      }

      if (req.method === 'POST' && path === '/api/auth/token') {
        return await handleAuthToken(db, req, res, authLimiter);
      }

      if (req.method === 'POST' && path === '/api/sync') {
        return await handleSync(db, req, res);
      }

      // /api/devices  (owner: list)  and  /api/devices/:userId/signout (owner)
      if (req.method === 'GET' && path === '/api/devices') {
        return await handleDevicesList(db, req, res);
      }
      const signoutMatch = path.match(/^\/api\/devices\/([^/]+)\/signout$/);
      if (signoutMatch && req.method === 'POST') {
        return await handleDeviceSignout(db, req, res, decodeURIComponent(signoutMatch[1]));
      }

      // /api/photos/:id
      const photoMatch = path.match(/^\/api\/photos\/([^/]+)$/);
      if (photoMatch) {
        const id = decodeURIComponent(photoMatch[1]);
        if (req.method === 'PUT') return await handlePutPhoto(db, req, res, id);
        if (req.method === 'GET') return handleGetPhoto(db, req, res, id);
      }

      // /api/slips/:token, /api/slips/:token/audio (C9 voice clip) and /api/slips/:token/response
      const slipResp = path.match(/^\/api\/slips\/([^/]+)\/response$/);
      if (slipResp && req.method === 'POST') {
        return await handleSlipRespond(db, req, res, decodeURIComponent(slipResp[1]), slipLimiter);
      }
      const slipAudio = path.match(/^\/api\/slips\/([^/]+)\/audio$/);
      if (slipAudio && req.method === 'GET') {
        if (!slipLimiter(clientIp(req))) return sendError(res, 429, 'rate_limited', req);
        return await handleSlipAudio(req, res, { db, token: decodeURIComponent(slipAudio[1]), sendError });
      }
      const slipGet = path.match(/^\/api\/slips\/([^/]+)$/);
      if (slipGet && req.method === 'GET') {
        return handleSlipGet(db, req, res, decodeURIComponent(slipGet[1]), slipLimiter);
      }

      return sendError(res, 404, 'not_found', req);
    } catch (err) {
      if (err && err.message === 'too_large') return sendError(res, 413, 'payload_too_large', req);
      if (err instanceof SyntaxError) return sendError(res, 400, 'invalid_json', req);
      return sendError(res, 500, 'server_error', req);
    }
  };
}

async function handleCreateUnit(db, req, res) {
  const body = await readJson(req, BODY_LIMIT);
  const { unitId, unitKey, name } = body;
  if (typeof unitId !== 'string' || !unitId || typeof unitKey !== 'string' || !unitKey) {
    return sendError(res, 400, 'invalid', req);
  }
  const existing = getUnit(db, unitId);
  if (existing) {
    // Idempotent: same key → ok; different key → conflict.
    if (verifyUnitKey(unitKey, existing.salt, existing.key_hash)) {
      return sendJson(res, 200, { ok: true, unitId, created: false }, req);
    }
    return sendError(res, 409, 'unit_exists', req);
  }
  const { salt, hash } = hashUnitKey(unitKey);
  insertUnit(db, {
    unitId,
    keyHash: hash,
    salt,
    name: typeof name === 'string' && name ? name : unitId,
    createdAt: new Date().toISOString(),
  });
  return sendJson(res, 201, { ok: true, unitId, created: true }, req);
}

/**
 * POST /api/auth/token {unitId, unitKey, userId, pin, deviceId} → {token, exp}.
 * Verifies the unit key, finds the latest synced `user` record for userId,
 * verifies the PIN server-side, requires an active user and a valid deviceId,
 * then binds the device per SPEC-014:
 *  - no active binding, or same device → bind / refresh (200)
 *  - munshi/thekedar bound to a DIFFERENT device → 409 {error:'device_bound', boundAt}
 *  - owner on a different device → takeover (revoke the old binding, revoked_by owner)
 * The returned token carries the deviceId.
 */
async function handleAuthToken(db, req, res, limiter) {
  if (!limiter(clientIp(req))) return sendError(res, 429, 'rate_limited', req);
  const body = await readJson(req, BODY_LIMIT);

  // Unit may be authenticated via headers or via {unitId, unitKey} in the body.
  let unit = authUnit(db, req);
  if (!unit && typeof body.unitId === 'string' && typeof body.unitKey === 'string') {
    const u = getUnit(db, body.unitId);
    if (u && verifyUnitKey(body.unitKey, u.salt, u.key_hash)) unit = u;
  }
  if (!unit) return sendError(res, 401, 'unauthorized', req);

  const userId = body.userId;
  const pin = body.pin;
  const deviceId = body.deviceId;
  if (typeof userId !== 'string' || typeof pin !== 'string') {
    return sendError(res, 400, 'invalid', req);
  }
  if (!validDeviceId(deviceId)) return sendError(res, 400, 'invalid_device', req);

  const user = latestUser(db, unit.unit_id, userId);
  if (!user || user.active !== true) return sendError(res, 401, 'unauthorized', req);
  if (!verifyPinServer(pin, user.pinHash, user.pinSalt)) {
    return sendError(res, 401, 'unauthorized', req);
  }

  // Device binding (SPEC-014). Owner always takes over; non-owner on a different
  // device is refused with the time the active device was bound.
  const active = getActiveDevice(db, unit.unit_id, userId);
  const isOwner = user.role === 'owner';
  if (active && active.device_id !== deviceId && !isOwner) {
    return sendError(res, 409, 'device_bound', req, { boundAt: active.bound_at });
  }
  bindDevice(db, unit.unit_id, userId, deviceId, 'owner');

  const { token, exp } = signToken(db, { unitId: unit.unit_id, userId, deviceId });
  return sendJson(res, 200, { ok: true, token, exp }, req);
}

async function handleSync(db, req, res) {
  const unit = authUnit(db, req);
  if (!unit) return sendError(res, 401, 'unauthorized', req);

  const body = await readJson(req, BODY_LIMIT);
  const incoming = Array.isArray(body.records) ? body.records : [];
  const since = Number.isFinite(body.since) ? Number(body.since) : 0;
  const limit = Number.isFinite(body.limit) && body.limit > 0
    ? Math.min(Number(body.limit), PULL_LIMIT)
    : PULL_LIMIT;

  // Per-user auth (C1/H1): once the unit has any user records, a valid Bearer
  // token is required; its userId/role become the authoritative author identity.
  const hasUsers = userRecordCount(db, unit.unit_id) > 0;
  let auth = null;
  if (hasUsers) {
    const token = bearerAuth(db, req);
    if (!token || token.unitId !== unit.unit_id) {
      // Bootstrap: the unit has users but this device holds the unit key only
      // (no token yet) — e.g. a second device that just joined. Permit a
      // read-only pull restricted to `user` records so the device can render
      // its login screen, and REJECT any incoming writes. User records carry
      // only pinHash/pinSalt (never the raw PIN); PIN verification stays in
      // /api/auth/token, so this does not weaken authentication.
      if (incoming.length > 0) return sendError(res, 401, 'needs_login', req);
      const rows = userRecordsSince(db, unit.unit_id, since, limit);
      const records = rows.map((r) => JSON.parse(r.json));
      // IMPORTANT: do NOT advance the cursor past non-user records. This pull is
      // filtered to `user` records only; if we returned the max user seq, the
      // client would skip every intervening non-user record on its next
      // authenticated pull. Keeping cursor == since means the post-login full
      // sync re-fetches everything from the same point (idempotent by id).
      return sendJson(res, 200, { accepted: [], rejected: [], records, cursor: since }, req);
    }
    auth = { userId: token.userId, role: userRole(db, unit.unit_id, token.userId) };
    // SPEC-014: the token's device must still be the user's ACTIVE binding.
    if (!tokenDeviceActive(db, unit.unit_id, token)) {
      return sendError(res, 401, 'device_revoked', req);
    }
    // Record liveness for the owner's "फ़ोन" screen (throttled to ~1/min).
    if (typeof token.deviceId === 'string') {
      touchDeviceLastSeen(db, unit.unit_id, token.userId, token.deviceId);
    }
  }

  const accepted = [];
  const rejected = [];
  const batchState = { ids: new Set(), bazaarPieces: new Set() };

  for (const rec of incoming) {
    // Idempotency by id: a record already stored is accepted again (no-op).
    if (rec && typeof rec.id === 'string') {
      const existing = getRecordById(db, rec.id);
      if (existing) {
        accepted.push(rec.id);
        batchState.ids.add(rec.id);
        if (existing.type === 'bazaar') {
          try {
            const p = JSON.parse(existing.json).payload;
            if (p && p.pieceId) batchState.bazaarPieces.add(p.pieceId);
          } catch { /* ignore */ }
        }
        continue;
      }
    }

    const verdict = evaluate(db, unit.unit_id, rec, batchState, auth);
    if (!verdict.ok) {
      rejected.push({ id: rec && rec.id, reason: verdict.reason });
      continue;
    }

    const stored = { ...rec, sync: 'synced', rejectReason: undefined };
    delete stored.rejectReason;
    const seq = insertRecord(db, {
      id: rec.id,
      unitId: unit.unit_id,
      type: rec.type,
      json: JSON.stringify({ ...stored, serverSeq: 0 }),
      at: rec.at,
    });
    // Patch serverSeq into the stored json now that we know the seq.
    const finalRec = { ...stored, serverSeq: seq };
    db.prepare('UPDATE records SET json = ? WHERE id = ?').run(JSON.stringify(finalRec), rec.id);

    // Index a slip token when a slip record is accepted (H4: store created_at).
    if (rec.type === 'slip' && rec.payload && typeof rec.payload.token === 'string') {
      indexSlip(db, {
        token: rec.payload.token,
        unitId: unit.unit_id,
        slipId: rec.id,
        json: JSON.stringify(rec.payload),
        createdAt: new Date().toISOString(),
      });
    }

    accepted.push(rec.id);
    batchState.ids.add(rec.id);
    if (rec.type === 'bazaar' && rec.payload && rec.payload.pieceId) {
      batchState.bazaarPieces.add(rec.payload.pieceId);
    }
  }

  // Pull: records with seq > since (server cap at PULL_LIMIT or honored body limit).
  const pulledRows = recordsSince(db, unit.unit_id, since, limit);
  const records = pulledRows.map((r) => JSON.parse(r.json));
  const cursor = pulledRows.length ? pulledRows[pulledRows.length - 1].seq : since;

  return sendJson(res, 200, { accepted, rejected, records, cursor }, req);
}

/**
 * SPEC-014: if the unit has users and the request carries a Bearer token, that
 * token's device must still be the user's ACTIVE binding (else 401
 * device_revoked). A unit-key-only photo request (no token) stays allowed for
 * back-compat and for units with no users yet. Returns null if OK, else an
 * already-sent error (caller returns immediately).
 */
function photoDeviceGuard(db, req, res, unit) {
  if (userRecordCount(db, unit.unit_id) === 0) return false;
  const token = bearerAuth(db, req);
  if (!token || token.unitId !== unit.unit_id) return false; // unit-key-only path
  if (!tokenDeviceActive(db, unit.unit_id, token)) {
    sendError(res, 401, 'device_revoked', req);
    return true;
  }
  return false;
}

async function handlePutPhoto(db, req, res, id) {
  const unit = authUnit(db, req);
  if (!unit) return sendError(res, 401, 'unauthorized', req);
  if (photoDeviceGuard(db, req, res, unit)) {
    await readBody(req, PHOTO_LIMIT).catch(() => undefined);
    return undefined;
  }
  const rawMime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!PHOTO_MIME_ALLOW.has(rawMime)) {
    // Drain the body so the socket stays usable, then reject (M3).
    await readBody(req, PHOTO_LIMIT).catch(() => undefined);
    return sendError(res, 415, 'unsupported_media_type', req);
  }
  const buf = await readBody(req, PHOTO_LIMIT);
  putPhoto(db, { id, unitId: unit.unit_id, mime: rawMime, bytes: buf });
  return sendJson(res, 200, { ok: true, id }, req);
}

function handleGetPhoto(db, req, res, id) {
  const unit = authUnit(db, req);
  if (!unit) return sendError(res, 401, 'unauthorized', req);
  if (photoDeviceGuard(db, req, res, unit)) return undefined;
  const row = getPhoto(db, unit.unit_id, id);
  if (!row) return sendError(res, 404, 'not_found', req);
  // Force a safe, allow-listed content-type regardless of what was stored, and
  // forbid sniffing / inline execution (M3).
  const mime = PHOTO_MIME_ALLOW.has(row.mime) ? row.mime : 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': row.bytes.length,
    'Content-Disposition': 'inline; filename="photo"',
    ...securityHeaders(),
    ...corsHeaders(req),
  });
  res.end(Buffer.from(row.bytes));
}

// ---------- devices (SPEC-014) ----------

/**
 * Resolve an owner-authenticated token request. Requires a valid unit key, a
 * valid Bearer token for THIS unit whose device is the active binding, and an
 * owner role. On failure sends the right status and returns null.
 */
function requireOwner(db, req, res, unit) {
  const token = bearerAuth(db, req);
  if (!token || token.unitId !== unit.unit_id) {
    sendError(res, 401, 'needs_login', req);
    return null;
  }
  if (!tokenDeviceActive(db, unit.unit_id, token)) {
    sendError(res, 401, 'device_revoked', req);
    return null;
  }
  if (userRole(db, unit.unit_id, token.userId) !== 'owner') {
    sendError(res, 403, 'forbidden', req);
    return null;
  }
  return token;
}

/** GET /api/devices (owner) → {devices:[{userId, deviceId, boundAt, lastSeenAt, revokedAt?, revokedBy?}]}. */
async function handleDevicesList(db, req, res) {
  const unit = authUnit(db, req);
  if (!unit) return sendError(res, 401, 'unauthorized', req);
  const token = requireOwner(db, req, res, unit);
  if (!token) return undefined;
  return sendJson(res, 200, { devices: listDevices(db, unit.unit_id) }, req);
}

/** POST /api/devices/:userId/signout (owner) → 204; 403 non-owner; 404 unknown user. */
async function handleDeviceSignout(db, req, res, userId) {
  const unit = authUnit(db, req);
  if (!unit) return sendError(res, 401, 'unauthorized', req);
  const token = requireOwner(db, req, res, unit);
  if (!token) return undefined;
  // Unknown user (no user record at all) → 404.
  if (!latestUser(db, unit.unit_id, userId)) return sendError(res, 404, 'not_found', req);
  revokeActiveDevice(db, unit.unit_id, userId, 'owner');
  res.writeHead(204, { ...securityHeaders(), ...corsHeaders(req) });
  res.end();
  return undefined;
}

function slipView(slipPayload) {
  return {
    kind: slipPayload.kind,
    weaverName: slipPayload.weaverName,
    lines: slipPayload.lines,
    textHi: slipPayload.textHi,
    textEn: slipPayload.textEn,
    // C9 spoken script (numbers in Hindi words) — same data as textHi, no extra PII.
    ...(typeof slipPayload.speechHi === 'string' ? { speechHi: slipPayload.speechHi } : {}),
  };
}

/** True if a slip row is past its TTL (H4). */
function slipExpired(slip) {
  if (!slip.created_at) return false; // legacy rows with no timestamp: never expire
  const created = Date.parse(slip.created_at);
  if (Number.isNaN(created)) return false;
  return Date.now() - created > SLIP_TTL_MS;
}

function handleSlipGet(db, req, res, token, limiter) {
  if (!limiter(clientIp(req))) return sendError(res, 429, 'rate_limited', req);
  if (typeof token !== 'string' || token.length < 22) return sendError(res, 404, 'not_found', req);
  const slip = getSlip(db, token);
  if (!slip) return sendError(res, 404, 'not_found', req);
  if (slipExpired(slip)) return sendError(res, 410, 'expired', req);
  const payload = JSON.parse(slip.json);
  const response = getSlipResponse(db, slip.unit_id, token);
  const out = { slip: slipView(payload) };
  if (response) out.response = response;
  return sendJson(res, 200, out, req);
}

async function handleSlipRespond(db, req, res, token, limiter) {
  if (!limiter(clientIp(req))) return sendError(res, 429, 'rate_limited', req);
  if (typeof token !== 'string' || token.length < 22) return sendError(res, 404, 'not_found', req);
  const slip = getSlip(db, token);
  if (!slip) return sendError(res, 404, 'not_found', req);
  if (slipExpired(slip)) return sendError(res, 410, 'expired', req);

  const body = await readJson(req, BODY_LIMIT);
  const answer = body.answer;
  if (answer !== 'agree' && answer !== 'dispute') return sendError(res, 400, 'invalid_answer', req);
  const note = typeof body.note === 'string' ? body.note : undefined;

  // Only one response per slip (one-time, even after a late expiry change).
  const existing = getSlipResponse(db, slip.unit_id, token);
  if (existing) return sendError(res, 409, 'already_answered', req);

  const slipPayload = JSON.parse(slip.json);
  const weaverId = slipPayload.weaverId || 'unknown';
  const now = new Date();
  const rec = {
    id: randomUUID(),
    type: 'slip_response',
    unitId: slip.unit_id,
    payload: { token, slipId: slip.slip_id, answer, note },
    by: 'weaver:' + weaverId,
    role: 'weaver',
    device: 'server',
    at: now.toISOString(),
    day: istDay(now),
    sync: 'synced',
  };
  const seq = insertRecord(db, {
    id: rec.id,
    unitId: slip.unit_id,
    type: rec.type,
    json: JSON.stringify({ ...rec, serverSeq: 0 }),
    at: rec.at,
  });
  db.prepare('UPDATE records SET json = ? WHERE id = ?').run(
    JSON.stringify({ ...rec, serverSeq: seq }),
    rec.id,
  );
  return sendJson(res, 200, { ok: true }, req);
}
