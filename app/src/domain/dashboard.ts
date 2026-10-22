// Owner dashboard + monthly analysis projections (pure).
import type { Rec, SettingP, WorkerP, ItemP, AdvanceP, WagePaymentP, UsageP } from '../db/types.ts';
import { dayRollCall, monthAttendance } from './attendance.ts';
import { wageSheet, sheetTotals } from './wage.ts';
import { advanceBalance } from './advances.ts';
import { stockRows, stockLedger } from './stock.ts';
import { orderViews, orderCounts } from './orders.ts';
import { listUsers } from './masters.ts';
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
  usage: { byUser: { name: string; entries: number; days: number }[]; workingDaysSoFar: number; ownerOpens: number };
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
    usage: { byUser: [...per].map(([id, p]) => ({ name: users.get(id)?.name ?? id.slice(0, 6), entries: p.entries, days: p.days.size })), workingDaysSoFar, ownerOpens },
  };
}
