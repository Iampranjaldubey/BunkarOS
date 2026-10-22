import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatTile, EmptyState } from '../components/ui/Feedback';
import type { Rec } from '../db/types';
import { listUsers, listWorkers, listItems, getSettings, nameMaps } from '../domain/masters';
import { dashboard, monthReport } from '../domain/dashboard';
import { orderViews } from '../domain/orders';
import { stockRows } from '../domain/stock';
import { advanceBalance } from '../domain/advances';
import { formatINR } from '../domain/money';
import { formatQty } from '../domain/qty';
import { formatDay, formatTime, formatMonth } from '../domain/dates';
import { todayIST, monthOf } from '../domain/ids';
import { describeRecord } from '../features/log/describe';
import { MonthPicker } from '../features/wages/shared';
import { AdminShell } from './AdminShell';
import { AdminLoginPage } from './AdminLoginPage';
import { fetchUnit, getAdmin } from './api';

const PAY = { monthly: 'Monthly', daily: 'Daily', piece: 'Piece' } as const;

/** /admin/units/:unitId — everything about one unit, computed with the same projections the owner's app uses. */
export default function AdminUnitPage() {
  const { unitId = '' } = useParams();
  const [authed, setAuthed] = useState(() => Boolean(getAdmin()));
  const [data, setData] = useState<{ unit: { unitId: string; name: string; shortCode: string | null }; records: Rec[] } | null>(null);
  const [month, setMonth] = useState(monthOf(todayIST()));
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => { if (!authed) return; void fetchUnit(unitId).then((d) => { if (!d) { setAuthed(Boolean(getAdmin())); setState('error'); return; } setData(d); setState('ok'); }); }, [authed, unitId]);

  const today = todayIST();
  const recs = useMemo(() => data?.records ?? [], [data]);
  const settings = useMemo(() => getSettings(recs), [recs]);
  const users = useMemo(() => listUsers(recs), [recs]);
  const workers = useMemo(() => listWorkers(recs, false), [recs]);
  const activeWorkers = useMemo(() => workers.filter((w) => w.active), [workers]);
  const items = useMemo(() => listItems(recs), [recs]);
  const names = useMemo(() => nameMaps(recs), [recs]);
  const d = useMemo(() => dashboard(recs, today, activeWorkers, items, settings), [recs, today, activeWorkers, items, settings]);
  const r = useMemo(() => monthReport(recs, month, today, activeWorkers, items, settings), [recs, month, today, activeWorkers, items, settings]);
  const orders = useMemo(() => orderViews(recs, today), [recs, today]);
  const stock = useMemo(() => stockRows(recs, items), [recs, items]);
  const log = useMemo(() => [...recs].filter((x) => x.type !== 'usage' && x.type !== 'reversal').sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 50), [recs]);
  const t = (k: string, v?: Record<string, string | number>) => { // tiny English resolver for describeRecord labels
    const map: Record<string, string> = { 'role.owner': 'owner', 'role.staff': 'staff', 'common.inactive': 'inactive', 'settings.workingDays': 'working days', 'common.cash': 'cash', 'common.upi': 'UPI', 'order.delivered': 'delivered',
      'att.present': 'present', 'att.half': 'half day', 'att.absent': 'absent', 'stock.purpose.production': 'production', 'stock.purpose.sale': 'sale', 'stock.purpose.other': 'other',
      'stock.reason.wastage': 'wastage', 'stock.reason.count_correction': 'count correction', 'stock.reason.damage': 'damage', 'stock.reason.other': 'other',
      'order.status.new': 'new', 'order.status.in_production': 'in production', 'order.status.finished': 'finished', 'order.status.delivered': 'delivered',
      'worker.payType.monthly': 'monthly', 'worker.payType.daily': 'daily', 'worker.payType.piece': 'piece' };
    let s = map[k] ?? k; if (v) for (const [a, b] of Object.entries(v)) s = s.replace(`{${a}}`, String(b)); return s;
  };

  if (!authed) return <AdminLoginPage onDone={() => setAuthed(true)} />;
  if (!data) return <AdminShell title={unitId}><p className="text-muted">{state === 'error' ? 'Could not load this unit.' : 'Loading…'}</p></AdminShell>;

  const wt = r.wageTotals;
  return (
    <AdminShell title={data.unit.name}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl">{data.unit.name}</h1><p className="num text-sm text-muted">Shop code {data.unit.shortCode ?? '—'} · unit id {data.unit.unitId} · {recs.length} records</p></div>
        <MonthPicker month={month} onChange={setMonth} lang="en" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6" data-testid="admin-overview">
        <StatTile label="Logins" value={users.filter((u) => u.active).length} />
        <StatTile label="Workers" value={activeWorkers.length} testid="admin-workers" />
        <StatTile label="Today marked" value={`${d.roll.marked}/${d.roll.total}`} tone={d.roll.marked < d.roll.total ? 'given' : 'received'} />
        <StatTile label="Wages pending" value={formatINR(d.wagesDuePaise)} tone="given" />
        <StatTile label="Advances out" value={formatINR(d.advancesOutstandingPaise)} />
        <StatTile label="Orders overdue" value={d.orders.overdue} tone={d.orders.overdue ? 'given' : 'neutral'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Logins</CardTitle>
          <table className="admin-table w-full text-sm"><tbody>{users.map((u) => <tr key={u.entityId} className="border-t border-line"><td className="py-1.5 font-medium">{u.name}</td><td className="py-1.5"><Badge tone={u.role === 'owner' ? 'info' : 'neutral'}>{u.role}</Badge></td><td className="num py-1.5 text-muted">{u.phone}</td><td className="py-1.5 text-right">{u.active ? <Badge tone="received">active</Badge> : <Badge tone="neutral">inactive</Badge>}</td></tr>)}</tbody></table>
        </Card>
        <Card data-testid="admin-usage">
          <CardTitle>Usage · {formatMonth(month, 'en')}</CardTitle>
          <p className="mb-2 text-sm text-muted">{r.usage.workingDaysSoFar} working days so far · owner opened the app {r.usage.ownerOpens}×</p>
          <table className="admin-table w-full text-sm"><thead><tr className="text-left text-muted"><th className="py-1 font-medium">User</th><th className="py-1 text-right font-medium">Entries</th><th className="py-1 text-right font-medium">Days</th><th className="py-1 text-right font-medium">Per working day</th></tr></thead>
            <tbody>{r.usage.byUser.map((u) => <tr key={u.name} className="border-t border-line"><td className="py-1.5">{u.name}</td><td className="num py-1.5 text-right">{u.entries}</td><td className="num py-1.5 text-right">{u.days}</td><td className="num py-1.5 text-right">{r.usage.workingDaysSoFar ? (u.entries / r.usage.workingDaysSoFar).toFixed(1) : '0'}</td></tr>)}</tbody></table>
        </Card>
      </div>

      <Card className="mt-6 overflow-x-auto">
        <CardTitle>Workers</CardTitle>
        {workers.length === 0 ? <p className="text-muted">No workers.</p> : (
          <table className="admin-table w-full text-sm" data-testid="admin-workers-table">
            <thead><tr className="text-left text-muted"><th className="py-1 font-medium">Name</th><th className="py-1 font-medium">Job</th><th className="py-1 font-medium">Pay</th><th className="py-1 text-right font-medium">Rate</th><th className="py-1 text-right font-medium">OT/h</th><th className="py-1 font-medium">Joined</th><th className="py-1 font-medium">Phone</th><th className="py-1 font-medium">Worker code</th><th className="py-1 text-right font-medium">Advance due</th><th className="py-1 text-right font-medium">P/H/A ({month})</th></tr></thead>
            <tbody>{workers.map((w) => { const a = r.attendance.find((x) => x.worker.entityId === w.entityId); return (
              <tr key={w.entityId} className="border-t border-line odd:bg-surface-2/40">
                <td className="py-1.5 font-medium">{w.name}{!w.active && <Badge tone="neutral" className="ml-2">inactive</Badge>}</td><td className="py-1.5">{w.jobTitle}</td><td className="py-1.5">{PAY[w.payType]}</td>
                <td className="num py-1.5 text-right">{formatINR((w.payType === 'monthly' ? w.salaryPaise : w.payType === 'daily' ? w.dailyRatePaise : w.pieceRatePaise) ?? 0)}</td>
                <td className="num py-1.5 text-right">{formatINR(w.otRatePaise)}</td><td className="py-1.5 text-muted">{formatDay(w.joinedOn, 'en', 'short')}</td><td className="num py-1.5 text-muted">{w.phone ?? '—'}</td>
                <td className="num py-1.5">{w.accessCode ?? '—'}</td><td className="num py-1.5 text-right text-given">{formatINR(advanceBalance(recs, w.entityId))}</td>
                <td className="num py-1.5 text-right">{a ? `${a.present}/${a.half}/${a.absent}` : '—'}</td>
              </tr>); })}</tbody>
          </table>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-x-auto">
          <CardTitle>Wage sheet · {formatMonth(month, 'en')}</CardTitle>
          <table className="admin-table w-full text-sm" data-testid="admin-wages">
            <thead><tr className="text-left text-muted"><th className="py-1 font-medium">Worker</th><th className="py-1 text-right font-medium">Gross</th><th className="py-1 text-right font-medium">Advance</th><th className="py-1 text-right font-medium">Net</th><th className="py-1 font-medium"></th></tr></thead>
            <tbody>{r.wages.map((row) => { const p = row.payment?.payload; return <tr key={row.worker.entityId} className="border-t border-line"><td className="py-1.5">{row.worker.name}</td><td className="num py-1.5 text-right">{formatINR((p?.grossPaise ?? row.settlement.grossPaise) + (p?.otPaise ?? row.settlement.otPaise))}</td><td className="num py-1.5 text-right text-given">{formatINR(p?.advanceRecoveredPaise ?? row.settlement.advanceRecoveredPaise)}</td><td className="num py-1.5 text-right font-bold">{formatINR(p?.paidPaise ?? row.settlement.paidPaise)}</td><td className="py-1.5">{p ? <Badge tone="received">paid</Badge> : <Badge tone="warn">pending</Badge>}</td></tr>; })}
              <tr className="border-t-2 border-line font-bold"><td className="py-1.5">Total</td><td className="num py-1.5 text-right">{formatINR(wt.gross + wt.ot)}</td><td className="num py-1.5 text-right text-given">{formatINR(wt.advances)}</td><td className="num py-1.5 text-right">{formatINR(wt.paid + wt.pending)}</td><td /></tr>
            </tbody>
          </table>
        </Card>
        <Card className="overflow-x-auto">
          <CardTitle>Stock</CardTitle>
          {stock.length === 0 ? <p className="text-muted">No items.</p> : (
            <table className="admin-table w-full text-sm"><thead><tr className="text-left text-muted"><th className="py-1 font-medium">Item</th><th className="py-1 font-medium">Kind</th><th className="py-1 text-right font-medium">Balance</th></tr></thead>
              <tbody>{stock.map((s) => <tr key={s.item.entityId} className="border-t border-line"><td className="py-1.5">{s.item.name}</td><td className="py-1.5 text-muted">{s.item.kind}</td><td className={`num py-1.5 text-right ${s.low ? 'font-bold text-given' : ''}`}>{formatQty(s.balance, s.item.unit)} {s.item.unit}{s.low && <Badge tone="danger" className="ml-2">low</Badge>}</td></tr>)}</tbody></table>
          )}
        </Card>
      </div>

      <Card className="mt-6 overflow-x-auto">
        <CardTitle>Orders</CardTitle>
        {orders.length === 0 ? <p className="text-muted">No orders.</p> : (
          <table className="admin-table w-full text-sm"><thead><tr className="text-left text-muted"><th className="py-1 font-medium">No.</th><th className="py-1 font-medium">Buyer</th><th className="py-1 font-medium">Design</th><th className="py-1 text-right font-medium">Qty</th><th className="py-1 text-right font-medium">Delivered</th><th className="py-1 font-medium">Due</th><th className="py-1 font-medium">Status</th></tr></thead>
            <tbody>{orders.map((v) => <tr key={v.order.entityId} className="border-t border-line"><td className="num py-1.5">{v.order.orderNo}</td><td className="py-1.5">{v.buyer?.name ?? ''}</td><td className="py-1.5">{v.order.design} {v.order.size}</td><td className="num py-1.5 text-right">{v.order.qty}</td><td className="num py-1.5 text-right">{v.deliveredQty}</td><td className={`py-1.5 ${v.overdue ? 'font-medium text-given' : 'text-muted'}`}>{formatDay(v.order.dueDate, 'en', 'short')}{v.overdue ? ' · overdue' : ''}</td><td className="py-1.5"><Badge tone={v.status === 'delivered' ? 'received' : v.status === 'new' ? 'neutral' : 'info'}>{v.status.replace('_', ' ')}</Badge></td></tr>)}</tbody></table>
        )}
      </Card>

      <Card className="mt-6">
        <CardTitle>Last 50 entries</CardTitle>
        {log.length === 0 ? <EmptyState title="No entries yet" /> : (
          <ol className="divide-y divide-line text-sm" data-testid="admin-log">
            {log.map((x) => { const dsc = describeRecord(x, names, t, 'en'); return <li key={x.id} className="flex items-start gap-3 py-2"><Badge tone={dsc.tone}>{x.type}</Badge><span className="flex-1 text-ink">{dsc.text}</span><span className="num shrink-0 text-xs text-muted">{names.users.get(x.by) ?? x.by.slice(0, 6)} · {formatDay(x.day, 'en', 'short')} {formatTime(x.at, 'en')}</span></li>; })}
          </ol>
        )}
      </Card>
    </AdminShell>
  );
}
