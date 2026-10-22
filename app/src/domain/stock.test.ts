import { describe, it, expect } from 'vitest';
import type { Rec } from '../db/types';
import { stockBalance, stockLedger, lowStock } from './stock';

const rec = (id: string, type: Rec['type'], day: string, payload: unknown): Rec => ({ id, type, unitId: 'u', payload, by: 'o', role: 'owner', device: 'd', at: `${day}T10:00:00Z`, day, sync: 'synced' });
const wool = { entityId: 'i1', name: 'Wool', kind: 'raw' as const, unit: 'kg' as const, lowStockQty: 5_000, active: true };

describe('stock', () => {
  const recs: Rec[] = [
    rec('a', 'stock_in', '2026-09-20', { itemId: 'i1', qty: 10_000 }),
    rec('b', 'stock_in', '2026-10-01', { itemId: 'i1', qty: 25_000 }),
    rec('c', 'stock_out', '2026-10-02', { itemId: 'i1', qty: 12_500, purpose: 'production' }),
    rec('d', 'stock_adjust', '2026-10-03', { itemId: 'i1', qtyDelta: -250, reason: 'wastage', note: 'x' }),
  ];
  it('SPEC-M03 AC1: in 25.000, out 12.500, adjust −0.250 → balance 12.250 (+10 opening)', () => {
    expect(stockBalance(recs, 'i1')).toBe(22_250);
    const l = stockLedger(recs, 'i1', '2026-10');
    expect([l.opening, l.in, l.out, l.adjust, l.closing]).toEqual([10_000, 25_000, 12_500, -250, 22_250]);
  });
  it('reversed moves are ignored; balance as of a day', () => {
    const withRev = [...recs, rec('r', 'reversal', '2026-10-03', { targetId: 'b', reason: 'x' })];
    expect(stockBalance(withRev, 'i1')).toBe(-2_750);
    expect(stockBalance(recs, 'i1', '2026-10-01')).toBe(35_000);
  });
  it('low stock flag at or below threshold', () => {
    expect(lowStock(recs, [wool])).toHaveLength(0);
    expect(lowStock([...recs, rec('e', 'stock_out', '2026-10-04', { itemId: 'i1', qty: 17_250, purpose: 'production' })], [wool])).toHaveLength(1);
  });
});
