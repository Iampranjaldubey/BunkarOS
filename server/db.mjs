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
  const r = await q(db, 'SELECT unit_id, key_hash, salt, name FROM units WHERE unit_id = $1', [unitId]); return r.rows[0];
}
export async function insertUnit(db, { unitId, keyHash, salt, name, createdAt }) {
  await q(db, 'INSERT INTO units (unit_id, key_hash, salt, name, created_at) VALUES ($1,$2,$3,$4,$5)', [unitId, keyHash, salt, name, createdAt]);
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
