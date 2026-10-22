import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Unlock, Wallet } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatTile, EmptyState } from '../../components/ui/Feedback';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { ConfirmSheet } from '../../components/ui/Sheet';
import { useRecords } from '../../db/hooks';
import { addRecord, reverse } from '../../db/repo';
import type { PeriodLockP } from '../../db/types';
import { listWorkers, getSettings } from '../../domain/masters';
import { wageSheet, sheetTotals, type WageRow } from '../../domain/wage';
import { recsOfType } from '../../domain/records';
import { formatINR } from '../../domain/money';
import { formatDay } from '../../domain/dates';
import { monthOf, todayIST } from '../../domain/ids';
import { can } from '../../domain/permissions';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { Avatar } from '../workers/shared';
import { MonthPicker } from './shared';

export default function WagesPage() {
  const { t, lang } = useT();
  const { role } = useSession();
  const navigate = useNavigate();
  const recs = useRecords();
  const [month, setMonth] = useState(monthOf(todayIST()));
  const [confirmLock, setConfirmLock] = useState(false);
  const settings = useMemo(() => getSettings(recs), [recs]);
  const workers = useMemo(() => listWorkers(recs, false).filter((w) => w.active || recs.some((r) => r.type === 'wage_payment' && (r.payload as { workerId: string; month: string }).workerId === w.entityId && (r.payload as { month: string }).month === month)), [recs, month]);
  const rows = useMemo(() => wageSheet(recs, workers, month, settings), [recs, workers, month, settings]);
  const totals = useMemo(() => sheetTotals(rows), [rows]);
  const lockRec = useMemo(() => recsOfType<PeriodLockP>(recs, 'period_lock').find((r) => r.payload.month === month), [recs, month]);
  const canLock = role ? can(role, 'month.lock') : false;

  const toggleLock = async () => {
    if (lockRec) await reverse(lockRec.id, 'unlock'); else await addRecord<PeriodLockP>('period_lock', { month });
    setConfirmLock(false);
  };

  const card = (r: WageRow) => (
    <button type="button" onClick={() => navigate(`/wages/${month}/${r.worker.entityId}`)} className="card-hover flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-card">
      <Avatar name={r.worker.name} size={44} photoId={r.worker.photoId} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{r.worker.name}</p>
        <p className="num text-xs text-muted">P {r.inputs.present} · H {r.inputs.half} · A {r.inputs.absent}{r.inputs.otHours ? ` · OT ${r.inputs.otHours}h` : ''}{r.inputs.payType === 'piece' ? ` · ${r.inputs.pieces} ${t('wages.pieces')}` : ''}</p>
      </div>
      <div className="text-right">
        <p className="num text-lg font-bold text-ink">{formatINR(r.payment ? r.payment.payload.paidPaise : r.settlement.paidPaise)}</p>
        {r.payment ? <Badge tone="received">{t('wages.paid')}</Badge> : <Badge tone="warn">{t('wages.pending')}</Badge>}
      </div>
    </button>
  );

  return (
    <section>
      <PageHeader title={t('wages.sheet')} right={<MonthPicker month={month} onChange={setMonth} />} />
      {lockRec && <p role="status" className="mb-3 flex items-center gap-2 rounded-xl bg-warn-soft px-4 py-2 text-sm font-medium text-warn"><Lock aria-hidden="true" size={16} />{t('wages.locked')} · {formatDay(lockRec.day, lang, 'short')}</p>}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t('wages.gross')} value={formatINR(totals.gross + totals.ot)} />
        <StatTile label={t('wages.advances')} tone="given" value={formatINR(totals.advances)} />
        <StatTile label={t('wages.totalPaid')} tone="received" value={formatINR(totals.paid)} testid="wages-paid" />
        <StatTile label={t('wages.totalPending')} tone={totals.pending > 0 ? 'given' : 'neutral'} value={formatINR(totals.pending)} testid="wages-pending" />
      </div>
      <p className="mb-3 text-sm text-muted">{t('wages.summary', { paid: totals.paidCount, total: totals.workers })}</p>
      <ResponsiveTable<WageRow>
        rows={rows} rowKey={(r) => r.worker.entityId} renderCard={card} onRowClick={(r) => navigate(`/wages/${month}/${r.worker.entityId}`)}
        empty={<EmptyState icon={<Wallet size={40} />} title={t('wages.noWorkers')} />}
        columns={[
          { key: 'name', header: t('worker.name'), cell: (r) => <span className="flex items-center gap-2"><Avatar name={r.worker.name} size={32} photoId={r.worker.photoId} /><span className="font-medium">{r.worker.name}</span></span> },
          { key: 'att', header: t('att.title'), cell: (r) => <span className="num">P {r.inputs.present} · H {r.inputs.half} · A {r.inputs.absent}</span> },
          { key: 'ot', header: t('wages.ot'), align: 'right', cell: (r) => <span className="num">{r.inputs.otHours}h</span> },
          { key: 'gross', header: t('wages.gross'), align: 'right', cell: (r) => <span className="num">{formatINR((r.payment?.payload.grossPaise ?? r.settlement.grossPaise) + (r.payment?.payload.otPaise ?? r.settlement.otPaise))}</span> },
          { key: 'adv', header: t('wages.advances'), align: 'right', cell: (r) => <span className="num text-given">{formatINR(r.payment?.payload.advanceRecoveredPaise ?? r.settlement.advanceRecoveredPaise)}</span> },
          { key: 'net', header: t('wages.net'), align: 'right', cell: (r) => <span className="num font-bold">{formatINR(r.payment?.payload.paidPaise ?? r.settlement.paidPaise)}</span> },
          { key: 'st', header: '', cell: (r) => r.payment ? <Badge tone="received">{t('wages.paid')}</Badge> : <Badge tone="warn">{t('wages.pending')}</Badge> },
        ]}
      />
      {canLock && rows.length > 0 && (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <p className="mb-2 text-sm text-muted">{t('wages.lockHint')}</p>
          <Button variant={lockRec ? 'secondary' : 'primary'} onClick={() => setConfirmLock(true)}>{lockRec ? <><Unlock aria-hidden="true" size={18} />{t('wages.unlock')}</> : <><Lock aria-hidden="true" size={18} />{t('wages.lock')}</>}</Button>
        </div>
      )}
      <ConfirmSheet open={confirmLock} onClose={() => setConfirmLock(false)} onConfirm={() => void toggleLock()} title={lockRec ? t('wages.unlock') : t('wages.lock')} message={t('wages.lockHint')} />
    </section>
  );
}
