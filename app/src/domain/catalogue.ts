// Finished carpet catalogue (SPEC-M15, D-006, DM-004): pure projections and limits.
// Whole carpets, no thousandths. The server applies the same limits (server/catalogue.mjs).
import type { Rec, CarpetP, CarpetInP, CarpetReserveP, CarpetOutP, DeliveryP, OrderP, ReversalP, SizeUnit } from '../db/types.ts';
import { activeRecords, latestEntities } from './records.ts';

export const MAX_CARPET_PHOTOS = 4;
export const SIZE_UNITS: SizeUnit[] = ['ft', 'm', 'cm'];
export type CarpetStatus = 'in_stock' | 'reserved' | 'delivered' | 'sold' | 'written_off';
export const CARPET_STATUSES: CarpetStatus[] = ['in_stock', 'reserved', 'delivered', 'sold', 'written_off'];
/** Delivered, sold and written-off carpets are hidden unless the status filter asks for them. */
export const DEFAULT_STATUS_FILTER: CarpetStatus[] = ['in_stock', 'reserved'];

export interface CarpetCounts { added: number; reserved: number; delivered: number; sold: number; writtenOff: number; inStock: number; }
export interface CarpetReservation {
  orderId: string;
  /** Still set aside for the order: open reservations minus deliveries made from this carpet to the order. */
  reserved: number;
  delivered: number;
  /** Open reservation records (a release reverses one of them). */
  records: Rec<CarpetReserveP>[];
}
export interface CarpetView {
  carpet: CarpetP;
  counts: CarpetCounts;
  /** Piece mode: the one status of the carpet. Quantity mode: the first status with a count. */
  status: CarpetStatus;
  /** Every status with a count above zero (quantity mode can have several). */
  statuses: CarpetStatus[];
  reservations: CarpetReservation[];
}
export type CarpetError = '' | 'too_many_photos' | 'duplicate_tag' | 'tag_required' | 'invalid_size' | 'design_required' | 'invalid_price';
export type MoveError = '' | 'invalid_qty' | 'unknown_carpet' | 'unknown_order' | 'insufficient_stock' | 'exceeds_order' | 'note_required' | 'piece_added';

const normTag = (s?: string) => (s ?? '').trim().toLowerCase();
const posInt = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;

export function listCarpets(recs: Rec[], onlyActive = true): CarpetP[] {
  const all = latestEntities<CarpetP>(recs, 'carpet').sort((a, b) => a.design.localeCompare(b.design) || (a.tag ?? '').localeCompare(b.tag ?? ''));
  return onlyActive ? all.filter((c) => c.active) : all;
}

interface Tally { added: number; R: Map<string, number>; D: Map<string, number>; sold: number; writtenOff: number; reserveRecs: Map<string, Rec<CarpetReserveP>[]>; }
const emptyTally = (): Tally => ({ added: 0, R: new Map(), D: new Map(), sold: 0, writtenOff: 0, reserveRecs: new Map() });
const add = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);

/** One pass over the active records: what happened to each carpet. */
function tallies(recs: Rec[]): Map<string, Tally> {
  const out = new Map<string, Tally>();
  const of = (id: string) => { let x = out.get(id); if (!x) { x = emptyTally(); out.set(id, x); } return x; };
  for (const r of activeRecords(recs)) {
    if (r.type === 'carpet_in') { const p = r.payload as CarpetInP; of(p.carpetId).added += p.qty; }
    else if (r.type === 'carpet_reserve') {
      const p = r.payload as CarpetReserveP; const x = of(p.carpetId);
      add(x.R, p.orderId, p.qty);
      x.reserveRecs.set(p.orderId, [...(x.reserveRecs.get(p.orderId) ?? []), r as Rec<CarpetReserveP>]);
    } else if (r.type === 'delivery') { const p = r.payload as DeliveryP; if (p.carpetId) add(of(p.carpetId).D, p.orderId, p.qty); }
    else if (r.type === 'carpet_out') { const p = r.payload as CarpetOutP; const x = of(p.carpetId); if (p.kind === 'sold') x.sold += p.qty; else x.writtenOff += p.qty; }
  }
  return out;
}

function countsOf(x: Tally): { counts: CarpetCounts; reservations: CarpetReservation[] } {
  const orders = new Set([...x.R.keys(), ...x.D.keys()]);
  const reservations: CarpetReservation[] = [];
  let reserved = 0; let delivered = 0;
  for (const orderId of orders) {
    const d = x.D.get(orderId) ?? 0;
    const r = Math.max(0, (x.R.get(orderId) ?? 0) - d);
    reserved += r; delivered += d;
    reservations.push({ orderId, reserved: r, delivered: d, records: x.reserveRecs.get(orderId) ?? [] });
  }
  const inStock = x.added - reserved - delivered - x.sold - x.writtenOff;
  return { counts: { added: x.added, reserved, delivered, sold: x.sold, writtenOff: x.writtenOff, inStock }, reservations };
}

const COUNT_OF: Record<CarpetStatus, keyof CarpetCounts> = { in_stock: 'inStock', reserved: 'reserved', delivered: 'delivered', sold: 'sold', written_off: 'writtenOff' };
export const countFor = (c: CarpetCounts, s: CarpetStatus) => c[COUNT_OF[s]];

function viewOf(carpet: CarpetP, x: Tally): CarpetView {
  const { counts, reservations } = countsOf(x);
  let statuses: CarpetStatus[];
  if (carpet.mode === 'piece') {
    // A single carpet has one status, the last thing that happened to it.
    statuses = [counts.writtenOff > 0 ? 'written_off' : counts.sold > 0 ? 'sold' : counts.delivered > 0 ? 'delivered' : counts.reserved > 0 ? 'reserved' : 'in_stock'];
  } else {
    statuses = CARPET_STATUSES.filter((s) => countFor(counts, s) > 0);
    if (statuses.length === 0) statuses = ['in_stock'];
  }
  return { carpet, counts, status: statuses[0], statuses, reservations: reservations.filter((r) => r.reserved > 0 || r.delivered > 0 || r.records.length > 0) };
}

export function carpetViews(recs: Rec[], onlyActive = true): CarpetView[] {
  const t = tallies(recs);
  return listCarpets(recs, onlyActive).map((c) => viewOf(c, t.get(c.entityId) ?? emptyTally()));
}
export function carpetView(recs: Rec[], carpetId: string): CarpetView | undefined {
  const carpet = listCarpets(recs, false).find((c) => c.entityId === carpetId);
  return carpet ? viewOf(carpet, tallies(recs).get(carpetId) ?? emptyTally()) : undefined;
}

/** What one order holds in the catalogue: per carpet, reserved and delivered. */
export function orderCatalogue(recs: Rec[], orderId: string): { carpetId: string; reserved: number; delivered: number }[] {
  const out: { carpetId: string; reserved: number; delivered: number }[] = [];
  for (const [carpetId, x] of tallies(recs)) {
    const r = countsOf(x).reservations.find((v) => v.orderId === orderId);
    if (r && (r.reserved > 0 || r.delivered > 0)) out.push({ carpetId, reserved: r.reserved, delivered: r.delivered });
  }
  return out;
}

function orderOf(recs: Rec[], orderId: string): OrderP | undefined {
  return latestEntities<OrderP>(recs, 'order').find((o) => o.entityId === orderId);
}
/** Carpets delivered against the order (from the catalogue, legacy items or neither). */
function deliveredFor(recs: Rec[], orderId: string): number {
  let n = 0;
  for (const r of activeRecords(recs)) if (r.type === 'delivery' && (r.payload as DeliveryP).orderId === orderId) n += (r.payload as DeliveryP).qty;
  return n;
}
/** Still open reservations of the order across every carpet. */
function reservedFor(recs: Rec[], orderId: string): number {
  return orderCatalogue(recs, orderId).reduce((s, x) => s + x.reserved, 0);
}

export interface Limits { inStock: number; reserveMax: number; deliverMax: number; orderPending: number; orderNeed: number; reservedForOrder: number; }
/**
 * How many carpets a move may take:
 *  - reserve ≤ in stock and ≤ what the order still needs after its deliveries and other reservations;
 *  - deliver ≤ this order's reservation of the carpet + in stock, and ≤ the order's pending quantity;
 *  - sold / written off ≤ in stock (reserved carpets must be released first).
 */
export function moveLimits(recs: Rec[], carpetId: string, orderId?: string): Limits {
  const v = carpetView(recs, carpetId);
  const inStock = Math.max(0, v?.counts.inStock ?? 0);
  if (!orderId) return { inStock, reserveMax: 0, deliverMax: 0, orderPending: 0, orderNeed: 0, reservedForOrder: 0 };
  const order = orderOf(recs, orderId);
  const orderPending = Math.max(0, (order?.qty ?? 0) - deliveredFor(recs, orderId));
  const orderNeed = Math.max(0, orderPending - reservedFor(recs, orderId));
  const reservedForOrder = v?.reservations.find((r) => r.orderId === orderId)?.reserved ?? 0;
  return { inStock, reserveMax: Math.min(inStock, orderNeed), deliverMax: Math.min(reservedForOrder + inStock, orderPending), orderPending, orderNeed, reservedForOrder };
}

/** The app's check before writing a catalogue movement (same codes as the server). */
export function moveError(recs: Rec[], type: 'carpet_in' | 'carpet_reserve' | 'carpet_out' | 'delivery', p: { carpetId?: string; orderId?: string; qty: number; note?: string }): MoveError {
  if (!posInt(p.qty)) return 'invalid_qty';
  const v = p.carpetId ? carpetView(recs, p.carpetId) : undefined;
  if (!v) return 'unknown_carpet';
  if (type === 'carpet_in') {
    if (v.carpet.mode === 'piece') return v.counts.added > 0 ? 'piece_added' : p.qty === 1 ? '' : 'invalid_qty';
    return '';
  }
  if (type === 'carpet_out') {
    if (!(p.note ?? '').trim()) return 'note_required';
    return p.qty > Math.max(0, v.counts.inStock) ? 'insufficient_stock' : '';
  }
  if (!p.orderId || !orderOf(recs, p.orderId)) return 'unknown_order';
  const l = moveLimits(recs, v.carpet.entityId, p.orderId);
  if (type === 'carpet_reserve') {
    if (p.qty > l.inStock) return 'insufficient_stock';
    return p.qty > l.orderNeed ? 'exceeds_order' : '';
  }
  if (p.qty > l.orderPending) return 'exceeds_order';
  return p.qty > l.reservedForOrder + l.inStock ? 'insufficient_stock' : '';
}

/** A piece tag is unique among the unit's active carpets (case and spaces ignored). */
export function tagTaken(recs: Rec[], tag: string, exceptEntityId?: string): boolean {
  const t = normTag(tag);
  return Boolean(t) && listCarpets(recs).some((c) => c.entityId !== exceptEntityId && c.mode === 'piece' && normTag(c.tag) === t);
}

export function carpetError(recs: Rec[], c: CarpetP): CarpetError {
  if (!c.design.trim()) return 'design_required';
  if (!posInt(c.lengthMilli) || !posInt(c.widthMilli) || !SIZE_UNITS.includes(c.sizeUnit)) return 'invalid_size';
  if (c.photoIds.length > MAX_CARPET_PHOTOS) return 'too_many_photos';
  for (const k of ['costPaise', 'pricePaise'] as const) if (c[k] !== undefined && !(Number.isInteger(c[k]) && (c[k] as number) >= 0)) return 'invalid_price';
  if (c.mode === 'piece') {
    if (!normTag(c.tag)) return 'tag_required';
    if (c.active && tagTaken(recs, c.tag!, c.entityId)) return 'duplicate_tag';
  }
  return '';
}

// ---------- sizes ----------
const num = (milli: number) => String(milli / 1000);
/** "8 × 10 ft" */
export function sizeLabel(c: Pick<CarpetP, 'lengthMilli' | 'widthMilli' | 'sizeUnit'>): string { return `${num(c.lengthMilli)} × ${num(c.widthMilli)} ${c.sizeUnit}`; }
export function sizeKey(c: Pick<CarpetP, 'lengthMilli' | 'widthMilli' | 'sizeUnit'>): string { return `${c.lengthMilli}x${c.widthMilli}${c.sizeUnit}`; }

// ---------- grid search and filters ----------
export interface CarpetFilter {
  q?: string;
  design?: string;
  size?: string;                    // sizeKey
  statuses: CarpetStatus[];
  minPricePaise?: number; maxPricePaise?: number;
}
export function filterCarpets(views: CarpetView[], f: CarpetFilter): CarpetView[] {
  const q = (f.q ?? '').trim().toLowerCase();
  const design = (f.design ?? '').trim().toLowerCase();
  const priced = f.minPricePaise !== undefined || f.maxPricePaise !== undefined;
  return views.filter((v) => {
    const c = v.carpet;
    if (!v.statuses.some((s) => f.statuses.includes(s))) return false;
    if (q && ![c.design, c.tag, c.notes, c.materialNotes].some((x) => (x ?? '').toLowerCase().includes(q))) return false;
    if (design && c.design.trim().toLowerCase() !== design) return false;
    if (f.size && sizeKey(c) !== f.size) return false;
    if (priced) {
      if (c.pricePaise === undefined) return false;
      if (f.minPricePaise !== undefined && c.pricePaise < f.minPricePaise) return false;
      if (f.maxPricePaise !== undefined && c.pricePaise > f.maxPricePaise) return false;
    }
    return true;
  });
}
/** Distinct designs and sizes for the filter lists. */
export function filterOptions(views: CarpetView[]): { designs: string[]; sizes: { key: string; label: string }[] } {
  const designs = [...new Set(views.map((v) => v.carpet.design.trim()))].sort((a, b) => a.localeCompare(b));
  const sizes = new Map<string, string>();
  for (const v of views) sizes.set(sizeKey(v.carpet), sizeLabel(v.carpet));
  return { designs, sizes: [...sizes].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })) };
}

// ---------- history ----------
export type CarpetEventKind = 'in' | 'reserve' | 'deliver' | 'sold' | 'written_off';
export interface CarpetEvent { rec: Rec; kind: CarpetEventKind; qty: number; orderId?: string; note?: string; reversal?: Rec<ReversalP>; }
/** Every movement of one carpet, newest first, including reversed ones (with the reversal). Rejected records are left out. */
export function carpetHistory(recs: Rec[], carpetId: string): CarpetEvent[] {
  const reversals = new Map<string, Rec<ReversalP>>();
  for (const r of recs) if (r.type === 'reversal' && r.sync !== 'rejected') reversals.set((r.payload as ReversalP).targetId, r as Rec<ReversalP>);
  const out: CarpetEvent[] = [];
  for (const r of recs) {
    if (r.sync === 'rejected') continue;
    const p = r.payload as { carpetId?: string; qty: number; orderId?: string; note?: string; kind?: string };
    if (p?.carpetId !== carpetId) continue;
    const kind: CarpetEventKind | null = r.type === 'carpet_in' ? 'in' : r.type === 'carpet_reserve' ? 'reserve' : r.type === 'delivery' ? 'deliver'
      : r.type === 'carpet_out' ? (p.kind === 'sold' ? 'sold' : 'written_off') : null;
    if (kind) out.push({ rec: r, kind, qty: p.qty, orderId: p.orderId, note: p.note, reversal: reversals.get(r.id) });
  }
  return out.sort((a, b) => (a.rec.at < b.rec.at ? 1 : -1));
}
