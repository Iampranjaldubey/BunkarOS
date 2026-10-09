// Bunkar OS server — record validation rules (per architecture 'Server API').
// Pure functions that decide whether an incoming Rec is accepted or rejected.
// Reject reasons (binding): 'duplicate_bazaar', 'forbidden_role',
// 'author_mismatch', 'invalid_amounts', 'invalid'.
//
// AUTHORIZATION MODEL (C1/H1): the server NEVER trusts client-supplied
// rec.role for authorization. The caller passes an `auth` context derived from
// a verified Bearer token: { userId, role } where role is resolved from the
// unit's stored latest `user` record. Owner-only types require that server
// role to be 'owner'. Records whose rec.by != token.userId are 'author_mismatch'.
// Bootstrap: a unit with zero user records may push its first owner `user` +
// `setting` with unit key only (auth may be null) to seed itself.
import { recordsOfType, userRole, userRecordCount } from './db.mjs';
import { validateBazaarAmounts, validateJobAmounts, validateNonNegative } from './amounts.mjs';

const VALID_TYPES = new Set([
  'user', 'loom', 'thekedar', 'weaver', 'order',
  'piece_assign', 'piece_status',
  'rate', 'norm', 'setting',
  'yarn_issue', 'yarn_return',
  'bazaar', 'peshgi', 'checkin', 'roker',
  'slip', 'slip_response',
  'job',
  'reversal',
]);

// OWNER-only record types (server-derived role must be 'owner').
const OWNER_GUARDED = new Set(['rate', 'norm', 'setting', 'user']);

/** Basic structural validation of an incoming record. */
export function isWellFormed(rec) {
  if (!rec || typeof rec !== 'object') return false;
  if (typeof rec.id !== 'string' || rec.id.length < 1) return false;
  if (typeof rec.type !== 'string' || !VALID_TYPES.has(rec.type)) return false;
  if (typeof rec.unitId !== 'string' || rec.unitId.length < 1) return false;
  if (typeof rec.at !== 'string' || rec.at.length < 1) return false;
  if (typeof rec.day !== 'string' || rec.day.length < 1) return false;
  if (rec.payload === undefined || rec.payload === null) return false;
  if (typeof rec.by !== 'string') return false;
  if (typeof rec.role !== 'string') return false;
  return true;
}

/** Parse the set of reversed target ids (records that have been reversed) for a unit. */
function reversedTargetIds(db, unitId) {
  const reversals = recordsOfType(db, unitId, 'reversal');
  const set = new Set();
  for (const row of reversals) {
    const rec = JSON.parse(row.json);
    if (rec.payload && typeof rec.payload.targetId === 'string') set.add(rec.payload.targetId);
  }
  return set;
}

/**
 * Decide the disposition of an incoming record against current server state.
 * @param db
 * @param headerUnitId authenticated unit id (x-unit-id)
 * @param rec incoming record
 * @param batchState {{ids:Set<string>, bazaarPieces:Set<string>}} accepted earlier in this batch
 * @param auth {{userId:string, role:string}|null} identity from a verified token (null if none)
 * @returns {{ok:true} | {ok:false, reason:string}}
 */
export function evaluate(db, headerUnitId, rec, batchState, auth = null) {
  if (!isWellFormed(rec)) return { ok: false, reason: 'invalid' };
  if (rec.unitId !== headerUnitId) return { ok: false, reason: 'invalid' };

  // Bootstrap is a BATCH-level property: a unit that had zero users when the
  // batch began may seed its first owner user + setting with unit key only.
  // Snapshot it in batchState so inserting the first user mid-batch does not
  // retroactively lock out the setting pushed alongside it.
  if (batchState.bootstrap === undefined) {
    batchState.bootstrap = userRecordCount(db, headerUnitId) === 0;
  }
  const bootstrap = batchState.bootstrap && !auth;

  // Author binding (C1): once a unit has users, every record must be authored
  // by the authenticated token user. No exceptions — the demo seed authors as
  // the logged-in owner. slip_response is only written server-side (never via
  // this client-sync path), so it is not special-cased here.
  if (!bootstrap) {
    if (!auth) return { ok: false, reason: 'author_mismatch' };
    if (rec.by !== auth.userId) return { ok: false, reason: 'author_mismatch' };
  }

  // Reversal: target must exist in the unit (persisted or accepted earlier in this batch).
  if (rec.type === 'reversal') {
    const targetId = rec.payload.targetId;
    if (typeof targetId !== 'string' || targetId.length < 1) return { ok: false, reason: 'invalid' };
    const existsPersisted = db
      .prepare('SELECT 1 FROM records WHERE id = ? AND unit_id = ?')
      .get(targetId, headerUnitId);
    const existsBatch = batchState.ids.has(targetId);
    if (!existsPersisted && !existsBatch) return { ok: false, reason: 'invalid' };
    return { ok: true };
  }

  // Owner-guarded masters (rate / norm / setting / user): the SERVER-DERIVED
  // role of the author must be owner. Bootstrap exception: a unit with zero
  // users may push its first owner `user` + `setting` with unit key only.
  if (OWNER_GUARDED.has(rec.type)) {
    if (bootstrap) {
      // Only user/setting allowed to bootstrap, and the first user must be owner.
      if (rec.type === 'user') {
        if (!rec.payload || rec.payload.role !== 'owner') {
          return { ok: false, reason: 'forbidden_role' };
        }
      } else if (rec.type !== 'setting') {
        return { ok: false, reason: 'forbidden_role' };
      }
      return { ok: true };
    }
    // Non-bootstrap: server-resolved role of the token user must be owner.
    const role = auth ? userRole(db, headerUnitId, auth.userId) : undefined;
    if (role !== 'owner') return { ok: false, reason: 'forbidden_role' };
    return { ok: true };
  }

  // Bazaar: at most one non-reversed bazaar per piece (persisted + this batch),
  // and server recomputes the money (M5).
  if (rec.type === 'bazaar') {
    const pieceId = rec.payload && rec.payload.pieceId;
    if (typeof pieceId !== 'string' || pieceId.length < 1) return { ok: false, reason: 'invalid' };
    const amt = validateBazaarAmounts(rec.payload);
    if (!amt.ok) return amt;
    if (batchState.bazaarPieces.has(pieceId)) return { ok: false, reason: 'duplicate_bazaar' };
    const reversed = reversedTargetIds(db, headerUnitId);
    const existing = recordsOfType(db, headerUnitId, 'bazaar');
    for (const row of existing) {
      const other = JSON.parse(row.json);
      if (other.id === rec.id) continue; // idempotent resend handled before evaluate
      if (other.payload && other.payload.pieceId === pieceId && !reversed.has(other.id)) {
        return { ok: false, reason: 'duplicate_bazaar' };
      }
    }
    return { ok: true };
  }

  // Job (ancillary work): author's server-derived role must be owner or munshi
  // (thekedar cannot author jobs); 'other' workers require a name; recompute money.
  if (rec.type === 'job') {
    const role = auth ? userRole(db, headerUnitId, auth.userId) : undefined;
    if (role !== 'owner' && role !== 'munshi') return { ok: false, reason: 'forbidden_role' };
    const p = rec.payload;
    if (!p || typeof p !== 'object') return { ok: false, reason: 'invalid' };
    if (p.workerKind === 'other' && (typeof p.workerName !== 'string' || p.workerName.trim().length < 1)) {
      return { ok: false, reason: 'invalid' };
    }
    const amt = validateJobAmounts(p);
    if (!amt.ok) return amt;
    return { ok: true };
  }

  // Non-negative money/grams for value-bearing transactions (M5).
  if (rec.type === 'peshgi' || rec.type === 'roker' || rec.type === 'yarn_issue' || rec.type === 'yarn_return') {
    const nn = validateNonNegative(rec.type, rec.payload);
    if (!nn.ok) return nn;
    return { ok: true };
  }

  return { ok: true };
}
