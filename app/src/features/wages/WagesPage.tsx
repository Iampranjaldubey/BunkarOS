import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Unlock, Wallet } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatTile, StatRow, EmptyState } from '../../components/ui/Feedback';
import { WovenProgress } from '../../components/ui/Motion';
import { cn } from '../../lib/utils';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { ConfirmSheet, Sheet } from '../../components/ui/Sheet';
import { Field } from '../../components/ui/Field';
import { Textarea } from '../../components/ui/Input';
import { useRecords } from '../../db/hooks';
import { addRecord, reverse } from '../../db/repo';
import type { PeriodLockP } from '../../db/types';
import { listWorkers, getSettings } from '../../domain/masters';
import { wageSheet, sheetTotals, type WageRow } from '../../domain/wage';
import { recsOfType } from '../../domain/records';
import { formatINR } from '../../domain/money';
import { formatDay } from '../../domain/dates';
import { monthOf, todayIST } from '../../domain/ids';
import { useT } from '../../i18n';
import { Avatar } from '../workers/shared';
import { MonthPicker } from './shared';
import { useCan, useUnitRules } from '../../app/useCan';

export default function WagesPage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const recs = useRecords();
  const [month, setMonth] = useState(monthOf(todayIST()));
  const [confirmLock, setConfirmLock] = useState(false);
  const settings = useMemo(() => getSettings(recs), [recs]);
  const workers = useMemo(() => listWorkers(recs, false).filter((w) => w.active || recs.some((r) => r.type === 'wage_payment' && (r.payload as { workerId: string; month: string }).workerId === w.entityId && (r.payload as { month: string }).month === month)), [recs, month]);
  const rows = useMemo(() => wageSheet(recs, workers, month, settings), [recs, workers, month, settings]);
  const totals = useMemo(() => sheetTotals(rows), [rows]);
  const lockRec = useMemo(() => recsOfType<PeriodLockP>(recs, 'period_lock').find((r) => r.payload.month === month), [recs, month]);
  const allowed = useCan();
  const canLock = allowed('month.lock');

  const rules = useUnitRules();
  // SPEC-M14: a month whose lock was reversed before needs a reason to lock again; an unlock always needs one.
  const lockedBefore = useMemo(() => {
    const reversed = new Set(recs.filter((r) => r.type === 'reversal' && r.sync !== 'rejected').map((r) => (r.payload as { targetId: string }).targetId));
    return recs.some((r) => r.type === 'period_lock' && reversed.has(r.id) && (r.payload as PeriodLockP).month === month);
  }, [recs, month]);
  const needsReason = Boolean(lockRec) || lockedBefore;
  const [lockReason, setLockReason] = useState('');
  const toggleLock = async () => {
    if (needsReason && !lockReason.trim()) return;
    if (lockRec) await reverse(lockRec.id, lockReason.trim());
    else await addRecord<PeriodLockP>('period_lock', { month, ...(lockReason.trim() ? { reason: lockReason.trim() } : {}) });
    setConfirmLock(false); setLockReason('');
  };
  const counts = (r: WageRow) => `P ${r.inputs.present} · H ${r.inputs.half} · A ${r.inputs.absent}${r.inputs.payType === 'daily' && r.inputs.offDays ? ` · ${t('wages.offDays')} ${r.inputs.offDays}` : ''}`;

  const card = (r: WageRow) => (
    <button type="button" onClick={() => navigate(`/wages/${month}/${r.worker.entityId}`)} className="card-hover flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left">
      <Avatar name={r.worker.name} size={44} photoId={r.worker.photoId} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{r.worker.name}</p>
        <p className="num text-sm text-muted">{counts(r)}{rules.overtimeEnabled && r.inputs.otHours ? ` · OT ${r.inputs.otHours}h` : ''}{r.inputs.payType === 'piece' ? ` · ${r.inputs.pieces} ${t('wages.pieces')}` : ''}</p>
      </div>
      <div className="text-right">
        <p className="num text-lg font-medium text-ink">{formatINR(r.payment ? r.payment.payload.paidPaise : r.settlement.paidPaise)}</p>
        {r.payment ? <Badge tone="received">{t('wages.paid')}</Badge> : <span className="text-sm text-muted">{t('wages.pending')}</span>}
      </div>
    </button>
  );

  return (
    <section>
      <PageHeader title={t('wages.sheet')} right={<MonthPicker month={month} onChange={setMonth} />} />
      {lockRec && <p role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-warn/30 bg-warn-soft px-4 py-2.5 text-sm font-medium text-warn"><Lock aria-hidden="true" size={16} />{t('wages.locked')} · {formatDay(lockRec.day, lang, 'short')}</p>}
      <StatRow className="mb-3 grid-cols-2 md:grid-cols-4">
        <StatTile label={t('wages.gross')} value={formatINR(totals.gross + totals.ot)} />
        <StatTile label={t('wages.advances')} tone={totals.advances ? 'given' : 'neutral'} value={<span className={cn(!totals.advances && 'text-muted')}>{formatINR(totals.advances)}</span>} />
        <StatTile label={t('wages.totalPaid')} tone={totals.paid ? 'received' : 'neutral'} value={<span className={cn(!totals.paid && 'text-muted')}>{formatINR(totals.paid)}</span>} testid="wages-paid" />
        <StatTile label={t('wages.totalPending')} tone={totals.pending > 0 ? 'given' : 'neutral'} value={formatINR(totals.pending)} testid="wages-pending" />
      </StatRow>
      <div className="mb-5 flex items-center gap-3">
        <WovenProgress done={totals.paidCount} total={totals.workers} tone="received" label={t('m17.paidOf', { paid: totals.paidCount, total: totals.workers })} className="max-w-xs" />
        <p className="num shrink-0 whitespace-nowrap text-sm text-muted">{t('wages.summary', { paid: totals.paidCount, total: totals.workers })}</p>
      </div>
      <ResponsiveTable<WageRow>
        rows={rows} rowKey={(r) => r.worker.entityId} renderCard={card} onRowClick={(r) => navigate(`/wages/${month}/${r.worker.entityId}`)}
        empty={<EmptyState icon={<Wallet size={40} />} title={t('wages.noWorkers')} />}
        columns={[
          { key: 'name', header: t('worker.name'), cell: (r) => <span className="flex items-center gap-2"><Avatar name={r.worker.name} size={32} photoId={r.worker.photoId} /><span className="font-medium">{r.worker.name}</span></span> },
          { key: 'att', header: t('att.title'), cell: (r) => <span className="num">{counts(r)}</span> },
          ...(rules.overtimeEnabled ? [{ key: 'ot', header: t('wages.ot'), align: 'right' as const, cell: (r: WageRow) => <span className="num">{r.inputs.otHours}h</span> }] : []),
          { key: 'gross', header: t('wages.gross'), align: 'right', cell: (r) => <span className="num">{formatINR((r.payment?.payload.grossPaise ?? r.settlement.grossPaise) + (r.payment?.payload.otPaise ?? r.settlement.otPaise))}</span> },
          { key: 'adv', header: t('wages.advances'), align: 'right', cell: (r) => { const v = r.payment?.payload.advanceRecoveredPaise ?? r.settlement.advanceRecoveredPaise; return <span className={cn('num', v ? 'text-given' : 'text-muted')}>{formatINR(v)}</span>; } },
          { key: 'net', header: t('wages.net'), align: 'right', cell: (r) => <span className="num font-medium">{formatINR(r.payment?.payload.paidPaise ?? r.settlement.paidPaise)}</span> },
          { key: 'st', header: '', cell: (r) => r.payment ? <Badge tone="received">{t('wages.paid')}</Badge> : <span className="text-sm text-muted">{t('wages.pending')}</span> },
        ]}
      />
      {canLock && rows.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <p className="text-sm text-ink-2">{t('wages.lockHint')}</p>
          <Button variant={lockRec ? 'secondary' : 'primary'} onClick={() => setConfirmLock(true)}>{lockRec ? <><Unlock aria-hidden="true" size={18} />{t('wages.unlock')}</> : <><Lock aria-hidden="true" size={18} />{t('wages.lock')}</>}</Button>
        </div>
      )}
      {needsReason ? (
        <Sheet open={confirmLock} onClose={() => setConfirmLock(false)} title={lockRec ? t('wages.unlock') : t('wages.lock')}
          footer={<Button block disabled={!lockReason.trim()} onClick={() => void toggleLock()}>{t('action.confirm')}</Button>}>
          <p className="mb-3 text-sm text-muted">{lockRec ? t('wages.lockHint') : t('wages.lockAgainHint')}</p>
          <Field label={lockRec ? t('wages.unlockReason') : t('wages.lockReason')} required>{({ id }) => <Textarea id={id} rows={2} value={lockReason} onChange={(e) => setLockReason(e.target.value)} />}</Field>
        </Sheet>
      ) : (
        <ConfirmSheet open={confirmLock} onClose={() => setConfirmLock(false)} onConfirm={() => void toggleLock()} title={t('wages.lock')} message={t('wages.lockHint')} />
      )}
    </section>
  );
}
