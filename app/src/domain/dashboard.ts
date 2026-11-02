// Owner dashboard + monthly analysis projections (pure).
import type { Rec, SettingP, WorkerP, ItemP, AdvanceP, WagePaymentP, UsageP, DeliveryP, OrderStatusP, OrderStatus } from '../db/types.ts';
import { dayRollCall, monthAttendance } from './attendance.ts';
import { wageSheet, sheetTotals } from './wage.ts';
import { advanceBalance } from './advances.ts';
import { stockRows, stockLedger } from './stock.ts';
import { orderViews, orderCounts } from './orders.ts';
import { listUsers, listOrders, listBuyers } from './masters.ts';
import { recsOfType } from './records.ts';
import { monthDays, weekday, monthOf } from './ids.ts';

export interface Dashboard {
  roll: ReturnType<typeof dayRollCall>;
  wagesDuePaise: number; wagesPaidPaise: number; paidCount: number; workerCount: number;
  advancesOutstandingPaise: number;
  lowStock: ReturnType<typeof stockRows>;
  orders: ReturnType<typeof orderCounts>;
  entriesToday: { userId: string; name: string; count: number }[];
}
export function dashboard(recs: Rec[], today: string, workers: WorkerP[], items: ItemP[], settings: SettingP | undefined): Dashboard {
  const month = monthOf(today);
  const rows = wageSheet(recs, workers, month, settings);
  const totals = sheetTotals(rows);
  const users = new Map(listUsers(recs).map((u) => [u.entityId, u.name]));
  const counts = new Map<string, number>();
  for (const r of recs) if (r.day === today && r.type !== 'usage' && r.sync !== 'rejected') counts.set(r.by, (counts.get(r.by) ?? 0) + 1);
  return {
    roll: dayRollCall(recs, workers.map((w) => w.entityId), today),
    wagesDuePaise: totals.pending, wagesPaidPaise: totals.paid, paidCount: totals.paidCount, workerCount: totals.workers,
    advancesOutstandingPaise: workers.reduce((s, w) => s + advanceBalance(recs, w.entityId), 0),
    lowStock: stockRows(recs, items).filter((r) => r.low),
    orders: orderCounts(orderViews(recs, today)),
    entriesToday: [...counts].map(([userId, count]) => ({ userId, name: users.get(userId) ?? userId.slice(0, 6), count })).sort((a, b) => b.count - a.count),
  };
}

export interface MonthReport {
  month: string; workingDays: number;
  attendance: { worker: WorkerP; days: Record<string, 'P' | 'H' | 'A' | ''>; present: number; half: number; absent: number; otHours: number }[];
  wages: ReturnType<typeof wageSheet>; wageTotals: ReturnType<typeof sheetTotals>;
  advancesGivenPaise: number; cashOutPaise: number; upiOutPaise: number;
  stock: { item: ItemP; ledger: ReturnType<typeof stockLedger> }[];
  orders: { received: number; delivered: number; open: number; overdue: number; amountPendingPaise: number };
  /** SPEC-M10: orders that matter for this month (received by month end, not finished before it). */
  orderList: MonthOrderRow[];
  usage: { byUser: { name: string; entries: number; days: number }[]; workingDaysSoFar: number; ownerOpens: number };
}
export interface MonthOrderRow {
  orderId: string; orderNo: string; buyerName: string; design: string; size: string; qty: number;
  delivered: number; pending: number; dueDate: string; status: OrderStatus; overdue: boolean; amountPendingPaise?: number;
}
/**
 * Orders for a month's sheet: received on or before the month end, minus those fully delivered
 * before the month started. Delivered / pending are counted up to the month end, so an old month's
 * sheet shows what was pending then.
 */
export function monthOrders(recs: Rec[], month: string, today: string): MonthOrderRow[] {
  const days = monthDays(month); const first = days[0]; const last = days.at(-1)!;
  const asOf = last < today ? last : today;
  const deliveries = new Map<string, { qty: number; lastDay: string }>();
  for (const r of recsOfType<DeliveryP>(recs, 'delivery')) {
    if (r.day > last) continue;
    const d = deliveries.get(r.payload.orderId) ?? { qty: 0, lastDay: '' };
    d.qty += r.payload.qty; if (r.day > d.lastDay) d.lastDay = r.day;
    deliveries.set(r.payload.orderId, d);
  }
  const statuses = new Map<string, { status: OrderStatus; at: string }>();
  for (const r of recsOfType<OrderStatusP>(recs, 'order_status')) {
    if (r.day > last) continue;
    const p = statuses.get(r.payload.orderId); if (!p || r.at > p.at) statuses.set(r.payload.orderId, { status: r.payload.status, at: r.at });
  }
  const buyers = new Map(listBuyers(recs, false).map((b) => [b.entityId, b.name]));
  const rows: MonthOrderRow[] = [];
  for (const o of listOrders(recs)) {
    if (o.receivedOn > last) continue;
    const d = deliveries.get(o.entityId) ?? { qty: 0, lastDay: '' };
    const pending = Math.max(0, o.qty - d.qty);
    if (pending === 0 && d.lastDay !== '' && d.lastDay < first) continue; // finished before this month
    const status: OrderStatus = pending === 0 && o.qty > 0 ? 'delivered' : statuses.get(o.entityId)?.status ?? 'new';
    rows.push({
      orderId: o.entityId, orderNo: o.orderNo, buyerName: buyers.get(o.buyerId) ?? '', design: o.design, size: o.size, qty: o.qty,
      delivered: d.qty, pending, dueDate: o.dueDate, status, overdue: pending > 0 && o.dueDate < asOf,
      amountPendingPaise: o.pricePaise !== undefined ? o.pricePaise * pending : undefined,
    });
  }
  return rows.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.orderNo.localeCompare(b.orderNo)));
}
export function monthReport(recs: Rec[], month: string, today: string, workers: WorkerP[], items: ItemP[], settings: SettingP | undefined): MonthReport {
  const days = monthDays(month);
  const last = days.at(-1)!;
  const upto = last <= today ? last : today;
  const attendance = workers.map((worker) => {
    const a = monthAttendance(recs, worker.entityId, month, upto, settings);
    const d: Record<string, 'P' | 'H' | 'A' | ''> = {};
    for (const day of days) { const m = a.days[day]; d[day] = m ? (m.status === 'present' ? 'P' : m.status === 'half' ? 'H' : 'A') : ''; }
    return { worker, days: d, present: a.present, half: a.half, absent: a.absent, otHours: a.otHours };
  });
  const wages = wageSheet(recs, workers, month, settings);
  let advancesGivenPaise = 0; let cashOutPaise = 0; let upiOutPaise = 0;
  for (const r of recsOfType<AdvanceP>(recs, 'advance')) if (r.day.startsWith(month)) { advancesGivenPaise += r.payload.amountPaise; if (r.payload.mode === 'cash') cashOutPaise += r.payload.amountPaise; else upiOutPaise += r.payload.amountPaise; }
  for (const r of recsOfType<WagePaymentP>(recs, 'wage_payment')) if (r.day.startsWith(month)) { if (r.payload.mode === 'cash') cashOutPaise += r.payload.paidPaise; else upiOutPaise += r.payload.paidPaise; }
  const views = orderViews(recs, today);
  const orders = {
    received: views.filter((v) => v.order.receivedOn.startsWith(month)).length,
    delivered: recsOfType<{ orderId: string; qty: number }>(recs, 'delivery').filter((r) => r.day.startsWith(month)).reduce((s, r) => s + r.payload.qty, 0),
    open: views.filter((v) => v.status !== 'delivered').length,
    overdue: views.filter((v) => v.overdue).length,
    amountPendingPaise: views.reduce((s, v) => s + (v.amountPendingPaise ?? 0), 0),
  };
  const holidays = new Set(settings?.holidays ?? []);
  const workingDaysSoFar = days.filter((d) => d <= upto && weekday(d) !== 0 && !holidays.has(d)).length;
  const users = new Map(listUsers(recs).map((u) => [u.entityId, u]));
  const per = new Map<string, { entries: number; days: Set<string> }>();
  for (const r of recs) if (r.day.startsWith(month) && r.type !== 'usage' && r.sync !== 'rejected') { const p = per.get(r.by) ?? { entries: 0, days: new Set() }; p.entries += 1; p.days.add(r.day); per.set(r.by, p); }
  const ownerOpens = recsOfType<UsageP>(recs, 'usage').filter((r) => r.day.startsWith(month) && users.get(r.by)?.role === 'owner').length;
  return {
    month, workingDays: settings?.workingDaysPerMonth ?? 26, attendance, wages, wageTotals: sheetTotals(wages), advancesGivenPaise, cashOutPaise, upiOutPaise,
    stock: items.map((item) => ({ item, ledger: stockLedger(recs, item.entityId, month) })),
    orders,
    orderList: monthOrders(recs, month, today),
    usage: { byUser: [...per].map(([id, p]) => ({ name: users.get(id)?.name ?? id.slice(0, 6), entries: p.entries, days: p.days.size })), workingDaysSoFar, ownerOpens },
  };
}
