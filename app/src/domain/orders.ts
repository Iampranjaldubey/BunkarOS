// Order projections (pure).
import type { Rec, OrderP, OrderStatus, OrderStatusP, DeliveryP, OrderNoteP, BuyerP } from '../db/types.ts';
import { recsOfType } from './records.ts';
import { listOrders, listBuyers } from './masters.ts';
import { daysBetween } from './ids.ts';

export const DUE_SOON_DAYS = 7;
export interface OrderView {
  order: OrderP; buyer?: BuyerP; status: OrderStatus; deliveredQty: number; pendingQty: number;
  overdue: boolean; dueSoon: boolean; daysToDue: number; amountPendingPaise?: number; lastStatusAt?: string;
}
export interface TimelineItem { recId: string; day: string; at: string; by: string; kind: 'status' | 'delivery' | 'note'; status?: OrderStatus; qty?: number; text?: string; }

export function orderViews(recs: Rec[], today: string): OrderView[] {
  const buyers = new Map(listBuyers(recs, false).map((b) => [b.entityId, b]));
  const statuses = new Map<string, { status: OrderStatus; at: string }>();
  for (const r of recsOfType<OrderStatusP>(recs, 'order_status')) { const p = statuses.get(r.payload.orderId); if (!p || r.at > p.at) statuses.set(r.payload.orderId, { status: r.payload.status, at: r.at }); }
  const delivered = new Map<string, number>();
  for (const r of recsOfType<DeliveryP>(recs, 'delivery')) delivered.set(r.payload.orderId, (delivered.get(r.payload.orderId) ?? 0) + r.payload.qty);
  return listOrders(recs).map((order) => {
    const deliveredQty = delivered.get(order.entityId) ?? 0;
    const pendingQty = Math.max(0, order.qty - deliveredQty);
    let status = statuses.get(order.entityId)?.status ?? 'new';
    if (pendingQty === 0 && order.qty > 0) status = 'delivered';
    const daysToDue = daysBetween(today, order.dueDate);
    const open = status !== 'delivered';
    return {
      order, buyer: buyers.get(order.buyerId), status, deliveredQty, pendingQty,
      overdue: open && daysToDue < 0, dueSoon: open && daysToDue >= 0 && daysToDue <= DUE_SOON_DAYS, daysToDue,
      amountPendingPaise: order.pricePaise !== undefined ? order.pricePaise * pendingQty : undefined,
      lastStatusAt: statuses.get(order.entityId)?.at,
    };
  }).sort((a, b) => {
    const rank = (v: OrderView) => (v.status === 'delivered' ? 3 : v.overdue ? 0 : v.dueSoon ? 1 : 2);
    return rank(a) - rank(b) || (a.order.dueDate < b.order.dueDate ? -1 : 1);
  });
}
export function orderView(recs: Rec[], orderId: string, today: string): OrderView | undefined {
  return orderViews(recs, today).find((v) => v.order.entityId === orderId);
}
export function orderTimeline(recs: Rec[], orderId: string): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const r of recsOfType<OrderStatusP>(recs, 'order_status')) if (r.payload.orderId === orderId) out.push({ recId: r.id, day: r.day, at: r.at, by: r.by, kind: 'status', status: r.payload.status, text: r.payload.note });
  for (const r of recsOfType<DeliveryP>(recs, 'delivery')) if (r.payload.orderId === orderId) out.push({ recId: r.id, day: r.day, at: r.at, by: r.by, kind: 'delivery', qty: r.payload.qty, text: r.payload.note });
  for (const r of recsOfType<OrderNoteP>(recs, 'order_note')) if (r.payload.orderId === orderId) out.push({ recId: r.id, day: r.day, at: r.at, by: r.by, kind: 'note', text: r.payload.text });
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}
export function orderCounts(views: OrderView[]) {
  const c = { new: 0, in_production: 0, finished: 0, delivered: 0, overdue: 0, dueSoon: 0, pendingDeliveries: 0 };
  for (const v of views) { c[v.status] += 1; if (v.overdue) c.overdue += 1; if (v.dueSoon) c.dueSoon += 1; if (v.status === 'finished' && v.pendingQty > 0) c.pendingDeliveries += 1; }
  return c;
}
