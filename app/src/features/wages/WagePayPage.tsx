import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Printer, Share2, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { PhotoCapture } from '../../components/ui/PhotoCapture';
import { PreviewShareSheet } from '../../components/ui/PreviewShareSheet';
import { PageGrid } from '../../components/ui/PageGrid';
import { EmptyState } from '../../components/ui/Feedback';
import { DateField } from '../../components/ui/DateField';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { DeductionLine, PayMode, WagePaymentP } from '../../db/types';
import { listWorkers, getSettings } from '../../domain/masters';
import { wageInputsFor, computeGross, settle } from '../../domain/wage';
import { advanceBalance } from '../../domain/advances';
import { monthAttendance } from '../../domain/attendance';
import { lockedMonths } from '../../domain/locks';
import { recsOfType } from '../../domain/records';
import { formatINR, rupeesToPaise } from '../../domain/money';
import { formatMonth, formatDay } from '../../domain/dates';
import { todayIST, monthDays } from '../../domain/ids';
import { useT } from '../../i18n';
import { Avatar } from '../workers/shared';

export default function WagePayPage() {
  const { t, lang } = useT();
  const { month = '', workerId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const settings = useMemo(() => getSettings(recs), [recs]);
  const worker = useMemo(() => listWorkers(recs, false).find((w) => w.entityId === workerId), [recs, workerId]);
  const payment = useMemo(() => recsOfType<WagePaymentP>(recs, 'wage_payment').find((r) => r.payload.workerId === workerId && r.payload.month === month), [recs, workerId, month]);
  const locked = useMemo(() => lockedMonths(recs).has(month), [recs, month]);
  const [deductions, setDeductions] = useState<DeductionLine[]>([]);
  const [dLabel, setDLabel] = useState(''); const [dAmount, setDAmount] = useState('');
  const [recover, setRecover] = useState<string | null>(null);
  const [mode, setMode] = useState<PayMode>('cash'); const [day, setDay] = useState(todayIST());
  const [photoId, setPhotoId] = useState<string | undefined>(); const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');

  if (!worker) return <EmptyState title={t('common.empty')} />;
  const inputs = wageInputsFor(recs, worker, month, settings);
  const breakdown = computeGross(inputs);
  const outstanding = advanceBalance(recs, workerId) + (payment?.payload.advanceRecoveredPaise ?? 0);
  const s = payment
    ? settle({ ...breakdown, grossPaise: payment.payload.grossPaise, otPaise: payment.payload.otPaise }, payment.payload.deductions, outstanding, payment.payload.advanceRecoveredPaise)
    : settle(breakdown, deductions, outstanding, recover === null ? undefined : rupeesToPaise(Number(recover) || 0));
  const unmarked = monthAttendance(recs, workerId, month, monthDays(month).at(-1)! <= todayIST() ? monthDays(month).at(-1)! : todayIST(), settings).unmarked;
  const limit = settings?.photoRequiredAbovePaise ?? 200_000;
  const needPhoto = !payment && s.paidPaise > limit;

  const addDeduction = () => {
    const p = rupeesToPaise(Number(dAmount) || 0);
    if (!dLabel.trim() || !(p > 0)) return;
    setDeductions([...deductions, { label: dLabel.trim(), amountPaise: p }]); setDLabel(''); setDAmount('');
  };

  const pay = async () => {
    setErr('');
    if (locked) { setErr(t('valid.locked')); return; }
    if (needPhoto && !photoId) { setErr(t('valid.photoRequired')); return; }
    setBusy(true);
    try {
      await addRecord<WagePaymentP>('wage_payment', {
        workerId, month, grossPaise: s.grossPaise, otPaise: s.otPaise, deductions: s.deductions, advanceRecoveredPaise: s.advanceRecoveredPaise,
        netPaise: s.netPaise, paidPaise: s.paidPaise, roundingPaise: s.roundingPaise, mode,
        snapshot: { present: inputs.present, half: inputs.half, absent: inputs.absent, otHours: inputs.otHours, pieces: inputs.pieces, payType: inputs.payType, ratePaise: inputs.ratePaise },
      }, { day, photoIds: photoId ? [photoId] : undefined });
      toast.show(t('action.done'), 'success');
    } finally { setBusy(false); }
  };

  const lines: [string, number, 'given' | 'received' | 'neutral'][] = [];
  if (inputs.payType === 'monthly') { lines.push([t('wages.base'), inputs.ratePaise, 'neutral']); if (breakdown.absentDeductPaise) lines.push([t('wages.absentDeduct', { n: inputs.absent }), -breakdown.absentDeductPaise, 'given']); if (breakdown.halfDeductPaise) lines.push([t('wages.halfDeduct', { n: inputs.half }), -breakdown.halfDeductPaise, 'given']); }
  else if (inputs.payType === 'daily') lines.push([`${t('wages.daysWorked')}: ${inputs.present}${inputs.half ? ` + ${inputs.half}×½` : ''} × ${formatINR(inputs.ratePaise)}`, s.grossPaise, 'neutral']);
  else lines.push([`${t('wages.pieces')}: ${inputs.pieces}`, s.grossPaise, 'neutral']);
  if (s.otPaise) lines.push([`${t('wages.ot')}: ${inputs.otHours}h × ${formatINR(inputs.otRatePaise)}`, s.otPaise, 'received']);
  for (const d of s.deductions) lines.push([d.label, -d.amountPaise, 'given']);
  if (s.advanceRecoveredPaise) lines.push([t('wages.advances'), -s.advanceRecoveredPaise, 'given']);
  if (s.roundingPaise) lines.push([t('wages.rounding'), s.roundingPaise, 'neutral']);

  const slipText = t('slip.text', {
    unit: settings?.unitName ?? '', month: formatMonth(month, lang), name: worker.name,
    lines: lines.map(([l, v]) => `${l}: ${v < 0 ? '−' : ''}${formatINR(Math.abs(v), { paise: v % 100 !== 0 })}`).join('\n'),
    paid: formatINR(s.paidPaise), mode: t(`common.${payment?.payload.mode ?? mode}`), balance: formatINR(Math.max(0, outstanding - s.advanceRecoveredPaise)),
  });

  const breakdownCard = (
    <Card className="print:border-0 print:shadow-none" data-testid="wage-breakdown">
      <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
        <Avatar name={worker.name} size={48} photoId={worker.photoId} />
        <div className="flex-1"><p className="text-lg font-medium text-ink">{worker.name}</p><p className="text-sm text-muted">{formatMonth(month, lang)} · {t(`worker.payType.${inputs.payType}`)}</p></div>
        {payment ? <Badge tone="received">{t('wages.paidOn', { date: formatDay(payment.day, lang, 'short') })}</Badge> : locked ? <Badge tone="warn">{t('wages.locked')}</Badge> : null}
      </div>
      <p className="num mb-2 text-sm text-muted">P {inputs.present} · H {inputs.half} · A {inputs.absent} · OT {inputs.otHours}h{inputs.payType === 'monthly' ? ` · ${t('wages.perDay')} ${formatINR(breakdown.perDayPaise)}` : ''}</p>
      {!payment && unmarked > 0 && <p className="mb-2 rounded-lg bg-warn-soft px-3 py-1.5 text-sm text-warn">{t('wages.unmarkedWarn', { n: unmarked })}</p>}
      <dl className="divide-y divide-line">
        {lines.map(([l, v, tone], i) => (
          <div key={i} className="flex items-center justify-between py-2"><dt className="text-ink">{l}</dt><dd className={`num font-medium ${tone === 'given' ? 'text-given' : tone === 'received' ? 'text-received' : 'text-ink'}`}>{v < 0 ? '−' : ''}{formatINR(Math.abs(v), { paise: v % 100 !== 0 })}</dd></div>
        ))}
        <div className="flex items-center justify-between py-3"><dt className="text-lg font-medium text-ink">{payment ? t('wages.paid') : t('wages.net')}</dt><dd className="num text-3xl font-bold text-ink" data-testid="wage-paid">{formatINR(s.paidPaise)}</dd></div>
      </dl>
      <p className="text-sm text-muted">{t('wages.afterRecover')}: <span className="num font-medium text-ink">{formatINR(Math.max(0, outstanding - s.advanceRecoveredPaise))}</span></p>
    </Card>
  );

  return (
    <section>
      <PageHeader title={t('wages.pay')} back={() => navigate('/wages')} right={payment && (
        <div className="no-print flex gap-2">
          {worker.phone && <Button size="md" variant="secondary" onClick={() => setShare(true)}><Share2 aria-hidden="true" size={16} />{t('wages.slip')}</Button>}
          <Button size="md" variant="ghost" onClick={() => window.print()}><Printer aria-hidden="true" size={16} />{t('action.print')}</Button>
        </div>
      )} />
      <PageGrid main={breakdownCard} asideSticky aside={payment ? (
        <Card className="no-print"><CardTitle>{t('wages.slip')}</CardTitle><pre className="whitespace-pre-wrap font-sans text-sm text-ink">{slipText}</pre></Card>
      ) : (
        <Card className="no-print">
          <CardTitle>{t('wages.deductions')}</CardTitle>
          {deductions.length > 0 && <ul className="mb-2 divide-y divide-line">{deductions.map((d, i) => <li key={i} className="flex items-center justify-between py-1.5 text-sm"><span>{d.label}</span><span className="flex items-center gap-2"><span className="num text-given">{formatINR(d.amountPaise)}</span><button type="button" aria-label={t('action.delete')} onClick={() => setDeductions(deductions.filter((_, j) => j !== i))} className="tap-48 rounded-lg text-muted hover:text-given"><Trash2 aria-hidden="true" size={16} /></button></span></li>)}</ul>}
          <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
            <Field label={t('wages.deductionLabel')} className="mb-0">{({ id }) => <Input id={id} value={dLabel} onChange={(e) => setDLabel(e.target.value)} />}</Field>
            <Field label={t('wages.deductionAmount')} className="mb-0 w-28">{({ id }) => <Input id={id} inputMode="decimal" value={dAmount} onChange={(e) => setDAmount(e.target.value.replace(/[^\d.]/g, ''))} className="num" />}</Field>
            <Button size="md" variant="secondary" onClick={addDeduction} aria-label={t('wages.addDeduction')}><Plus aria-hidden="true" size={18} /></Button>
          </div>
          <hr className="my-4 border-line" />
          <Field label={`${t('wages.recover')} — ${t('wages.outstanding')}: ${formatINR(outstanding)}`}>
            {({ id }) => <Input id={id} inputMode="decimal" value={recover ?? String(s.advanceRecoveredPaise / 100)} disabled={outstanding === 0} onChange={(e) => setRecover(e.target.value.replace(/[^\d.]/g, ''))} className="num" />}
          </Field>
          <div className="mb-4"><p className="mb-1.5 text-sm font-medium text-muted">{t('wages.mode')}</p>
            <SegmentedControl<PayMode> label={t('wages.mode')} value={mode} onChange={setMode} options={[{ value: 'cash', label: t('common.cash') }, { value: 'upi', label: t('common.upi') }]} /></div>
          <DateField value={day} onChange={setDay} />
          <PhotoCapture label={needPhoto ? `${t('common.photo')} — ${t('wages.photoHint')}` : t('common.photo')} required={needPhoto} value={photoId} onChange={setPhotoId} />
          {err && <p role="alert" className="mb-2 text-sm font-medium text-given">{err}</p>}
          <Button block size="xl" disabled={busy || locked} onClick={() => void pay()}>{t('wages.confirm')} · {formatINR(s.paidPaise)}</Button>
        </Card>
      )} />
      {worker.phone && <PreviewShareSheet open={share} onClose={() => setShare(false)} recipientName={worker.name} phone={worker.phone} text={slipText} />}
    </section>
  );
}
