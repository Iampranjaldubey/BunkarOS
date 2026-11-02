// SPEC-M15 finished carpet catalogue on the server: the same limits as app/src/domain/catalogue.ts.
// The state is built from the unit's stored records (reversed ones excluded) and updated in order
// while a push is applied, so later records in the same push see earlier ones.
import { recordsOfType, reversedTargetIds } from './db.mjs';

export const CATALOGUE_TYPES = new Set(['carpet', 'carpet_in', 'carpet_reserve', 'carpet_out']);
const TOUCHES = new Set([...CATALOGUE_TYPES, 'delivery', 'order', 'reversal']);
const SIZE_UNITS = new Set(['ft', 'm', 'cm']);
const MODES = new Set(['piece', 'quantity']);
const OUT_KINDS = new Set(['sold', 'written_off']);
export const MAX_CARPET_PHOTOS = 4;
const isInt = (n) => Number.isInteger(n);
const pos = (n) => isInt(n) && n > 0;
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const normTag = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
const optStr = (v) => v === undefined || typeof v === 'string';

/** Does this push need the catalogue state? */
export const needsCatalogue = (incoming) => incoming.some((r) => TOUCHES.has(r?.type));

function emptyTally() { return { added: 0, R: new Map(), D: new Map(), sold: 0, writtenOff: 0 }; }
const bump = (m, k, n) => m.set(k, (m.get(k) ?? 0) + n);

export async function loadCatalogue(db, unitId) {
  const reversed = await reversedTargetIds(db, unitId);
  const state = { carpets: new Map(), tallies: new Map(), orders: new Map(), delivered: new Map() };
  const rows = [];
  for (const t of ['carpet', 'order', 'carpet_in', 'carpet_reserve', 'carpet_out', 'delivery']) for (const row of await recordsOfType(db, unitId, t)) if (!reversed.has(row.id)) rows.push(row);
  rows.sort((a, b) => a.seq - b.seq);
  for (const row of rows) apply(state, row.rec, 1);
  return state;
}

function tally(state, carpetId) {
  let x = state.tallies.get(carpetId);
  if (!x) { x = emptyTally(); state.tallies.set(carpetId, x); }
  return x;
}
/** Add (sign 1) or take back (sign −1, a reversal) one record's effect. */
export function apply(state, rec, sign = 1) {
  const p = rec?.payload; if (!p) return;
  switch (rec.type) {
    case 'carpet': if (sign > 0) { const prev = state.carpets.get(p.entityId); if (!prev || (rec.at || '') >= prev.at) state.carpets.set(p.entityId, { at: rec.at || '', p }); } break;
    case 'order': if (sign > 0) { const prev = state.orders.get(p.entityId); if (!prev || (rec.at || '') >= prev.at) state.orders.set(p.entityId, { at: rec.at || '', p }); } break;
    case 'carpet_in': if (isInt(p.qty)) tally(state, p.carpetId).added += sign * p.qty; break;
    case 'carpet_reserve': if (isInt(p.qty)) bump(tally(state, p.carpetId).R, p.orderId, sign * p.qty); break;
    case 'carpet_out': if (isInt(p.qty)) { const x = tally(state, p.carpetId); if (p.kind === 'sold') x.sold += sign * p.qty; else x.writtenOff += sign * p.qty; } break;
    case 'delivery':
      if (isInt(p.qty)) {
        bump(state.delivered, p.orderId, sign * p.qty);
        if (typeof p.carpetId === 'string' && p.carpetId) bump(tally(state, p.carpetId).D, p.orderId, sign * p.qty);
      }
      break;
    default: break;
  }
}

function counts(state, carpetId) {
  const x = state.tallies.get(carpetId) ?? emptyTally();
  let reserved = 0; let delivered = 0;
  for (const orderId of new Set([...x.R.keys(), ...x.D.keys()])) {
    const d = x.D.get(orderId) ?? 0;
    reserved += Math.max(0, (x.R.get(orderId) ?? 0) - d); delivered += d;
  }
  return { added: x.added, reserved, delivered, inStock: x.added - reserved - delivered - x.sold - x.writtenOff };
}
const reservedFor = (state, carpetId, orderId) => {
  const x = state.tallies.get(carpetId); if (!x) return 0;
  return Math.max(0, (x.R.get(orderId) ?? 0) - (x.D.get(orderId) ?? 0));
};
function orderPending(state, orderId) {
  const o = state.orders.get(orderId)?.p; if (!o) return null;
  return Math.max(0, (o.qty ?? 0) - (state.delivered.get(orderId) ?? 0));
}
function orderReserved(state, orderId) {
  let n = 0; for (const carpetId of state.tallies.keys()) n += reservedFor(state, carpetId, orderId); return n;
}

function carpetProblem(state, p) {
  if (typeof p.entityId !== 'string' || !p.entityId) return 'invalid_carpet';
  if (!nonEmpty(p.design)) return 'invalid_carpet';
  if (!pos(p.lengthMilli) || !pos(p.widthMilli) || !SIZE_UNITS.has(p.sizeUnit)) return 'invalid_size';
  if (!MODES.has(p.mode) || typeof p.active !== 'boolean') return 'invalid_carpet';
  if (!Array.isArray(p.photoIds) || !p.photoIds.every((x) => typeof x === 'string' && x)) return 'invalid_carpet';
  if (p.photoIds.length > MAX_CARPET_PHOTOS) return 'too_many_photos';
  for (const k of ['costPaise', 'pricePaise']) if (p[k] !== undefined && !(isInt(p[k]) && p[k] >= 0)) return 'invalid_price';
  if (!optStr(p.materialNotes) || !optStr(p.notes) || !optStr(p.tag)) return 'invalid_carpet';
  const prev = state.carpets.get(p.entityId)?.p;
  if (prev && prev.mode !== p.mode && counts(state, p.entityId).added > 0) return 'invalid_carpet'; // mode is fixed once carpets are added
  if (p.mode === 'piece') {
    const tag = normTag(p.tag);
    if (!tag) return 'tag_required';
    if (p.active) for (const [id, c] of state.carpets) if (id !== p.entityId && c.p.active && c.p.mode === 'piece' && normTag(c.p.tag) === tag) return 'duplicate_tag';
  }
  return '';
}

/**
 * The catalogue reason a record is refused, or '' when it is fine.
 * `target` is the record a reversal points at (when the push has one).
 */
export function catalogueCheck(state, rec, target) {
  const p = rec.payload;
  switch (rec.type) {
    case 'carpet': return carpetProblem(state, p);
    case 'carpet_in': {
      const c = state.carpets.get(p.carpetId)?.p;
      if (!pos(p.qty)) return 'invalid_qty';
      if (!c) return 'unknown_carpet';
      if (c.mode === 'piece' && (p.qty !== 1 || counts(state, p.carpetId).added > 0)) return 'piece_added';
      return '';
    }
    case 'carpet_reserve': {
      if (!pos(p.qty)) return 'invalid_qty';
      if (!state.carpets.get(p.carpetId)) return 'unknown_carpet';
      const pending = orderPending(state, p.orderId);
      if (pending === null) return 'unknown_order';
      if (p.qty > counts(state, p.carpetId).inStock) return 'insufficient_stock';
      if (p.qty > pending - orderReserved(state, p.orderId)) return 'exceeds_order';
      return '';
    }
    case 'carpet_out': {
      if (!pos(p.qty)) return 'invalid_qty';
      if (!OUT_KINDS.has(p.kind)) return 'invalid_kind';
      if (!nonEmpty(p.note)) return 'note_required';
      if (!state.carpets.get(p.carpetId)) return 'unknown_carpet';
      if (p.qty > counts(state, p.carpetId).inStock) return 'insufficient_stock';
      return '';
    }
    case 'delivery': {
      if (p.carpetId === undefined) return '';
      if (typeof p.carpetId !== 'string' || !p.carpetId || p.finishedItemId) return 'invalid_delivery';
      if (!state.carpets.get(p.carpetId)) return 'unknown_carpet';
      const pending = orderPending(state, p.orderId);
      if (pending === null) return 'unknown_order';
      if (p.qty > pending) return 'exceeds_order';
      if (p.qty > reservedFor(state, p.carpetId, p.orderId) + counts(state, p.carpetId).inStock) return 'insufficient_stock';
      return '';
    }
    case 'reversal': {
      // Taking back carpets that were added must not leave the catalogue below zero (sell or deliver them first).
      if (target?.type === 'carpet_in' && isInt(target.payload?.qty) && counts(state, target.payload.carpetId).inStock - target.payload.qty < 0) return 'insufficient_stock';
      return '';
    }
    default: return '';
  }
}
