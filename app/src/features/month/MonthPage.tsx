import { useMemo, useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatTile } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { listWorkers, listItems, getSettings } from '../../domain/masters';
import { monthReport } from '../../domain/dashboard';
import { formatINR } from '../../domain/money';
import { formatQty } from '../../domain/qty';
import { monthOf, todayIST, weekday } from '../../domain/ids';
import { can } from '../../domain/permissions';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { MonthPicker } from '../wages/shared';
import { exportMonthXlsx, downloadBlob } from './export';

/** Monthly analysis: attendance grid, wage sheet, stock movement, orders, cash out, usage. Excel + print. */
export default function MonthPage() {
  const { t, lang } = useT();
  const { role } = useSession();
  const toast = useToast();
  const recs = useRecords();
  const today = todayIST();
  const [month, setMonth] = useState(monthOf(today));
  const [busy, setBusy] = useState(false);
  const settings = useMemo(() => getSettings(recs), [recs]);
  const workers = useMemo(() => listWorkers(recs), [recs]);
  const items = useMemo(() => listItems(recs), [recs]);
  const r = useMemo(() => monthReport(recs, month, today, workers, items, settings), [recs, month, today, workers, items, settings]);
  const days = Object.keys(r.attendance[0]?.days ?? {});
  const canExport = role ? can(role, 'export') : false;

  const doExport = async () => {
    setBusy(true);
    try { downloadBlob(await exportMonthXlsx(r, settings?.unitName ?? 'Bunkar', lang), `Bunkar_${(settings?.unitName ?? 'unit').replace(/\s+/g, '_')}_${month}.xlsx`); toast.show(t('month.exported'), 'success'); }
    finally { setBusy(false); }
  };
  const mark = (m: string) => (m === 'P' ? 'bg-received-soft text-received' : m === 'H' ? 'bg-accent-soft text-accent-ink' : m === 'A' ? 'bg-given-soft text-given' : 'text-line');
  const wt = r.wageTotals;

  return (
    <section>
      <PageHeader title={t('month.title')} />
      <div className="no-print mb-4 flex flex-wrap items-center gap-2" data-testid="month-toolbar">
        <MonthPicker month={month} onChange={setMonth} />
        <div className="ml-auto flex gap-2">
          {canExport && <Button size="md" onClick={() => void doExport()} disabled={busy} data-testid="export-xlsx"><FileSpreadsheet aria-hidden="true" size={18} />{t('month.export')}</Button>}
          <Button size="md" variant="ghost" onClick={() => window.print()} aria-label={t('month.print')}><Printer aria-hidden="true" size={18} /></Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="month-summary">
        <StatTile label={t('wages.gross')} value={formatINR(wt.gross + wt.ot)} />
        <StatTile label={t('wages.totalPaid')} tone="received" value={formatINR(wt.paid)} />
        <StatTile label={t('wages.totalPending')} tone={wt.pending ? 'given' : 'neutral'} value={formatINR(wt.pending)} />
        <StatTile label={t('month.advancesGiven')} tone="given" value={formatINR(r.advancesGivenPaise)} />
        <StatTile label={t('month.cash')} value={<span className="text-lg">{t('month.cashOut')} {formatINR(r.cashOutPaise)} · {t('month.upiOut')} {formatINR(r.upiOutPaise)}</span>} className="col-span-2" />
        <StatTile label={t('month.orders')} value={<span className="text-lg">{t('month.received')} {r.orders.received} · {t('month.deliveredQty')} {r.orders.delivered}</span>} className="col-span-2" />
      </div>

      <Card className="mb-6 overflow-x-auto">
        <CardTitle>{t('month.attendance')}</CardTitle>
        {r.attendance.length === 0 ? <p className="text-sm text-muted">{t('common.empty')}</p> : (
          <table className="w-full border-collapse text-xs" data-testid="attendance-sheet">
            <thead><tr><th className="sticky left-0 bg-surface py-1 pr-2 text-left font-medium text-muted">{t('worker.name')}</th>{days.map((d) => <th key={d} className={`num px-0.5 py-1 font-normal ${weekday(d) === 0 ? 'text-given' : 'text-muted'}`}>{Number(d.slice(8))}</th>)}<th className="px-1 text-received">P</th><th className="px-1 text-accent-ink">H</th><th className="px-1 text-given">A</th><th className="px-1">OT</th></tr></thead>
            <tbody>{r.attendance.map((row) => (
              <tr key={row.worker.entityId} className="border-t border-line odd:bg-surface-2/50">
                <td className="sticky left-0 bg-surface py-1 pr-2 font-medium text-ink">{row.worker.name}</td>
                {days.map((d) => <td key={d} className="px-0.5 py-1 text-center"><span className={`inline-block w-4 rounded ${mark(row.days[d])}`}>{row.days[d] || '·'}</span></td>)}
                <td className="num px-1 text-center">{row.present}</td><td className="num px-1 text-center">{row.half}</td><td className="num px-1 text-center">{row.absent}</td><td className="num px-1 text-center">{row.otHours}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>

      <Card className="mb-6 overflow-x-auto">
        <CardTitle>{t('month.wages')}</CardTitle>
        <table className="w-full text-sm" data-testid="wage-sheet">
          <thead><tr className="text-left text-muted"><th className="py-1 pr-2 font-medium">{t('worker.name')}</th><th className="px-1 text-right font-medium">P/H/A</th><th className="px-1 text-right font-medium">{t('wages.gross')}</th><th className="px-1 text-right font-medium">{t('wages.advances')}</th><th className="px-1 text-right font-medium">{t('wages.net')}</th><th className="px-1 font-medium"></th></tr></thead>
          <tbody>{r.wages.map((row) => { const p = row.payment?.payload; return (
            <tr key={row.worker.entityId} className="border-t border-line odd:bg-surface-2/50">
              <td className="py-1.5 pr-2 font-medium text-ink">{row.worker.name}</td>
              <td className="num px-1 text-right text-muted">{row.inputs.present}/{row.inputs.half}/{row.inputs.absent}</td>
              <td className="num px-1 text-right">{formatINR((p?.grossPaise ?? row.settlement.grossPaise) + (p?.otPaise ?? row.settlement.otPaise))}</td>
              <td className="num px-1 text-right text-given">{formatINR(p?.advanceRecoveredPaise ?? row.settlement.advanceRecoveredPaise)}</td>
              <td className="num px-1 text-right font-bold">{formatINR(p?.paidPaise ?? row.settlement.paidPaise)}</td>
              <td className="px-1">{p ? <Badge tone="received">{t('wages.paid')}</Badge> : <Badge tone="warn">{t('wages.pending')}</Badge>}</td>
            </tr>); })}
            <tr className="border-t-2 border-line font-bold"><td className="py-1.5 pr-2">{t('common.total')}</td><td /><td className="num px-1 text-right">{formatINR(wt.gross + wt.ot)}</td><td className="num px-1 text-right text-given">{formatINR(wt.advances)}</td><td className="num px-1 text-right">{formatINR(wt.paid + wt.pending)}</td><td /></tr>
          </tbody>
        </table>
      </Card>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
        <Card className="mb-6">
          <CardTitle>{t('month.stock')}</CardTitle>
          {r.stock.length === 0 ? <p className="text-sm text-muted">{t('common.empty')}</p> : (
            <table className="w-full text-sm" data-testid="stock-sheet">
              <thead><tr className="text-left text-muted"><th className="py-1 font-medium">{t('stock.item')}</th><th className="px-1 text-right font-medium">{t('stock.opening')}</th><th className="px-1 text-right font-medium text-received">{t('stock.totalIn')}</th><th className="px-1 text-right font-medium text-given">{t('stock.totalOut')}</th><th className="px-1 text-right font-medium">{t('stock.closing')}</th></tr></thead>
              <tbody>{r.stock.map(({ item, ledger }) => (
                <tr key={item.entityId} className="border-t border-line"><td className="py-1.5 font-medium text-ink">{item.name} <span className="text-xs text-muted">{t(`stock.unit.${item.unit}`)}</span></td><td className="num px-1 text-right">{formatQty(ledger.opening, item.unit)}</td><td className="num px-1 text-right text-received">{formatQty(ledger.in, item.unit)}</td><td className="num px-1 text-right text-given">{formatQty(ledger.out, item.unit)}</td><td className="num px-1 text-right font-bold">{formatQty(ledger.closing, item.unit)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <div>
          <Card className="mb-6">
            <CardTitle>{t('month.orders')}</CardTitle>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[[t('month.received'), r.orders.received], [t('month.deliveredQty'), r.orders.delivered], [t('month.open'), r.orders.open], [t('month.overdue'), r.orders.overdue]].map(([l, v]) => <div key={String(l)} className="rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">{l}</dt><dd className="num text-xl font-bold text-ink">{v}</dd></div>)}
              <div className="col-span-2 rounded-xl bg-surface-2 p-2"><dt className="text-xs text-muted">{t('month.amountPending')}</dt><dd className="num text-xl font-bold text-ink">{formatINR(r.orders.amountPendingPaise)}</dd></div>
            </dl>
          </Card>
          <Card className="mb-6" data-testid="usage">
            <CardTitle>{t('month.usage')}</CardTitle>
            <p className="mb-2 text-sm text-muted">{t('month.workingDaysSoFar', { n: r.usage.workingDaysSoFar })} · {t('month.ownerOpens')}: <span className="num font-medium text-ink">{r.usage.ownerOpens}</span></p>
            <ul className="divide-y divide-line text-sm">{r.usage.byUser.map((u) => <li key={u.name} className="flex items-center justify-between py-1.5"><span className="text-ink">{u.name}</span><span className="num text-muted">{u.entries} · {t('month.days', { n: u.days })} · {t('month.entriesPerDay')}: {r.usage.workingDaysSoFar ? (u.entries / r.usage.workingDaysSoFar).toFixed(1) : '0'}</span></li>)}</ul>
          </Card>
        </div>
      </div>
    </section>
  );
}
