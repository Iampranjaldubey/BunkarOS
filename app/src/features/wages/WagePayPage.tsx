import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Plus, Printer, Share2, Trash2, Undo2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Field } from '../../components/ui/Field';
import { Input, Textarea } from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { PhotoCapture } from '../../components/ui/PhotoCapture';
import { PreviewShareSheet } from '../../components/ui/PreviewShareSheet';
import { PageGrid } from '../../components/ui/PageGrid';
import { EmptyState } from '../../components/ui/Feedback';
import { DateField } from '../../components/ui/DateField';
import { Sheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord, reverse } from '../../db/repo';
import type { DeductionLine, PayMode, ReversalP, WageLineKey, WagePaymentP } from '../../db/types';
import { listWorkers, getSettings } from '../../domain/masters';
import { wageInputsFor, computeGross, settle, paidView, liveView, buildSnapshot, overrideError, type OverrideMap, type WageLine } from '../../domain/wage';
import { wageLineText, wageLineTone, signedINR, slipContent, slipText, lineKeyName } from './lines';
import { SlipPaper } from './SlipPaper';
import { advanceBalance } from '../../domain/advances';
import { monthAttendance } from '../../domain/attendance';
import { lockedMonths } from '../../domain/locks';
import { recsOfType } from '../../domain/records';
import { formatINR, rupeesToPaise } from '../../domain/money';
import { formatMonth, formatDay } from '../../domain/dates';
import { todayIST, monthDays } from '../../domain/ids';
import { authedFetch } from '../../sync';
import { useT } from '../../i18n';
import { useCan, useUnitRules } from '../../app/useCan';
import { Avatar } from '../workers/shared';

export default function WagePayPage() {
  const { t, lang } = useT();
  const { month = '', workerId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const rules = useUnitRules();
  const allowed = useCan();
  const settings = useMemo(() => getSettings(recs), [recs]);
  const worker = useMemo(() => listWorkers(recs, false).find((w) => w.entityId === workerId), [recs, workerId]);
  const payment = useMemo(() => recsOfType<WagePaymentP>(recs, 'wage_payment').find((r) => r.payload.workerId === workerId && r.payload.month === month), [recs, workerId, month]);
  // SPEC-M14: a payment for this worker-month that was reversed → paying again needs a correction reason.
  const hadReversed = useMemo(() => {
    const reversed = new Set(recs.filter((r) => r.type === 'reversal' && r.sync !== 'rejected').map((r) => (r.payload as ReversalP).targetId));
    return recs.some((r) => r.type === 'wage_payment' && r.sync !== 'rejected' && reversed.has(r.id) && (r.payload as WagePaymentP).workerId === workerId && (r.payload as WagePaymentP).month === month);
  }, [recs, workerId, month]);
  const locked = useMemo(() => lockedMonths(recs).has(month), [recs, month]);
  const [deductions, setDeductions] = useState<DeductionLine[]>([]);
  const [dLabel, setDLabel] = useState(''); const [dAmount, setDAmount] = useState('');
  const [recover, setRecover] = useState<string | null>(null);
  const [mode, setMode] = useState<PayMode>('cash'); const [day, setDay] = useState(todayIST());
  const [photoId, setPhotoId] = useState<string | undefined>(); const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [edit, setEdit] = useState<WageLineKey | null>(null); const [editAmount, setEditAmount] = useState(''); const [editReason, setEditReason] = useState('');
  const [correction, setCorrection] = useState('');
  const [reverseOpen, setReverseOpen] = useState(false); const [reverseReason, setReverseReason] = useState('');
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  if (!worker) return <EmptyState title={t('common.empty')} />;
  const isOwner = allowed('wage.override');
  const canPay = allowed('wage.pay');
  const inputs = wageInputsFor(recs, worker, month, settings);
  const breakdown = computeGross(inputs);
  const outstanding = advanceBalance(recs, workerId); // nothing paid yet for this month when the form is used
  const live = settle(breakdown, deductions, outstanding, recover === null ? undefined : rupeesToPaise(Number(recover) || 0), overrides);
  // SPEC-M16 §1: a paid month is shown only from what was saved with the payment.
  const view = payment ? paidView(payment.payload) : liveView(inputs, breakdown, live);
  const balanceAfter = view.balanceAfterPaise ?? advanceBalance(recs, workerId);
  const negativeNet = !payment && live.netPaise < 0;
  const unmarked = monthAttendance(recs, workerId, month, monthDays(month).at(-1)! <= todayIST() ? monthDays(month).at(-1)! : todayIST(), settings).unmarked;
  const limit = settings?.photoRequiredAbovePaise ?? 200_000;
  const needPhoto = !payment && live.paidPaise > limit;
  const showOt = rules.overtimeEnabled || view.otPaise !== 0;

  const addDeduction = () => {
    const p = rupeesToPaise(Number(dAmount) || 0);
    if (!dLabel.trim() || !(p > 0)) return;
    setDeductions([...deductions, { label: dLabel.trim(), amountPaise: p }]); setDLabel(''); setDAmount('');
  };

  // ---- owner override of one line (SPEC-M14) ----
  const openEdit = (k: WageLineKey) => {
    setEdit(k);
    const cur = overrides[k];
    setEditAmount(cur ? String(cur.finalPaise / 100) : String((live.parts[k] ?? 0) / 100));
    setEditReason(cur?.reason ?? '');
  };
  const editPaise = Math.round(Number(editAmount) * 100);
  const editErr = edit && editAmount.trim() !== '' ? overrideError(edit, editPaise, outstanding) : '';
  const canSaveEdit = Boolean(edit) && editAmount.trim() !== '' && Number.isFinite(Number(editAmount)) && !editErr && editReason.trim().length > 0;
  const saveEdit = () => {
    if (!edit || !canSaveEdit) return;
    setOverrides({ ...overrides, [edit]: { finalPaise: editPaise, reason: editReason.trim() } });
    setEdit(null);
  };
  const removeEdit = () => { if (!edit) return; const next = { ...overrides }; delete next[edit]; setOverrides(next); setEdit(null); };

  const pay = async () => {
    setErr('');
    if (!canPay) return;
    if (locked) { setErr(t('valid.locked')); return; }
    if (negativeNet) { setErr(t('wages.negativeNet')); return; }
    if (hadReversed && !correction.trim()) { setErr(t('wages.correctionHint')); return; }
    if (needPhoto && !photoId) { setErr(t('valid.photoRequired')); return; }
    setBusy(true);
    try {
      const s = live;
      await addRecord<WagePaymentP>('wage_payment', {
        workerId, month, grossPaise: s.grossPaise, otPaise: s.otPaise, deductions: s.deductions, advanceRecoveredPaise: s.advanceRecoveredPaise,
        netPaise: s.netPaise, paidPaise: s.paidPaise, roundingPaise: s.roundingPaise, mode,
        snapshot: buildSnapshot(inputs, breakdown, outstanding, s),
        ...(s.overrides.length ? { overrides: s.overrides } : {}),
        ...(hadReversed ? { correctionReason: correction.trim() } : {}),
      }, { day, photoIds: photoId ? [photoId] : undefined });
      setOverrides({}); setCorrection('');
      toast.show(t('action.done'), 'success');
    } finally { setBusy(false); }
  };
  const reversePayment = async () => {
    if (!payment || !reverseReason.trim()) return;
    await reverse(payment.id, reverseReason.trim());
    setReverseOpen(false); setReverseReason('');
    toast.show(t('action.done'), 'success');
  };

  // ---- slip (D-003): the same content for the A4 page and the WhatsApp text ----
  const slip = slipContent({
    view, sections: rules.slip, t, overtimeEnabled: rules.overtimeEnabled,
    business: settings?.unitName ?? '', worker: worker.name, month: formatMonth(month, lang),
    mode: payment?.payload.mode, payDayText: payment ? formatDay(payment.day, lang, 'medium') : undefined,
  });
  const shareText = slipText(slip, t, linkUrl ?? undefined);
  const openShare = async () => {
    // The worker-page link (SPEC-M07) goes at the end of the WhatsApp text; without internet the text goes without it.
    if (!linkUrl && navigator.onLine) {
      try {
        const r = await authedFetch('/api/worker-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workerId: worker.entityId }) });
        if (r.ok) { const b = (await r.json()) as { token: string }; setLinkUrl(`${window.location.origin}/w/${b.token}`); }
      } catch { /* offline: share without the link */ }
    }
    setShare(true);
  };

  const lineRow = (l: WageLine, i: number) => {
    const tone = wageLineTone(l);
    const key = 'key' in l ? l.key : undefined;
    const ov = 'override' in l ? l.override : undefined;
    return (
      <div key={i} className="py-2" data-testid={key ? `line-${key}` : undefined}>
        <div className="flex items-center justify-between gap-2">
          <dt className="flex min-w-0 items-center gap-2 text-ink">
            <span className="min-w-0">{wageLineText(l, t)}</span>
            {ov && <Badge tone="warn" data-testid="owner-changed">{t('wages.ownerChanged')}</Badge>}
          </dt>
          <dd className="flex items-center gap-1">
            {ov && <s className="num text-sm text-muted" data-testid="computed-amount">{signedINR(ov.computedPaise)}</s>}
            <span className={`num font-medium ${tone === 'given' ? 'text-given' : tone === 'received' ? 'text-received' : 'text-ink'}`}>{signedINR(l.amountPaise)}</span>
            {!payment && isOwner && key && (
              <button type="button" onClick={() => openEdit(key)} aria-label={t('wages.changeLine', { line: lineKeyName(key, t) })} title={t('wages.change')}
                className="no-print inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-primary-soft hover:text-primary"><Pencil aria-hidden="true" size={16} strokeWidth={1.75} /></button>
            )}
          </dd>
        </div>
        {ov && <p className="mt-0.5 text-sm text-muted" data-testid="override-reason">{t('log.reasonShort', { reason: ov.reason })}</p>}
      </div>
    );
  };

  const breakdownCard = (
    <Card className="print:border-0 print:shadow-none" data-testid="wage-breakdown">
      <div className="mb-3 flex items-center gap-3 border-b border-line pb-3">
        <Avatar name={worker.name} size={48} photoId={worker.photoId} />
        <div className="flex-1"><p className="text-lg font-medium text-ink">{worker.name}</p><p className="text-sm text-muted">{formatMonth(month, lang)} · {t(`worker.payType.${view.payType}`)}</p></div>
        {payment ? <Badge tone="received">{t('wages.paidOn', { date: formatDay(payment.day, lang, 'short') })}</Badge> : locked ? <Badge tone="warn">{t('wages.locked')}</Badge> : null}
      </div>
      <p className="num mb-2 text-sm text-muted" data-testid="wage-counts">
        P {view.present} · H {view.half} · A {view.absent}{view.payType === 'daily' && view.offDays ? ` · ${t('wages.offDays')} ${view.offDays}` : ''}{showOt ? ` · OT ${view.otHours}h` : ''}{view.payType === 'monthly' && view.perDayPaise ? ` · ${t('wages.perDay')} ${formatINR(view.perDayPaise)}` : ''}
      </p>
      {!payment && unmarked > 0 && <p className="mb-3 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">{t('wages.unmarkedWarn', { n: unmarked })}</p>}
      {!payment && isOwner && <p className="no-print mb-1 text-sm text-muted">{t('wages.overrideHint')}</p>}
      <dl className="divide-y divide-line" data-testid="wage-lines">
        {view.lines.map(lineRow)}
        <div className="flex items-center justify-between border-t-2 border-line-strong pt-3 pb-1"><dt className="text-lg font-medium text-ink">{payment ? t('wages.paid') : t('wages.net')}</dt><dd className="num font-display text-4xl font-medium text-ink" data-testid="wage-paid">{formatINR(view.paidPaise)}</dd></div>
      </dl>
      {negativeNet && <p role="alert" className="mb-2 rounded-lg bg-given-soft px-3 py-1.5 text-sm font-medium text-given" data-testid="negative-net">{t('wages.negativeNet')} ({signedINR(live.netPaise)})</p>}
      <p className="text-sm text-muted">{t('wages.afterRecover')}: <span className="num font-medium text-ink" data-testid="wage-balance-after">{formatINR(balanceAfter)}</span></p>
      {payment?.payload.correctionReason && <p className="mt-1 text-sm text-muted">{t('log.correction', { reason: payment.payload.correctionReason })}</p>}
    </Card>
  );

  const paidAside = payment && (
    <div className="flex flex-col gap-3">
      <Card className="no-print"><CardTitle>{t('wages.slip')}</CardTitle><pre className="whitespace-pre-wrap font-sans text-sm text-ink" data-testid="slip-text">{shareText}</pre></Card>
      {isOwner && (
        <Card className="no-print" data-testid="change-paid">
          <CardTitle>{t('wages.changePaid')}</CardTitle>
          <ol className="mb-3 list-none space-y-1 text-sm text-muted">
            <li className={locked ? 'font-medium text-ink' : 'line-through'}>{t('wages.step1')}</li>
            <li className={locked ? '' : 'font-medium text-ink'}>{t('wages.step2')}</li>
            <li>{t('wages.step3')}</li>
            <li>{t('wages.step4')}</li>
          </ol>
          {locked
            ? <><p role="status" className="mb-2 rounded-lg bg-warn-soft px-3 py-1.5 text-sm text-warn">{t('wages.unlockFirst')}</p><Link to="/wages" className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-medium text-primary hover:bg-primary-soft">{t('nav.wages')} →</Link></>
            : <Button variant="secondary" onClick={() => setReverseOpen(true)}><Undo2 aria-hidden="true" size={18} />{t('wages.reversePay')}</Button>}
        </Card>
      )}
    </div>
  );

  const payForm = (
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
        {({ id }) => <Input id={id} inputMode="decimal" value={recover ?? String(live.advanceRecoveredPaise / 100)} disabled={outstanding === 0 || Boolean(overrides.advance_recovered)} onChange={(e) => setRecover(e.target.value.replace(/[^\d.]/g, ''))} className="num" />}
      </Field>
      <div className="mb-4"><p className="mb-1.5 text-base font-medium text-ink">{t('wages.mode')}</p>
        <SegmentedControl<PayMode> label={t('wages.mode')} value={mode} onChange={setMode} options={[{ value: 'cash', label: t('common.cash') }, { value: 'upi', label: t('common.upi') }]} /></div>
      <DateField value={day} onChange={setDay} />
      {hadReversed && (
        <Field label={t('wages.correctionReason')} required hint={t('wages.correctionHint')}>
          {({ id, describedBy }) => <Textarea id={id} rows={2} value={correction} aria-describedby={describedBy} onChange={(e) => setCorrection(e.target.value)} data-testid="correction-reason" />}
        </Field>
      )}
      <PhotoCapture label={needPhoto ? `${t('common.photo')} — ${t('wages.photoHint')}` : t('common.photo')} required={needPhoto} value={photoId} onChange={setPhotoId} />
      {err && <p role="alert" className="mb-2 text-sm font-medium text-given">{err}</p>}
      <Button block size="xl" disabled={busy || locked || negativeNet || !canPay || (hadReversed && !correction.trim())} onClick={() => void pay()}>{t('wages.confirm')} · {formatINR(live.paidPaise)}</Button>
    </Card>
  );

  const computedForEdit = edit ? (live.parts[edit] ?? 0) : 0;
  return (
    <>
      <section>
        <PageHeader title={t('wages.pay')} back={() => navigate('/wages')} right={payment && (
          <div className="no-print flex gap-2">
            {worker.phone && <Button size="md" variant="secondary" onClick={() => void openShare()}><Share2 aria-hidden="true" size={16} />{t('wages.slip')}</Button>}
            <Button size="md" variant="ghost" onClick={() => window.print()} data-testid="print-slip"><Printer aria-hidden="true" size={16} />{t('slip.print')}</Button>
          </div>
        )} />
        <PageGrid main={breakdownCard} asideSticky aside={payment ? paidAside : payForm} />
        {worker.phone && <PreviewShareSheet open={share} onClose={() => setShare(false)} recipientName={worker.name} phone={worker.phone} text={shareText} />}
        <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title={edit ? t('wages.overrideTitle', { line: lineKeyName(edit, t) }) : ''}
          footer={<>
            {edit && overrides[edit] && <Button variant="secondary" block onClick={removeEdit}>{t('wages.overrideRemove')}</Button>}
            <Button block disabled={!canSaveEdit} onClick={saveEdit} data-testid="override-save">{t('wages.overrideSave')}</Button>
          </>}>
          <p className="mb-3 text-ink">{t('wages.computed')}: <span className="num font-medium" data-testid="override-computed">{signedINR(computedForEdit)}</span></p>
          <Field label={t('wages.newAmount')} required error={editErr ? t(`wages.overrideErr.${editErr}`) : undefined}>
            {({ id, describedBy, invalid }) => <Input id={id} inputMode="decimal" value={editAmount} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setEditAmount(e.target.value.replace(/[^\d.−-]/g, '').replace('−', '-'))} className="num text-xl" autoFocus />}
          </Field>
          <Field label={t('wages.overrideReason')} required>
            {({ id }) => <Textarea id={id} rows={2} value={editReason} onChange={(e) => setEditReason(e.target.value)} />}
          </Field>
        </Sheet>
        <Sheet open={reverseOpen} onClose={() => setReverseOpen(false)} title={t('wages.reversePay')}
          footer={<Button block variant="danger" disabled={!reverseReason.trim()} onClick={() => void reversePayment()}>{t('wages.reversePay')}</Button>}>
          <Field label={t('wages.reverseReason')} required>{({ id }) => <Textarea id={id} rows={2} value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} />}</Field>
        </Sheet>
      </section>
      {payment && <div className="print-slip"><SlipPaper c={slip} /></div>}
    </>
  );
}
