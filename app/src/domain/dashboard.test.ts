import { describe, it, expect } from 'vitest';
import type { Rec } from '../db/types';
import { monthOrders } from './dashboard';

const rec = (id: string, type: Rec['type'], day: string, payload: unknown): Rec => ({ id, type, unitId: 'u', payload, by: 'o', role: 'owner', device: 'd', at: `${day}T10:00:00Z`, day, sync: 'synced' });
const order = (id: string, qty: number, receivedOn: string, dueDate: string, price?: number) =>
  rec(id, 'order', receivedOn, { entityId: id, buyerId: 'b1', orderNo: id, design: 'Kashan', size: '8x10', qty, dueDate, pricePaise: price, receivedOn });
const buyer = rec('b', 'buyer', '2026-09-01', { entityId: 'b1', name: 'Sharma Exports', active: true });
const deliver = (id: string, orderId: string, day: string, qty: number) => rec(id, 'delivery', day, { orderId, qty });

describe('SPEC-M10 AC3: monthOrders inclusion rule', () => {
  const recs = [
    buyer,
    order('OPEN', 10, '2026-09-05', '2026-10-20', 50_000),     // open, partly delivered in Oct
    deliver('d1', 'OPEN', '2026-10-05', 4),
    order('DONE-OCT', 6, '2026-09-10', '2026-10-15'),           // fully delivered this month → included
    deliver('d2', 'DONE-OCT', '2026-09-28', 2), deliver('d3', 'DONE-OCT', '2026-10-12', 4),
    order('DONE-SEP', 3, '2026-09-01', '2026-09-20'),           // fully delivered last month → excluded
    deliver('d4', 'DONE-SEP', '2026-09-18', 3),
    order('NEXT', 5, '2026-11-02', '2026-11-30'),               // received after month end → excluded
    order('NEW-OCT', 2, '2026-10-25', '2026-12-01', 100_000),   // received this month, nothing delivered → included
    deliver('d5', 'NEW-OCT', '2026-11-03', 2),                  // delivered after month end → not counted for Oct
  ];

  it('keeps open + delivered-this-month orders, drops finished-before and received-after', () => {
    const rows = monthOrders(recs, '2026-10', '2026-11-05');
    expect(rows.map((r) => r.orderNo)).toEqual(['DONE-OCT', 'OPEN', 'NEW-OCT']);
  });

  it('counts delivered / pending up to the month end and flags overdue as of then', () => {
    const by = Object.fromEntries(monthOrders(recs, '2026-10', '2026-11-05').map((r) => [r.orderNo, r]));
    expect(by.OPEN).toMatchObject({ buyerName: 'Sharma Exports', qty: 10, delivered: 4, pending: 6, overdue: true, amountPendingPaise: 300_000, status: 'new' });
    expect(by['DONE-OCT']).toMatchObject({ delivered: 6, pending: 0, status: 'delivered', overdue: false });
    expect(by['NEW-OCT']).toMatchObject({ delivered: 0, pending: 2, overdue: false, amountPendingPaise: 200_000 });
  });

  it('in November, the October-finished order drops out and NEW-OCT shows delivered', () => {
    const rows = monthOrders(recs, '2026-11', '2026-11-05');
    expect(rows.map((r) => r.orderNo)).toEqual(['OPEN', 'NEXT', 'NEW-OCT']);
    expect(rows.find((r) => r.orderNo === 'NEW-OCT')).toMatchObject({ delivered: 2, pending: 0, status: 'delivered' });
  });

  it('a reversed delivery does not count', () => {
    const rows = monthOrders([...recs, rec('rv', 'reversal', '2026-10-06', { targetId: 'd1', reason: 'mistake' })], '2026-10', '2026-11-05');
    expect(rows.find((r) => r.orderNo === 'OPEN')).toMatchObject({ delivered: 0, pending: 10 });
  });
});
