// Bunkar OS server — SQLite schema + data access (zero deps, node:sqlite).
// Tables:
//   units  (unit_id pk, key_hash, salt, name, created_at)
//   records(seq integer pk autoincrement, id unique, unit_id, type, json, at)
//   photos (id pk, unit_id, mime, bytes blob)
//   slips  (token pk, unit_id, slip_id, json, created_at)
//   meta   (key pk, value)   -- server-level key/value (e.g. HMAC secret)
import { DatabaseSync } from 'node:sqlite';

/**
 * Open (and migrate) the SQLite database at dbPath.
 * @param {string} dbPath
 * @returns {DatabaseSync}
 */
export function openDb(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS units (
      unit_id    TEXT PRIMARY KEY,
      key_hash   TEXT NOT NULL,
      salt       TEXT NOT NULL,
      name       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS records (
      seq     INTEGER PRIMARY KEY AUTOINCREMENT,
      id      TEXT NOT NULL UNIQUE,
      unit_id TEXT NOT NULL,
      type    TEXT NOT NULL,
      json    TEXT NOT NULL,
      at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_records_unit_seq ON records (unit_id, seq);
    CREATE TABLE IF NOT EXISTS photos (
      id      TEXT PRIMARY KEY,
      unit_id TEXT NOT NULL,
      mime    TEXT NOT NULL,
      bytes   BLOB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS slips (
      token      TEXT PRIMARY KEY,
      unit_id    TEXT NOT NULL,
      slip_id    TEXT NOT NULL,
      json       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS devices (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id      TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      device_id    TEXT NOT NULL,
      bound_at     TEXT NOT NULL,
      last_seen_at TEXT NOT NULL DEFAULT '',
      revoked_at   TEXT,
      revoked_by   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_devices_unit_user ON devices (unit_id, user_id);
  `);
  // Migration: add created_at to slips created by an older schema.
  const slipCols = db.prepare('PRAGMA table_info(slips)').all();
  if (!slipCols.some((c) => c.name === 'created_at')) {
    db.exec("ALTER TABLE slips ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
  }
  return db;
}

/** Read a server-level meta value, or undefined. */
export function getMeta(db, key) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : undefined;
}

/** Persist a server-level meta value (upsert). */
export function setMeta(db, key, value) {
  db.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}

/** @returns {{unit_id:string,key_hash:string,salt:string,name:string}|undefined} */
export function getUnit(db, unitId) {
  return db.prepare('SELECT unit_id, key_hash, salt, name FROM units WHERE unit_id = ?').get(unitId);
}

export function insertUnit(db, { unitId, keyHash, salt, name, createdAt }) {
  db.prepare(
    'INSERT INTO units (unit_id, key_hash, salt, name, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(unitId, keyHash, salt, name, createdAt);
}

/** @returns {{id:string,unit_id:string,type:string,json:string}|undefined} */
export function getRecordById(db, id) {
  return db.prepare('SELECT seq, id, unit_id, type, json FROM records WHERE id = ?').get(id);
}

/** Insert a record row. Caller supplies the full canonical JSON (incl. serverSeq placeholder). */
export function insertRecord(db, { id, unitId, type, json, at }) {
  const info = db
    .prepare('INSERT INTO records (id, unit_id, type, json, at) VALUES (?, ?, ?, ?, ?)')
    .run(id, unitId, type, json, at);
  return Number(info.lastInsertRowid);
}

/** All records of a unit with seq > since, ordered by seq ascending. */
export function recordsSince(db, unitId, since, limit = 500) {
  return db
    .prepare('SELECT seq, json FROM records WHERE unit_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?')
    .all(unitId, since, limit);
}

/** All records of a given type for a unit (used by rules), ordered by seq asc. */
export function recordsOfType(db, unitId, type) {
  return db
    .prepare('SELECT seq, id, json FROM records WHERE unit_id = ? AND type = ? ORDER BY seq ASC')
    .all(unitId, type);
}

/**
 * Bootstrap pull: `user` records of a unit with seq > since, ordered by seq asc.
 * Used to let a freshly-joined device (unit key only, no token yet) render the
 * login screen. Only `user` records are returned — they carry names/photoIds and
 * the PBKDF2 pinHash/pinSalt (never the raw PIN), and PIN verification stays
 * server-side in /api/auth/token, so this does not weaken authentication.
 */
export function userRecordsSince(db, unitId, since, limit = 500) {
  return db
    .prepare(
      "SELECT seq, json FROM records WHERE unit_id = ? AND type = 'user' AND seq > ? " +
        'ORDER BY seq ASC LIMIT ?',
    )
    .all(unitId, since, limit);
}

export function putPhoto(db, { id, unitId, mime, bytes }) {
  db.prepare(
    'INSERT INTO photos (id, unit_id, mime, bytes) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET unit_id = excluded.unit_id, mime = excluded.mime, bytes = excluded.bytes',
  ).run(id, unitId, mime, bytes);
}

/** @returns {{mime:string,bytes:Uint8Array}|undefined} */
export function getPhoto(db, unitId, id) {
  const row = db.prepare('SELECT mime, bytes FROM photos WHERE id = ? AND unit_id = ?').get(id, unitId);
  return row;
}

export function indexSlip(db, { token, unitId, slipId, json, createdAt }) {
  db.prepare(
    'INSERT INTO slips (token, unit_id, slip_id, json, created_at) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT(token) DO UPDATE SET unit_id = excluded.unit_id, slip_id = excluded.slip_id, json = excluded.json',
  ).run(token, unitId, slipId, json, createdAt || new Date().toISOString());
}

/** @returns {{token:string,unit_id:string,slip_id:string,json:string,created_at:string}|undefined} */
export function getSlip(db, token) {
  return db
    .prepare('SELECT token, unit_id, slip_id, json, created_at FROM slips WHERE token = ?')
    .get(token);
}

/**
 * Count of `user` records for a unit (used to detect bootstrap: zero users).
 * @returns {number}
 */
export function userRecordCount(db, unitId) {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM records WHERE unit_id = ? AND type = 'user'")
    .get(unitId);
  return row ? Number(row.n) : 0;
}

/**
 * Resolve the authoritative role of a user from stored `user` records.
 * Masters are versioned by payload.entityId; the latest `at` wins. Reversed
 * user records are ignored. Returns the role string or undefined if unknown.
 */
export function userRole(db, unitId, userId) {
  const u = latestUser(db, unitId, userId);
  return u ? u.role : undefined;
}

/** Set of record ids that have been reversed in a unit. */
function reversedTargetIdSet(db, unitId) {
  const rows = db
    .prepare("SELECT json FROM records WHERE unit_id = ? AND type = 'reversal'")
    .all(unitId);
  const set = new Set();
  for (const row of rows) {
    try {
      const rec = JSON.parse(row.json);
      if (rec.payload && typeof rec.payload.targetId === 'string') set.add(rec.payload.targetId);
    } catch {
      /* ignore */
    }
  }
  return set;
}

/**
 * Latest non-reversed `user` payload for a userId (entityId). Returns the full
 * payload {entityId,name,role,pinHash,pinSalt,active,...} or undefined.
 */
export function latestUser(db, unitId, userId) {
  if (typeof userId !== 'string' || !userId) return undefined;
  const reversed = reversedTargetIdSet(db, unitId);
  const rows = recordsOfType(db, unitId, 'user');
  let best;
  for (const row of rows) {
    if (reversed.has(row.id)) continue;
    let rec;
    try {
      rec = JSON.parse(row.json);
    } catch {
      continue;
    }
    const p = rec && rec.payload;
    if (!p || p.entityId !== userId) continue;
    if (!best || (rec.at || '') >= best.at) best = { at: rec.at || '', p };
  }
  return best ? best.p : undefined;
}

/**
 * First slip_response record for a given slip token in a unit, or undefined.
 * Scans slip_response records (small volume per unit) and matches payload.token.
 * @returns {{answer:'agree'|'dispute', at:string}|undefined}
 */
export function getSlipResponse(db, unitId, token) {
  const rows = db
    .prepare("SELECT json FROM records WHERE unit_id = ? AND type = 'slip_response' ORDER BY seq ASC")
    .all(unitId);
  for (const row of rows) {
    const rec = JSON.parse(row.json);
    if (rec.payload && rec.payload.token === token) {
      return { answer: rec.payload.answer, at: rec.at };
    }
  }
  return undefined;
}

// ---------- devices (SPEC-014: one device per login + remote sign-out) ----------

/**
 * The ACTIVE (non-revoked) binding for a user, or undefined. A user has at most
 * one active binding at a time; takeover/sign-out revokes the previous one.
 * @returns {{id:number,unit_id:string,user_id:string,device_id:string,bound_at:string,last_seen_at:string,revoked_at:?string,revoked_by:?string}|undefined}
 */
export function getActiveDevice(db, unitId, userId) {
  return db
    .prepare(
      'SELECT id, unit_id, user_id, device_id, bound_at, last_seen_at, revoked_at, revoked_by ' +
        'FROM devices WHERE unit_id = ? AND user_id = ? AND revoked_at IS NULL ' +
        'ORDER BY id DESC LIMIT 1',
    )
    .get(unitId, userId);
}

/** Revoke the active binding for a user (if any). `revokedBy` is 'owner' or 'system'. */
export function revokeActiveDevice(db, unitId, userId, revokedBy, atISO) {
  const at = atISO || new Date().toISOString();
  db.prepare(
    'UPDATE devices SET revoked_at = ?, revoked_by = ? ' +
      'WHERE unit_id = ? AND user_id = ? AND revoked_at IS NULL',
  ).run(at, revokedBy, unitId, userId);
}

/**
 * Bind a user to a device. If the same device is already the active binding this
 * is a no-op refresh (returns it). Otherwise any current active binding is
 * revoked by `revokedBy` and a fresh binding row is inserted.
 * @returns the active binding row after binding.
 */
export function bindDevice(db, unitId, userId, deviceId, revokedBy = 'owner') {
  const active = getActiveDevice(db, unitId, userId);
  if (active && active.device_id === deviceId) return active; // same-device refresh
  if (active) revokeActiveDevice(db, unitId, userId, revokedBy);
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO devices (unit_id, user_id, device_id, bound_at, last_seen_at) VALUES (?, ?, ?, ?, ?)',
  ).run(unitId, userId, deviceId, now, now);
  return getActiveDevice(db, unitId, userId);
}

/**
 * Update last_seen_at for a user's active binding on the given device, but only
 * if it has advanced by at least `throttleMs` (default 60 s) since the last
 * write, to avoid a DB write on every sync tick.
 */
export function touchDeviceLastSeen(db, unitId, userId, deviceId, throttleMs = 60_000) {
  const active = getActiveDevice(db, unitId, userId);
  if (!active || active.device_id !== deviceId) return;
  const now = Date.now();
  const last = active.last_seen_at ? Date.parse(active.last_seen_at) : 0;
  if (Number.isFinite(last) && now - last < throttleMs) return;
  db.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), active.id);
}

/**
 * All device bindings for a unit (active + recent history), newest first.
 * @returns {Array<{userId:string,deviceId:string,boundAt:string,lastSeenAt:string,revokedAt?:string,revokedBy?:string}>}
 */
export function listDevices(db, unitId, limit = 200) {
  const rows = db
    .prepare(
      'SELECT user_id, device_id, bound_at, last_seen_at, revoked_at, revoked_by ' +
        'FROM devices WHERE unit_id = ? ORDER BY id DESC LIMIT ?',
    )
    .all(unitId, limit);
  return rows.map((r) => {
    const out = {
      userId: r.user_id,
      deviceId: r.device_id,
      boundAt: r.bound_at,
      lastSeenAt: r.last_seen_at || null,
    };
    if (r.revoked_at) {
      out.revokedAt = r.revoked_at;
      out.revokedBy = r.revoked_by || undefined;
    }
    return out;
  });
}
