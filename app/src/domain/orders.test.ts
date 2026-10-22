import { describe, it, expect } from 'vitest';
import type { Rec } from '../db/types';
import { orderViews, orderCounts } from './orders';

const rec = (id: string, type: Rec['type'], day: string, payload: unknown): Rec => ({ id, type, unitId: 'u', payload, by: 'o', role: 'owner', device: 'd', at: `${day}T10:00:00Z`, day, sync: 'synced' });
const order = (id: string, qty: number, dueDate: string, price?: number) => rec(id, 'order', '2026-10-01', { entityId: id, buyerId: 'b', orderNo: id, design: 'K', size: '8x10', qty, dueDate, pricePaise: price, receivedOn: '2026-10-01' });

describe('orders', () => {
  it('SPEC-M04 AC1: 20 pcs, deliver 12 → pending 8 and status stays; deliver 8 → delivered', () => {
    const recs = [order('o1', 20, '2026-11-01'), rec('s', 'order_status', '2026-10-02', { orderId: 'o1', status: 'in_production' }), rec('d1', 'delivery', '2026-10-10', { orderId: 'o1', qty: 12 })];
    let v = orderViews(recs, '2026-10-11')[0];
    expect([v.status, v.deliveredQty, v.pendingQty]).toEqual(['in_production', 12, 8]);
    v = orderViews([...recs, rec('d2', 'delivery', '2026-10-12', { orderId: 'o1', qty: 8 })], '2026-10-13')[0];
    expect(v.status).toBe('delivered');
  });
  it('AC2: overdue when due date passed with pending qty; due soon within 7 days; amount pending = price × pending', () => {
    const recs = [order('late', 5, '2026-10-20', 100_000), order('soon', 5, '2026-10-28'), order('ok', 5, '2026-12-01')];
    const views = orderViews(recs, '2026-10-23');
    const by = Object.fromEntries(views.map((v) => [v.order.orderNo, v]));
    expect(by.late.overdue).toBe(true); expect(by.late.amountPendingPaise).toBe(500_000);
    expect(by.soon.dueSoon).toBe(true); expect(by.ok.dueSoon).toBe(false);
    expect(views.map((v) => v.order.orderNo)).toEqual(['late', 'soon', 'ok']);
    expect(orderCounts(views)).toMatchObject({ new: 3, overdue: 1, dueSoon: 1 });
  });
});
