// HTTP dispatcher on node:http. JSON everywhere except photo bodies.
import { getUnit, insertUnit, getRecordById, insertRecord, recordsSince, userRecordsSince, putPhoto, getPhoto,
  userRecordCount, latestUser, userRole, lockedMonths, paidPairs, recordsOfType,
  getUnitByShortCode, ensureShortCode, latestWorker, activeWorkers, workerRecords,
  activeWorkerLink, createWorkerLink, revokeWorkerLinks, getWorkerLink } from './db.mjs';
import { randomBytes } from 'node:crypto';
import { hashUnitKey, verifyUnitKey } from './auth.mjs';
import { evaluate } from './rules.mjs';
import { signToken, verifyToken, verifyPinServer } from './token.mjs';
import { serveStatic } from './static.mjs';

const BODY_LIMIT = Math.round(2.5 * 1024 * 1024);
const PHOTO_LIMIT = 400 * 1024; // D8: ≤ 300 KB JPEG (+ headroom)
const AUTH_RATE_MAX = Number(process.env.AUTH_RATE_MAX) > 0 ? Number(process.env.AUTH_RATE_MAX) : 20;
const RATE_WINDOW_MS = 60_000;
const PULL_LIMIT = 500;
const PHOTO_MIME_ALLOW = new Set(['image/jpeg', 'image/png', 'image/webp']);
const WORKER_RATE_MAX = Number(process.env.WORKER_RATE_MAX) > 0 ? Number(process.env.WORKER_RATE_MAX) : 60; // /api/w/* per IP per minute
const CLAIM_RATE_MAX = Number(process.env.CLAIM_RATE_MAX) > 0 ? Number(process.env.CLAIM_RATE_MAX) : 10;   // code guesses per IP per minute
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const ALLOWED_ORIGINS = new Set(['http://localhost:5174', 'http://localhost:4174', 'http://127.0.0.1:5174', 'http://127.0.0.1:4174']);

function corsHeaders(req) {
  const origin = req?.headers?.origin;
  const h = { 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-unit-id, x-unit-key', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
  if (typeof origin === 'string' && ALLOWED_ORIGINS.has(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
const securityHeaders = () => ({ 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" });
function sendJson(res, status, obj, req) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...securityHeaders(), ...corsHeaders(req) }); res.end(JSON.stringify(obj)); }
function sendError(res, status, error, req, extra) { sendJson(res, status, { ok: false, error, ...(extra || {}) }, req); }

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too_large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limit) { const buf = await readBody(req, limit); return buf.length === 0 ? {} : JSON.parse(buf.toString('utf8')); }

async function authUnit(db, req) {
  const unitId = req.headers['x-unit-id']; const unitKey = req.headers['x-unit-key'];
  if (typeof unitId !== 'string' || typeof unitKey !== 'string') return null;
  const unit = await getUnit(db, unitId);
  if (!unit || !verifyUnitKey(unitKey, unit.salt, unit.key_hash)) return null;
  return unit;
}
async function bearerAuth(db, req) {
  const h = req.headers['authorization'];
  if (typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/);
  return m ? verifyToken(db, m[1]) : null;
}
function clientIp(req) {
  if (TRUST_PROXY) { const fwd = req.headers['x-forwarded-for']; if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim(); }
  return req.socket?.remoteAddress || 'unknown';
}
function makeRateLimiter(max, windowMs) {
  const hits = new Map(); let lastSweep = Date.now();
  const sweep = (now) => { for (const [k, arr] of hits) { const live = arr.filter((t) => now - t < windowMs); if (live.length) hits.set(k, live); else hits.delete(k); } lastSweep = now; };
  return (ip) => { const now = Date.now(); if (now - lastSweep > windowMs) sweep(now); const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs); arr.push(now); hits.set(ip, arr); if (hits.size > 10_000) sweep(now); return arr.length <= max; };
}

export function makeHandler(db, opts = {}) {
  const authLimiter = makeRateLimiter(AUTH_RATE_MAX, RATE_WINDOW_MS);
  const workerLimiter = makeRateLimiter(WORKER_RATE_MAX, RATE_WINDOW_MS);
  const claimLimiter = makeRateLimiter(CLAIM_RATE_MAX, RATE_WINDOW_MS);
  const staticDir = opts.staticDir;
  return async function handler(req, res) {
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, { ...securityHeaders(), ...corsHeaders(req) }); res.end(); return; }
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      if (req.method === 'GET' && path === '/api/health') return sendJson(res, 200, { ok: true, status: 'healthy' }, req);
      if (req.method === 'POST' && path === '/api/units') return await handleCreateUnit(db, req, res);
      if (req.method === 'POST' && path === '/api/auth/token') return await handleAuthToken(db, req, res, authLimiter);
      if (req.method === 'POST' && path === '/api/sync') return await handleSync(db, req, res);
      if (req.method === 'GET' && path === '/api/units/me') return await handleUnitMe(db, req, res);
      if (req.method === 'POST' && path === '/api/worker-links') return await handleWorkerLink(db, req, res);
      if (req.method === 'POST' && path === '/api/worker-links/revoke') return await handleWorkerLinkRevoke(db, req, res);
      // Public worker endpoints (SPEC-M07): shop lookup, claim by code, data by token.
      const shop = path.match(/^\/api\/w\/shop\/(\d{6})$/);
      if (shop && req.method === 'GET') { if (!workerLimiter(clientIp(req))) return sendError(res, 429, 'rate_limited', req); return await handleWorkerShop(db, req, res, shop[1]); }
      if (req.method === 'POST' && path === '/api/w/claim') { if (!claimLimiter(clientIp(req))) return sendError(res, 429, 'rate_limited', req); return await handleWorkerClaim(db, req, res); }
      const wtok = path.match(/^\/api\/w\/([A-Za-z0-9_-]{22,64})$/);
      if (wtok && req.method === 'GET') { if (!workerLimiter(clientIp(req))) return sendError(res, 429, 'rate_limited', req); return await handleWorkerData(db, req, res, wtok[1]); }
      const photo = path.match(/^\/api\/photos\/([^/]+)$/);
      if (photo) {
        const id = decodeURIComponent(photo[1]);
        if (req.method === 'PUT') return await handlePutPhoto(db, req, res, id);
        if (req.method === 'GET') return await handleGetPhoto(db, req, res, id);
      }
      if (path.startsWith('/api/')) return sendError(res, 404, 'not_found', req);
      if (staticDir && (req.method === 'GET' || req.method === 'HEAD')) return await serveStatic(staticDir, path, req, res);
      return sendError(res, 404, 'not_found', req);
    } catch (err) {
      if (err?.message === 'too_large') return sendError(res, 413, 'payload_too_large', req);
      if (err instanceof SyntaxError) return sendError(res, 400, 'invalid_json', req);
      console.error(err);
      return sendError(res, 500, 'server_error', req);
    }
  };
}

async function handleCreateUnit(db, req, res) {
  const { unitId, unitKey, name } = await readJson(req, BODY_LIMIT);
  if (typeof unitId !== 'string' || !unitId || typeof unitKey !== 'string' || unitKey.length < 22) return sendError(res, 400, 'invalid', req);
  const existing = await getUnit(db, unitId);
  if (existing) {
    if (verifyUnitKey(unitKey, existing.salt, existing.key_hash)) return sendJson(res, 200, { ok: true, unitId, created: false, shortCode: await ensureShortCode(db, unitId) }, req);
    return sendError(res, 409, 'unit_exists', req);
  }
  const { salt, hash } = hashUnitKey(unitKey);
  const shortCode = await insertUnit(db, { unitId, keyHash: hash, salt, name: typeof name === 'string' && name ? name : unitId, createdAt: new Date().toISOString() });
  return sendJson(res, 201, { ok: true, unitId, created: true, shortCode }, req);
}

async function handleAuthToken(db, req, res, limiter) {
  if (!limiter(clientIp(req))) return sendError(res, 429, 'rate_limited', req);
  const body = await readJson(req, BODY_LIMIT);
  let unit = await authUnit(db, req);
  if (!unit && typeof body.unitId === 'string' && typeof body.unitKey === 'string') {
    const u = await getUnit(db, body.unitId);
    if (u && verifyUnitKey(body.unitKey, u.salt, u.key_hash)) unit = u;
  }
  if (!unit) return sendError(res, 401, 'unauthorized', req);
  const { userId, pin } = body;
  if (typeof userId !== 'string' || typeof pin !== 'string') return sendError(res, 400, 'invalid', req);
  const user = await latestUser(db, unit.unit_id, userId);
  if (!user || user.active !== true || !verifyPinServer(pin, user.pinHash, user.pinSalt)) return sendError(res, 401, 'unauthorized', req);
  const { token, exp } = await signToken(db, { unitId: unit.unit_id, userId });
  return sendJson(res, 200, { ok: true, token, exp }, req);
}

async function handleSync(db, req, res) {
  const unit = await authUnit(db, req);
  if (!unit) return sendError(res, 401, 'unauthorized', req);
  const body = await readJson(req, BODY_LIMIT);
  const incoming = Array.isArray(body.records) ? body.records : [];
  const since = Number.isFinite(body.since) ? Number(body.since) : 0;
  const limit = Number.isFinite(body.limit) && body.limit > 0 ? Math.min(Number(body.limit), PULL_LIMIT) : PULL_LIMIT;
  const unitId = unit.unit_id;

  const hasUsers = (await userRecordCount(db, unitId)) > 0;
  let auth = null;
  if (hasUsers) {
    const token = await bearerAuth(db, req);
    if (!token || token.unitId !== unitId) {
      if (incoming.length > 0) return sendError(res, 401, 'needs_login', req);
      const rows = await userRecordsSince(db, unitId, since, limit);
      return sendJson(res, 200, { accepted: [], rejected: [], records: rows.map((r) => r.rec), cursor: since }, req);
    }
    auth = { userId: token.userId, role: await userRole(db, unitId, token.userId) };
  }

  const accepted = []; const rejected = [];
  const ctx = {
    unitId, auth, hasUsers,
    locked: await lockedMonths(db, unitId),
    paid: await paidPairs(db, unitId),
    batch: { ids: new Set(), paid: new Set() },
    targets: null, prevWorker: null,
  };
  // Lazy helpers for rules that need other records.
  if (incoming.some((r) => r?.type === 'reversal')) {
    ctx.targets = new Map();
    for (const r of incoming) if (r?.type === 'reversal' && typeof r.payload?.targetId === 'string') {
      const row = await getRecordById(db, r.payload.targetId);
      if (row) ctx.targets.set(r.payload.targetId, row.json);
      else { const local = incoming.find((x) => x?.id === r.payload.targetId); if (local) ctx.targets.set(r.payload.targetId, local); }
    }
  }
  if (incoming.some((r) => r?.type === 'worker')) {
    const rows = await recordsOfType(db, unitId, 'worker');
    const latest = new Map();
    for (const row of rows) { const p = row.rec?.payload; if (p?.entityId) latest.set(p.entityId, p); }
    ctx.prevWorker = (entityId) => latest.get(entityId);
  }

  for (const rec of incoming) {
    if (rec && typeof rec.id === 'string') {
      const existing = await getRecordById(db, rec.id);
      if (existing) { accepted.push(rec.id); ctx.batch.ids.add(rec.id); continue; }
    }
    const verdict = evaluate(rec, ctx);
    if (!verdict.ok) { rejected.push({ id: rec?.id, reason: verdict.reason }); continue; }
    const stored = { ...rec, sync: 'synced' }; delete stored.rejectReason;
    await insertRecord(db, { id: rec.id, unitId, type: rec.type, rec: stored });
    accepted.push(rec.id); ctx.batch.ids.add(rec.id);
    if (rec.type === 'period_lock') ctx.locked.add(rec.payload.month);
  }

  const pulled = await recordsSince(db, unitId, since, limit);
  const cursor = pulled.length ? pulled[pulled.length - 1].seq : since;
  return sendJson(res, 200, { accepted, rejected, records: pulled.map((r) => r.rec), cursor }, req);
}

async function handlePutPhoto(db, req, res, id) {
  const unit = await authUnit(db, req);
  if (!unit) return sendError(res, 401, 'unauthorized', req);
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!PHOTO_MIME_ALLOW.has(mime)) { await readBody(req, PHOTO_LIMIT).catch(() => undefined); return sendError(res, 415, 'unsupported_media_type', req); }
  const buf = await readBody(req, PHOTO_LIMIT);
  await putPhoto(db, { id, unitId: unit.unit_id, mime, bytes: buf });
  return sendJson(res, 200, { ok: true, id }, req);
}
async function handleGetPhoto(db, req, res, id) {
  const unit = await authUnit(db, req);
  if (!unit) return sendError(res, 401, 'unauthorized', req);
  const row = await getPhoto(db, unit.unit_id, id);
  if (!row) return sendError(res, 404, 'not_found', req);
  const mime = PHOTO_MIME_ALLOW.has(row.mime) ? row.mime : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': row.bytes.length, 'Content-Disposition': 'inline; filename="photo"', 'X-Content-Type-Options': 'nosniff', ...corsHeaders(req) });
  res.end(Buffer.from(row.bytes));
}

// ---------- SPEC-M07: worker links + public worker data ----------

/** Resolve a logged-in owner/staff for unit-scoped actions; sends the error itself and returns null on failure. */
async function requireStaffOrOwner(db, req, res) {
  const unit = await authUnit(db, req);
  if (!unit) { sendError(res, 401, 'unauthorized', req); return null; }
  const token = await bearerAuth(db, req);
  if (!token || token.unitId !== unit.unit_id) { sendError(res, 401, 'needs_login', req); return null; }
  const role = await userRole(db, unit.unit_id, token.userId);
  if (role !== 'owner' && role !== 'staff') { sendError(res, 403, 'forbidden', req); return null; }
  return { unit, userId: token.userId, role };
}

/** GET /api/units/me → {unitId, name, shortCode} (unit-key auth). */
async function handleUnitMe(db, req, res) {
  const unit = await authUnit(db, req);
  if (!unit) return sendError(res, 401, 'unauthorized', req);
  return sendJson(res, 200, { ok: true, unitId: unit.unit_id, name: unit.name, shortCode: await ensureShortCode(db, unit.unit_id) }, req);
}

/** POST /api/worker-links {workerId, regenerate?} → {token}. Owner or staff. */
async function handleWorkerLink(db, req, res) {
  const who = await requireStaffOrOwner(db, req, res);
  if (!who) return undefined;
  const body = await readJson(req, BODY_LIMIT);
  if (typeof body.workerId !== 'string') return sendError(res, 400, 'invalid', req);
  const worker = await latestWorker(db, who.unit.unit_id, body.workerId);
  if (!worker || worker.active !== true) return sendError(res, 404, 'not_found', req);
  const existing = await activeWorkerLink(db, who.unit.unit_id, body.workerId);
  if (existing && !body.regenerate) return sendJson(res, 200, { ok: true, token: existing.token, created: false }, req);
  const token = randomBytes(24).toString('base64url');
  await createWorkerLink(db, who.unit.unit_id, body.workerId, token);
  return sendJson(res, 201, { ok: true, token, created: true }, req);
}

/** POST /api/worker-links/revoke {workerId} → 204. Owner or staff. */
async function handleWorkerLinkRevoke(db, req, res) {
  const who = await requireStaffOrOwner(db, req, res);
  if (!who) return undefined;
  const body = await readJson(req, BODY_LIMIT);
  if (typeof body.workerId !== 'string') return sendError(res, 400, 'invalid', req);
  await revokeWorkerLinks(db, who.unit.unit_id, body.workerId);
  res.writeHead(204, { ...securityHeaders(), ...corsHeaders(req) }); res.end();
  return undefined;
}

/** GET /api/w/shop/:code → {unitName, workers:[{workerId,name,jobTitle}]} (names only; rate-limited). */
async function handleWorkerShop(db, req, res, shortCode) {
  const unit = await getUnitByShortCode(db, shortCode);
  if (!unit) return sendError(res, 404, 'not_found', req);
  return sendJson(res, 200, { ok: true, unitName: unit.name, workers: await activeWorkers(db, unit.unit_id) }, req);
}

/** POST /api/w/claim {shopCode, workerId, code} → {token}. Verifies the worker's 4-digit access code. */
async function handleWorkerClaim(db, req, res) {
  const body = await readJson(req, BODY_LIMIT);
  const { shopCode, workerId, code } = body;
  if (typeof shopCode !== 'string' || typeof workerId !== 'string' || typeof code !== 'string') return sendError(res, 400, 'invalid', req);
  const unit = await getUnitByShortCode(db, shopCode);
  if (!unit) return sendError(res, 404, 'not_found', req);
  const worker = await latestWorker(db, unit.unit_id, workerId);
  if (!worker || worker.active !== true || typeof worker.accessCode !== 'string' || worker.accessCode !== code) return sendError(res, 401, 'wrong_code', req);
  const existing = await activeWorkerLink(db, unit.unit_id, workerId);
  if (existing) return sendJson(res, 200, { ok: true, token: existing.token }, req);
  const token = randomBytes(24).toString('base64url');
  await createWorkerLink(db, unit.unit_id, workerId, token);
  return sendJson(res, 200, { ok: true, token }, req);
}

/** GET /api/w/:token → everything a worker may see about themselves. 404 unknown, 410 revoked. */
async function handleWorkerData(db, req, res, token) {
  const link = await getWorkerLink(db, token);
  if (!link) return sendError(res, 404, 'not_found', req);
  if (link.revoked_at) return sendError(res, 410, 'revoked', req);
  const unit = await getUnit(db, link.unit_id);
  const worker = await latestWorker(db, link.unit_id, link.worker_id);
  if (!unit || !worker) return sendError(res, 404, 'not_found', req);
  const { accessCode: _hidden, ...safeWorker } = worker; // never expose the code on the public page
  const records = await workerRecords(db, link.unit_id, link.worker_id);
  let ownerPhone = '';
  for (const r of records) if (r.type === 'setting' && typeof r.payload?.ownerPhone === 'string') ownerPhone = r.payload.ownerPhone;
  return sendJson(res, 200, { ok: true, unitName: unit.name, shopCode: await ensureShortCode(db, unit.unit_id), ownerPhone, worker: safeWorker, workerId: link.worker_id, records, fetchedAt: new Date().toISOString() }, req);
}
