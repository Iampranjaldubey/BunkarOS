// Bunkar MVP server — Postgres schema + data access (pg Pool, async).
import pg from 'pg';
import { createHash, randomBytes } from 'node:crypto';

const { Pool } = pg;

/**
 * Open a pool and migrate. `schema` lets tests isolate themselves (one schema per run).
 * @param {{connectionString?:string, schema?:string}} opts
 */
export async function openDb(opts = {}) {
  const connectionString = opts.connectionString || process.env.DATABASE_URL || 'postgres://bunkar:bunkar@localhost:5432/bunkar';
  const schema = opts.schema || process.env.PGSCHEMA || 'public';
  const ssl = /sslmode=require|render\.com|railway/.test(connectionString) ? { rejectUnauthorized: false } : undefined;
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error('bad schema name');
  // The schema must exist before any pooled connection sets its search_path to it.
  const boot = new Pool({ connectionString, ssl, max: 1 });
  try {
    // PG_RESET=1 (never on public): start from an empty schema — used by the e2e harness.
    if ((opts.reset ?? process.env.PG_RESET === '1') && schema !== 'public') await boot.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await boot.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  } finally { await boot.end(); }
  // Migrate as the database owner, then serve every request through a role that row-level security applies to (SPEC-M18 §5).
  const owner = new Pool({ connectionString, ssl, max: 1, options: `-c search_path=${schema}` });
  let appRole = null;
  try {
    await owner.query(`
      CREATE TABLE IF NOT EXISTS units (
        unit_id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, salt TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records (
        seq BIGSERIAL PRIMARY KEY, id TEXT NOT NULL UNIQUE, unit_id TEXT NOT NULL, type TEXT NOT NULL,
        json JSONB NOT NULL, at TEXT NOT NULL, day TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS idx_records_unit_seq ON records (unit_id, seq);
      CREATE INDEX IF NOT EXISTS idx_records_unit_type ON records (unit_id, type);
      CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, unit_id TEXT NOT NULL, mime TEXT NOT NULL, bytes BYTEA NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      ALTER TABLE units ADD COLUMN IF NOT EXISTS short_code TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_units_short_code ON units (short_code);
      CREATE TABLE IF NOT EXISTS worker_links (
        token TEXT PRIMARY KEY, unit_id TEXT NOT NULL, worker_id TEXT NOT NULL,
        created_at TEXT NOT NULL, revoked_at TEXT);
      CREATE INDEX IF NOT EXISTS idx_worker_links_unit_worker ON worker_links (unit_id, worker_id);
      -- SPEC-M18 §1: organisation fields, owned by the platform (founders), never by the unit's owner.
      ALTER TABLE units ADD COLUMN IF NOT EXISTS industry TEXT NOT NULL DEFAULT 'carpet';
      ALTER TABLE units ADD COLUMN IF NOT EXISTS modules JSONB NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE units ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
      ALTER TABLE units ADD COLUMN IF NOT EXISTS created_by TEXT;
      -- SPEC-M18 §4: single-use owner invites; only hashes of the link token and the code are stored.
      CREATE TABLE IF NOT EXISTS invites (
        id TEXT PRIMARY KEY, unit_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, code_hash TEXT NOT NULL UNIQUE,
        owner_name TEXT NOT NULL, owner_phone TEXT NOT NULL, lang TEXT NOT NULL, created_by TEXT NOT NULL,
        created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, revoked_at TEXT);
      CREATE INDEX IF NOT EXISTS idx_invites_unit ON invites (unit_id);
      -- SPEC-M18 §6: append-only log of founder actions (the app role may insert and read, never update or delete).
      CREATE TABLE IF NOT EXISTS platform_events (
        seq BIGSERIAL PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, unit_id TEXT NOT NULL, action TEXT NOT NULL,
        before JSONB, after JSONB, reason TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS idx_platform_events_unit ON platform_events (unit_id, seq);
      -- SPEC-M18 §5: a unit request sees only its own business rows, even when a query forgets the filter.
      -- The founders' console reads across units only inside withAdmin() (app.admin = on) and can never write records.
      ALTER TABLE records ENABLE ROW LEVEL SECURITY; ALTER TABLE records FORCE ROW LEVEL SECURITY;
      ALTER TABLE photos ENABLE ROW LEVEL SECURITY; ALTER TABLE photos FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS unit_rows ON records;
      CREATE POLICY unit_rows ON records
        USING (unit_id = current_setting('app.unit_id', true) OR current_setting('app.admin', true) = 'on')
        WITH CHECK (unit_id = current_setting('app.unit_id', true));
      DROP POLICY IF EXISTS unit_rows ON photos;
      CREATE POLICY unit_rows ON photos
        USING (unit_id = current_setting('app.unit_id', true) OR current_setting('app.admin', true) = 'on')
        WITH CHECK (unit_id = current_setting('app.unit_id', true));
    `);
    appRole = await ensureAppRole(owner, schema);
  } finally { await owner.end(); }
  const pool = new Pool({ connectionString, ssl, max: 8, options: `-c search_path=${schema}${appRole ? ` -c role=${APP_ROLE}` : ''}` });
  const who = (await pool.query("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")).rows[0];
  /** 'role' = requests run as the limited app role; 'owner' = the owner is not exempt, FORCE applies; 'off' = not enforced (logged). */
  const rlsMode = appRole ? 'role' : who && !who.rolsuper && !who.rolbypassrls ? 'owner' : 'off';
  if (rlsMode === 'off') console.warn('row-level security is not enforced: the database user bypasses it and no app role could be created');
  return {
    pool, schema, rlsMode,
    async close() { await pool.end(); },
    async dropSchema() {
      if (schema === 'public') return;
      const o = new Pool({ connectionString, ssl, max: 1 });
      try { await o.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await o.end(); }
    },
  };
}

const APP_ROLE = 'bunkar_app';
/** Create the limited role once per cluster and grant it this schema. Returns false when the database user may not create roles. */
async function ensureAppRole(owner, schema) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await owner.query(`DO $$ BEGIN CREATE ROLE ${APP_ROLE} NOLOGIN NOBYPASSRLS; EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END $$`);
      await owner.query(`GRANT ${APP_ROLE} TO CURRENT_USER`);
      await owner.query(`
        GRANT USAGE ON SCHEMA ${schema} TO ${APP_ROLE};
        GRANT SELECT, INSERT, UPDATE ON units, records, worker_links, meta, invites TO ${APP_ROLE};
        GRANT SELECT, INSERT ON photos, platform_events TO ${APP_ROLE};
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${schema} TO ${APP_ROLE};`);
      return true;
    } catch (e) {
      if (/permission denied|must have|insufficient/i.test(String(e?.message))) return false;
      if (attempt === 2) throw e; // "tuple concurrently updated" when test files start together: retry
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 200));
    }
  }
  return false;
}

/**
 * SPEC-M18 §5: run fn inside one transaction scoped to a unit (or to the founders' read path).
 * Every records / photos query of a request goes through the db handle passed to fn. Commit happens before the
 * caller answers the request, so a response never reports data that was rolled back.
 */
async function scoped(db, settings, fn) {
  if (db.scoped) return fn(db);
  const c = await db.pool.connect();
  try {
    await c.query('BEGIN');
    for (const [k, v] of settings) await c.query('SELECT set_config($1, $2, true)', [k, v]);
    const out = await fn({ ...db, scoped: true, pool: { query: (t, p) => c.query(t, p) } });
    await c.query('COMMIT');
    return out;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally { c.release(); }
}
export const withUnit = (db, unitId, fn) => scoped(db, [['app.unit_id', String(unitId)]], fn);
export const withAdmin = (db, fn) => scoped(db, [['app.admin', 'on']], fn);

const q = (db, text, params) => db.pool.query(text, params);

export async function getMeta(db, key) { const r = await q(db, 'SELECT value FROM meta WHERE key = $1', [key]); return r.rows[0]?.value; }
export async function setMeta(db, key, value) {
  await q(db, 'INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, value]);
}
export async function getUnit(db, unitId) {
  const r = await q(db, 'SELECT unit_id, key_hash, salt, name, short_code, industry, modules, status FROM units WHERE unit_id = $1', [unitId]); return r.rows[0];
}
export async function getUnitByShortCode(db, shortCode) {
  const r = await q(db, 'SELECT unit_id, name, short_code, status FROM units WHERE short_code = $1', [shortCode]); return r.rows[0];
}
/** Insert a unit with a fresh 6-digit short code (retried on the rare collision). */
export async function insertUnit(db, { unitId, keyHash, salt, name, createdAt }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortCode = String(100000 + Math.floor(Math.random() * 900000));
    try {
      await q(db, 'INSERT INTO units (unit_id, key_hash, salt, name, created_at, short_code) VALUES ($1,$2,$3,$4,$5,$6)', [unitId, keyHash, salt, name, createdAt, shortCode]);
      return shortCode;
    } catch (e) { if (!/idx_units_short_code/.test(String(e?.message))) throw e; }
  }
  throw new Error('short_code_collision');
}
/** Ensure a unit created before short codes existed gets one. */
export async function ensureShortCode(db, unitId) {
  const u = await getUnit(db, unitId);
  if (u?.short_code) return u.short_code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortCode = String(100000 + Math.floor(Math.random() * 900000));
    try { await q(db, 'UPDATE units SET short_code = $1 WHERE unit_id = $2', [shortCode, unitId]); return shortCode; }
    catch (e) { if (!/idx_units_short_code/.test(String(e?.message))) throw e; }
  }
  throw new Error('short_code_collision');
}
/** Latest non-reversed `worker` payload for workerId, or undefined. */
export async function latestWorker(db, unitId, workerId) {
  const reversed = await reversedTargetIds(db, unitId);
  let best;
  for (const row of await recordsOfType(db, unitId, 'worker')) {
    if (reversed.has(row.id)) continue;
    const p = row.rec?.payload;
    if (!p || p.entityId !== workerId) continue;
    if (!best || (row.rec.at || '') >= best.at) best = { at: row.rec.at || '', p };
  }
  return best?.p;
}
/** Latest active workers (name + id) of a unit, for the shop-code join screen. */
export async function activeWorkers(db, unitId) {
  const reversed = await reversedTargetIds(db, unitId);
  const latest = new Map();
  for (const row of await recordsOfType(db, unitId, 'worker')) {
    if (reversed.has(row.id)) continue;
    const p = row.rec?.payload; if (!p?.entityId) continue;
    const prev = latest.get(p.entityId);
    if (!prev || (row.rec.at || '') >= prev.at) latest.set(p.entityId, { at: row.rec.at || '', p });
  }
  return [...latest.values()].map((v) => v.p).filter((p) => p.active).map((p) => ({ workerId: p.entityId, name: p.name, jobTitle: p.jobTitle }));
}
/** Records a worker may see about themselves: their own events + all reversals + period locks + latest settings. */
export async function workerRecords(db, unitId, workerId) {
  const r = await q(db, `SELECT json FROM records WHERE unit_id = $1 AND (
      (type IN ('attendance','piece_entry','advance','wage_payment') AND json->'payload'->>'workerId' = $2)
      OR type IN ('reversal','period_lock','setting')) ORDER BY seq ASC`, [unitId, workerId]);
  return r.rows.map((row) => row.json);
}
// ---------- worker links ----------
export async function activeWorkerLink(db, unitId, workerId) {
  const r = await q(db, 'SELECT token, created_at FROM worker_links WHERE unit_id = $1 AND worker_id = $2 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1', [unitId, workerId]);
  return r.rows[0];
}
export async function createWorkerLink(db, unitId, workerId, token) {
  await q(db, 'UPDATE worker_links SET revoked_at = $1 WHERE unit_id = $2 AND worker_id = $3 AND revoked_at IS NULL', [new Date().toISOString(), unitId, workerId]);
  await q(db, 'INSERT INTO worker_links (token, unit_id, worker_id, created_at) VALUES ($1,$2,$3,$4)', [token, unitId, workerId, new Date().toISOString()]);
}
export async function revokeWorkerLinks(db, unitId, workerId) {
  await q(db, 'UPDATE worker_links SET revoked_at = $1 WHERE unit_id = $2 AND worker_id = $3 AND revoked_at IS NULL', [new Date().toISOString(), unitId, workerId]);
}
export async function getWorkerLink(db, token) {
  const r = await q(db, 'SELECT token, unit_id, worker_id, created_at, revoked_at FROM worker_links WHERE token = $1', [token]); return r.rows[0];
}
export async function getRecordById(db, id) {
  const r = await q(db, 'SELECT seq, id, unit_id, type, json FROM records WHERE id = $1', [id]); return r.rows[0];
}
/** Insert and return the final record JSON with serverSeq patched in (one round trip + update). */
export async function insertRecord(db, { id, unitId, type, rec }) {
  const r = await q(db, 'INSERT INTO records (id, unit_id, type, json, at, day) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING RETURNING seq',
    [id, unitId, type, JSON.stringify({ ...rec, serverSeq: 0 }), rec.at, rec.day || '']);
  if (r.rowCount === 0) return null; // the id belongs to another unit's record (invisible here): the caller refuses it
  const seq = Number(r.rows[0].seq);
  const finalRec = { ...rec, serverSeq: seq };
  await q(db, 'UPDATE records SET json = $1 WHERE id = $2', [JSON.stringify(finalRec), id]);
  return { seq, rec: finalRec };
}
export async function recordsSince(db, unitId, since, limit = 500) {
  const r = await q(db, 'SELECT seq, json FROM records WHERE unit_id = $1 AND seq > $2 ORDER BY seq ASC LIMIT $3', [unitId, since, limit]);
  return r.rows.map((row) => ({ seq: Number(row.seq), rec: row.json }));
}
export async function userRecordsSince(db, unitId, since, limit = 500) {
  const r = await q(db, "SELECT seq, json FROM records WHERE unit_id = $1 AND type = 'user' AND seq > $2 ORDER BY seq ASC LIMIT $3", [unitId, since, limit]);
  return r.rows.map((row) => ({ seq: Number(row.seq), rec: row.json }));
}
export async function recordsOfType(db, unitId, type) {
  const r = await q(db, 'SELECT seq, id, json FROM records WHERE unit_id = $1 AND type = $2 ORDER BY seq ASC', [unitId, type]);
  return r.rows.map((row) => ({ seq: Number(row.seq), id: row.id, rec: row.json }));
}
export async function userRecordCount(db, unitId) {
  const r = await q(db, "SELECT COUNT(*)::int AS n FROM records WHERE unit_id = $1 AND type = 'user'", [unitId]); return r.rows[0].n;
}
export async function reversedTargetIds(db, unitId) {
  const r = await q(db, "SELECT json->'payload'->>'targetId' AS t FROM records WHERE unit_id = $1 AND type = 'reversal'", [unitId]);
  return new Set(r.rows.map((row) => row.t).filter(Boolean));
}
/** Latest non-reversed `user` payload for userId, or undefined. */
export async function latestUser(db, unitId, userId) {
  if (typeof userId !== 'string' || !userId) return undefined;
  const reversed = await reversedTargetIds(db, unitId);
  let best;
  for (const row of await recordsOfType(db, unitId, 'user')) {
    if (reversed.has(row.id)) continue;
    const p = row.rec?.payload;
    if (!p || p.entityId !== userId) continue;
    if (!best || (row.rec.at || '') >= best.at) best = { at: row.rec.at || '', p };
  }
  return best?.p;
}
export async function userRole(db, unitId, userId) { return (await latestUser(db, unitId, userId))?.role; }
/** Locked months (period_lock minus reversed). */
export async function lockedMonths(db, unitId) {
  const reversed = await reversedTargetIds(db, unitId);
  const out = new Set();
  for (const row of await recordsOfType(db, unitId, 'period_lock')) if (!reversed.has(row.id) && row.rec?.payload?.month) out.add(row.rec.payload.month);
  return out;
}
/**
 * SPEC-M16 §4: current balance per item (thousandths) from the stored records, reversed ones excluded.
 * Same sum as the app's stockBalance(): in + finished in − out ± adjust − deliveries from a finished item.
 */
export async function stockBalances(db, unitId, moveOf) {
  const reversed = await reversedTargetIds(db, unitId);
  const r = await q(db, "SELECT id, json FROM records WHERE unit_id = $1 AND type IN ('stock_in','stock_out','stock_adjust','finished_in','delivery')", [unitId]);
  const out = new Map();
  for (const row of r.rows) {
    if (reversed.has(row.id)) continue;
    const m = moveOf(row.json);
    if (m && typeof m.itemId === 'string') out.set(m.itemId, (out.get(m.itemId) ?? 0) + m.delta);
  }
  return out;
}
/** Latest non-reversed `setting` payload of the unit (the unit rules, SPEC-M13). */
export async function latestSetting(db, unitId) {
  const reversed = await reversedTargetIds(db, unitId);
  let best;
  for (const row of await recordsOfType(db, unitId, 'setting')) {
    if (reversed.has(row.id)) continue;
    if (!best || (row.rec.at || '') >= best.at) best = { at: row.rec.at || '', p: row.rec.payload };
  }
  return best?.p;
}
/** Latest non-reversed payload per entityId of a master type (Map). */
export async function latestByEntity(db, unitId, type) {
  const reversed = await reversedTargetIds(db, unitId);
  const out = new Map();
  for (const row of await recordsOfType(db, unitId, type)) {
    if (reversed.has(row.id)) continue;
    const p = row.rec?.payload; if (!p?.entityId) continue;
    const prev = out.get(p.entityId);
    if (!prev || (row.rec.at || '') >= prev.at) out.set(p.entityId, { at: row.rec.at || '', p });
  }
  return new Map([...out].map(([k, v]) => [k, v.p]));
}
/** SPEC-M14: (worker|month) pairs that have a reversed payment, and months whose lock was reversed (= locked before). */
export async function correctionHistory(db, unitId) {
  const reversed = await reversedTargetIds(db, unitId);
  const reversedPaid = new Set(); const relocked = new Set();
  for (const row of await recordsOfType(db, unitId, 'wage_payment')) if (reversed.has(row.id) && row.rec?.payload) reversedPaid.add(`${row.rec.payload.workerId}|${row.rec.payload.month}`);
  for (const row of await recordsOfType(db, unitId, 'period_lock')) if (reversed.has(row.id) && row.rec?.payload?.month) relocked.add(row.rec.payload.month);
  return { reversedPaid, relocked };
}
/** Active wage_payment (worker, month) pairs. */
export async function paidPairs(db, unitId) {
  const reversed = await reversedTargetIds(db, unitId);
  const out = new Set();
  for (const row of await recordsOfType(db, unitId, 'wage_payment')) if (!reversed.has(row.id) && row.rec?.payload) out.add(`${row.rec.payload.workerId}|${row.rec.payload.month}`);
  return out;
}
/**
 * SPEC-M16 §6: a photo id belongs to the first unit that stores it and is never overwritten.
 * Returns 'stored' (new), 'same' (this unit re-sent identical bytes: a retry), 'exists' (this unit, other bytes)
 * or 'taken' (another unit owns the id). Only 'stored' writes anything.
 */
export async function putPhoto(db, { id, unitId, mime, bytes }) {
  const ins = await q(db, 'INSERT INTO photos (id, unit_id, mime, bytes) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING RETURNING id', [id, unitId, mime, bytes]);
  if (ins.rowCount === 1) return 'stored';
  const r = await q(db, 'SELECT unit_id, mime, bytes FROM photos WHERE id = $1', [id]);
  const row = r.rows[0];
  if (!row) return 'taken'; // another unit owns the id (row-level security hides its row)
  if (row.unit_id !== unitId) return 'taken';
  return Buffer.from(row.bytes).equals(Buffer.from(bytes)) && row.mime === mime ? 'same' : 'exists';
}
export async function getPhoto(db, unitId, id) {
  const r = await q(db, 'SELECT mime, bytes FROM photos WHERE id = $1 AND unit_id = $2', [id, unitId]); return r.rows[0];
}

// ---------- SPEC-M18: organisations, invites, platform events ----------
const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
export function newInviteCode() { let c = ''; for (const b of randomBytes(8)) c += CODE_CHARS[b % CODE_CHARS.length]; return c; }
/** "abcd-EFGH" → "ABCDEFGH" (the code is shown as two groups of four). */
export const normaliseCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const INVITE_DAYS = 7;

/** SPEC-M18 §4: a unit created by a founder, waiting for its owner (no key yet, so it cannot sync). */
export async function insertInvitedUnit(db, { unitId, name, industry, modules, createdBy }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const shortCode = String(100000 + Math.floor(Math.random() * 900000));
    try {
      await q(db, `INSERT INTO units (unit_id, key_hash, salt, name, created_at, short_code, industry, modules, status, created_by)
        VALUES ($1, '', '', $2, $3, $4, $5, $6, 'invited', $7)`, [unitId, name, new Date().toISOString(), shortCode, industry, JSON.stringify(modules), createdBy]);
      return shortCode;
    } catch (e) { if (!/idx_units_short_code/.test(String(e?.message))) throw e; }
  }
  throw new Error('short_code_collision');
}
/** A new single-use invite for the unit; earlier open invites stop working. Returns the secrets once (only hashes are stored). */
export async function createInvite(db, { unitId, ownerName, ownerPhone, lang, createdBy }) {
  const now = new Date();
  await q(db, 'UPDATE invites SET revoked_at = $1 WHERE unit_id = $2 AND used_at IS NULL AND revoked_at IS NULL', [now.toISOString(), unitId]);
  const token = randomBytes(24).toString('base64url');
  const code = newInviteCode();
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 86_400_000).toISOString();
  await q(db, `INSERT INTO invites (id, unit_id, token_hash, code_hash, owner_name, owner_phone, lang, created_by, created_at, expires_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [randomBytes(9).toString('base64url'), unitId, sha256(token), sha256(code), ownerName, ownerPhone, lang, createdBy, now.toISOString(), expiresAt]);
  return { token, code, expiresAt };
}
export async function cancelInvites(db, unitId) {
  const r = await q(db, 'UPDATE invites SET revoked_at = $1 WHERE unit_id = $2 AND used_at IS NULL AND revoked_at IS NULL', [new Date().toISOString(), unitId]);
  return r.rowCount;
}
/** The invite for a link token or a typed code, with its state: 'open' | 'used' | 'revoked' | 'expired'. */
export async function findInvite(db, { token, code }) {
  const r = token
    ? await q(db, 'SELECT * FROM invites WHERE token_hash = $1', [sha256(token)])
    : await q(db, 'SELECT * FROM invites WHERE code_hash = $1', [sha256(normaliseCode(code))]);
  const i = r.rows[0];
  if (!i) return undefined;
  const state = i.used_at ? 'used' : i.revoked_at ? 'revoked' : i.expires_at < new Date().toISOString() ? 'expired' : 'open';
  return { ...i, state };
}
/** Use an open invite: the phone's unit key becomes the unit's key and the unit becomes active. One winner if two phones race. */
export async function claimInvite(db, inviteId, unitId, { keyHash, salt }) {
  const now = new Date().toISOString();
  const used = await q(db, 'UPDATE invites SET used_at = $1 WHERE id = $2 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > $1', [now, inviteId]);
  if (used.rowCount !== 1) return false;
  await q(db, "UPDATE units SET key_hash = $1, salt = $2, status = 'active' WHERE unit_id = $3 AND status = 'invited'", [keyHash, salt, unitId]);
  return true;
}
export async function latestInvite(db, unitId) {
  const r = await q(db, 'SELECT owner_name, owner_phone, lang, created_at, expires_at, used_at, revoked_at FROM invites WHERE unit_id = $1 ORDER BY created_at DESC LIMIT 1', [unitId]);
  const i = r.rows[0];
  if (!i) return undefined;
  const state = i.used_at ? 'used' : i.revoked_at ? 'revoked' : i.expires_at < new Date().toISOString() ? 'expired' : 'open';
  return { ownerName: i.owner_name, ownerPhone: i.owner_phone, lang: i.lang, createdAt: i.created_at, expiresAt: i.expires_at, usedAt: i.used_at, state };
}
export async function setOrgFields(db, unitId, fields) {
  const sets = []; const vals = [];
  if (fields.modules) { vals.push(JSON.stringify(fields.modules)); sets.push(`modules = $${vals.length}`); }
  if (fields.status) { vals.push(fields.status); sets.push(`status = $${vals.length}`); }
  if (!sets.length) return;
  vals.push(unitId);
  await q(db, `UPDATE units SET ${sets.join(', ')} WHERE unit_id = $${vals.length}`, vals);
}
/** SPEC-M18 §6: one append-only row per founder action. */
export async function addPlatformEvent(db, { actor, unitId, action, before, after, reason = '' }) {
  await q(db, 'INSERT INTO platform_events (at, actor, unit_id, action, before, after, reason) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [new Date().toISOString(), actor, unitId, action, before === undefined ? null : JSON.stringify(before), after === undefined ? null : JSON.stringify(after), reason]);
}
export async function platformEvents(db, unitId) {
  const r = await q(db, 'SELECT seq, at, actor, action, before, after, reason FROM platform_events WHERE unit_id = $1 ORDER BY seq DESC LIMIT 200', [unitId]);
  return r.rows.map((e) => ({ seq: Number(e.seq), at: e.at, actor: e.actor, action: e.action, before: e.before, after: e.after, reason: e.reason }));
}

/**
 * SPEC-M18 + owner 2026-11-06: the founders see usage, not business data. Per unit: entries this month by module and
 * by login (name, role, entries, days), last activity. No worker names, amounts, stock or orders.
 */
export async function adminUsage(db, unitId, month, moduleOf) {
  const rows = (await q(db, `SELECT type, by, day, COUNT(*)::int AS n FROM (
      SELECT type, json->>'by' AS by, day FROM records WHERE unit_id = $1 AND day LIKE $2 || '%' AND type NOT IN ('usage','reversal')) x
      GROUP BY type, by, day`, [unitId, month])).rows;
  const users = await latestOf(db, unitId, 'user');
  const name = new Map(users.map((u) => [u.entityId, u]));
  const byModule = {}; const byUser = new Map();
  for (const r of rows) {
    const m = moduleOf(r.type) ?? 'setup';
    byModule[m] = (byModule[m] ?? 0) + r.n;
    const u = byUser.get(r.by) ?? { entries: 0, days: new Set() };
    u.entries += r.n; u.days.add(r.day); byUser.set(r.by, u);
  }
  const last = (await q(db, "SELECT MAX(at) AS last_at FROM records WHERE unit_id = $1 AND type <> 'usage'", [unitId])).rows[0]?.last_at ?? null;
  const opens = (await q(db, "SELECT COUNT(*)::int AS n FROM records WHERE unit_id = $1 AND type = 'usage' AND day LIKE $2 || '%'", [unitId, month])).rows[0].n;
  return {
    month, lastAt: last, ownerOpens: opens, byModule,
    byUser: [...byUser].map(([id, u]) => ({ name: name.get(id)?.name ?? id.slice(0, 6), role: name.get(id)?.role ?? '', entries: u.entries, days: u.days.size })).sort((a, b) => b.entries - a.entries),
    logins: users.filter((u) => u.active).length,
    workers: (await latestOf(db, unitId, 'worker')).filter((w) => w.active).length,
  };
}

// ---------- SPEC-M09: platform admin (read-only, all units) ----------
/** Every unit with activity counts (one query each; unit counts are small). */
export async function adminUnits(db, month) {
  const units = (await q(db, 'SELECT unit_id, name, short_code, created_at, industry, modules, status FROM units ORDER BY created_at DESC')).rows;
  const out = [];
  for (const u of units) {
    const stats = (await q(db, `SELECT
        COUNT(*)::int AS records,
        COUNT(*) FILTER (WHERE type = 'user')::int AS user_versions,
        MAX(at) AS last_at,
        COUNT(*) FILTER (WHERE day LIKE $2 || '%' AND type NOT IN ('usage','reversal'))::int AS month_entries,
        COUNT(DISTINCT day) FILTER (WHERE day LIKE $2 || '%' AND type NOT IN ('usage','reversal'))::int AS month_days
      FROM records WHERE unit_id = $1`, [u.unit_id, month])).rows[0];
    const users = await latestOf(db, u.unit_id, 'user');
    const workers = await latestOf(db, u.unit_id, 'worker');
    const owner = users.find((x) => x.role === 'owner');
    out.push({
      unitId: u.unit_id, name: u.name, shortCode: u.short_code, createdAt: u.created_at, industry: u.industry, modules: u.modules, status: u.status,
      invite: u.status === 'invited' ? await latestInvite(db, u.unit_id) : undefined,
      ownerName: owner?.name ?? '', ownerPhone: owner?.phone ?? '',
      users: users.filter((x) => x.active).length, workers: workers.filter((x) => x.active).length,
      records: stats.records, monthEntries: stats.month_entries, monthDays: stats.month_days, lastAt: stats.last_at,
    });
  }
  return out;
}
/** Latest non-reversed payload per entityId for a master type. */
async function latestOf(db, unitId, type) {
  const reversed = await reversedTargetIds(db, unitId);
  const latest = new Map();
  for (const row of await recordsOfType(db, unitId, type)) {
    if (reversed.has(row.id)) continue;
    const p = row.rec?.payload; if (!p?.entityId) continue;
    const prev = latest.get(p.entityId);
    if (!prev || (row.rec.at || '') >= prev.at) latest.set(p.entityId, { at: row.rec.at || '', p });
  }
  return [...latest.values()].map((v) => v.p);
}
/** Price fields an operator may not see when "See prices" is off (SPEC-M13). */
export const PRICE_FIELDS = { order: ['pricePaise'], carpet: ['costPaise', 'pricePaise'] };
/**
 * A record as a client may see it. `user` records never carry PIN hash/salt (SPEC-M11).
 * With `view.seePrices === false` (an operator token while the owner hides prices) price fields are removed
 * by the server, so they never reach the operator's phone (SPEC-M13).
 */
export function publicRec(rec, view) {
  if (rec?.type === 'user' && rec.payload && ('pinHash' in rec.payload || 'pinSalt' in rec.payload)) {
    const { pinHash: _h, pinSalt: _s, ...rest } = rec.payload;
    return { ...rec, payload: rest };
  }
  const hide = view && view.seePrices === false ? PRICE_FIELDS[rec?.type] : undefined;
  if (hide && rec.payload && hide.some((k) => k in rec.payload)) {
    const payload = { ...rec.payload };
    for (const k of hide) delete payload[k];
    return { ...rec, payload };
  }
  return rec;
}
