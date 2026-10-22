// Inventory projections (pure). Quantities in integer thousandths.
import type { Rec, ItemP, StockInP, StockOutP, StockAdjustP, FinishedInP, DeliveryP } from '../db/types.ts';
import { recsOfType } from './records.ts';

export type MoveKind = 'in' | 'out' | 'adjust' | 'finished' | 'delivery';
export interface Move { recId: string; day: string; at: string; kind: MoveKind; qty: number; by: string; note?: string; ref?: string; }

/** Every stock movement for an item (signed qty), oldest first. */
export function movesFor(recs: Rec[], itemId: string): Move[] {
  const out: Move[] = [];
  for (const r of recsOfType<StockInP>(recs, 'stock_in')) if (r.payload.itemId === itemId) out.push({ recId: r.id, day: r.day, at: r.at, kind: 'in', qty: r.payload.qty, by: r.by, note: r.payload.note, ref: r.payload.supplier });
  for (const r of recsOfType<StockOutP>(recs, 'stock_out')) if (r.payload.itemId === itemId) out.push({ recId: r.id, day: r.day, at: r.at, kind: 'out', qty: -r.payload.qty, by: r.by, note: r.payload.note, ref: r.payload.purpose });
  for (const r of recsOfType<StockAdjustP>(recs, 'stock_adjust')) if (r.payload.itemId === itemId) out.push({ recId: r.id, day: r.day, at: r.at, kind: 'adjust', qty: r.payload.qtyDelta, by: r.by, note: r.payload.note, ref: r.payload.reason });
  for (const r of recsOfType<FinishedInP>(recs, 'finished_in')) if (r.payload.itemId === itemId) out.push({ recId: r.id, day: r.day, at: r.at, kind: 'finished', qty: r.payload.qty, by: r.by, ref: r.payload.orderId });
  for (const r of recsOfType<DeliveryP>(recs, 'delivery')) if (r.payload.finishedItemId === itemId) out.push({ recId: r.id, day: r.day, at: r.at, kind: 'delivery', qty: -r.payload.qty * 1000, by: r.by, note: r.payload.note, ref: r.payload.orderId });
  return out.sort((a, b) => (a.day === b.day ? (a.at < b.at ? -1 : 1) : a.day < b.day ? -1 : 1));
}

export function stockBalance(recs: Rec[], itemId: string, asOfDay?: string): number {
  let bal = 0;
  for (const m of movesFor(recs, itemId)) if (!asOfDay || m.day <= asOfDay) bal += m.qty;
  return bal;
}

export interface Ledger { opening: number; in: number; out: number; adjust: number; closing: number; moves: Move[]; }
/** Month ledger: opening (before month), in/out/adjust within, closing. */
export function stockLedger(recs: Rec[], itemId: string, month: string): Ledger {
  const all = movesFor(recs, itemId);
  const l: Ledger = { opening: 0, in: 0, out: 0, adjust: 0, closing: 0, moves: [] };
  for (const m of all) {
    if (m.day < `${month}-01`) { l.opening += m.qty; continue; }
    if (!m.day.startsWith(month)) continue;
    l.moves.push(m);
    if (m.kind === 'in' || m.kind === 'finished') l.in += m.qty; else if (m.kind === 'out' || m.kind === 'delivery') l.out += -m.qty; else l.adjust += m.qty;
  }
  l.closing = l.opening + l.in - l.out + l.adjust;
  return l;
}

export interface StockRow { item: ItemP; balance: number; low: boolean; }
export function stockRows(recs: Rec[], items: ItemP[]): StockRow[] {
  return items.map((item) => { const balance = stockBalance(recs, item.entityId); return { item, balance, low: item.lowStockQty > 0 && balance <= item.lowStockQty }; });
}
export function lowStock(recs: Rec[], items: ItemP[]): StockRow[] { return stockRows(recs, items).filter((r) => r.low); }
