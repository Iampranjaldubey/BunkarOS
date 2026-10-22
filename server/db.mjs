// Bunkar MVP server — Postgres schema + data access (pg Pool, async).
import pg from 'pg';

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
  // `options` applies search_path at connection start — no per-connection race.
  const pool = new Pool({ connectionString, ssl, max: 8, options: `-c search_path=${schema}` });
  const c = await pool.connect();
  try {
    await c.query(`
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
    `);
  } finally { c.release(); }
  return { pool, schema, async close() { await pool.end(); }, async dropSchema() { if (schema !== 'public') await pool.query(`DROP SCHEMA ${schema} CASCADE`); } };
}

const q = (db, text, params) => db.pool.query(text, params);

export async function getMeta(db, key) { const r = await q(db, 'SELECT value FROM meta WHERE key = $1', [key]); return r.rows[0]?.value; }
export async function setMeta(db, key, value) {
  await q(db, 'INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, value]);
}
export async function getUnit(db, unitId) {
  const r = await q(db, 'SELECT unit_id, key_hash, salt, name, short_code FROM units WHERE unit_id = $1', [unitId]); return r.rows[0];
}
export async function getUnitByShortCode(db, shortCode) {
  const r = await q(db, 'SELECT unit_id, name, short_code FROM units WHERE short_code = $1', [shortCode]); return r.rows[0];
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
  const r = await q(db, 'INSERT INTO records (id, unit_id, type, json, at, day) VALUES ($1,$2,$3,$4,$5,$6) RETURNING seq',
    [id, unitId, type, JSON.stringify({ ...rec, serverSeq: 0 }), rec.at, rec.day || '']);
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
/** Active wage_payment (worker, month) pairs. */
export async function paidPairs(db, unitId) {
  const reversed = await reversedTargetIds(db, unitId);
  const out = new Set();
  for (const row of await recordsOfType(db, unitId, 'wage_payment')) if (!reversed.has(row.id) && row.rec?.payload) out.add(`${row.rec.payload.workerId}|${row.rec.payload.month}`);
  return out;
}
export async function putPhoto(db, { id, unitId, mime, bytes }) {
  await q(db, 'INSERT INTO photos (id, unit_id, mime, bytes) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET unit_id = EXCLUDED.unit_id, mime = EXCLUDED.mime, bytes = EXCLUDED.bytes', [id, unitId, mime, bytes]);
}
export async function getPhoto(db, unitId, id) {
  const r = await q(db, 'SELECT mime, bytes FROM photos WHERE id = $1 AND unit_id = $2', [id, unitId]); return r.rows[0];
}

// ---------- SPEC-M09: platform admin (read-only, all units) ----------
/** Every unit with activity counts (one query each; unit counts are small). */
export async function adminUnits(db, month) {
  const units = (await q(db, 'SELECT unit_id, name, short_code, created_at FROM units ORDER BY created_at DESC')).rows;
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
      unitId: u.unit_id, name: u.name, shortCode: u.short_code, createdAt: u.created_at,
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
/** All records of a unit with secrets stripped (PIN hashes). */
export async function adminUnitRecords(db, unitId) {
  const r = await q(db, 'SELECT json FROM records WHERE unit_id = $1 ORDER BY seq ASC', [unitId]);
  return r.rows.map((row) => {
    const rec = row.json;
    if (rec.type === 'user' && rec.payload) { const { pinHash: _h, pinSalt: _s, ...rest } = rec.payload; return { ...rec, payload: rest }; }
    return rec;
  });
}
