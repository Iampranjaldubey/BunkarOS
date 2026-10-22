import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { FormGrid } from '../../components/ui/FormGrid';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { PhotoCapture } from '../../components/ui/PhotoCapture';
import { DateField } from '../../components/ui/DateField';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { AdvanceP, PayMode } from '../../db/types';
import { listWorkers, getSettings } from '../../domain/masters';
import { advanceBalance } from '../../domain/advances';
import { isDayLocked } from '../../domain/locks';
import { formatINR, rupeesToPaise } from '../../domain/money';
import { todayIST } from '../../domain/ids';
import { useT } from '../../i18n';

export default function AdvanceNewPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const recs = useRecords();
  const workers = useMemo(() => listWorkers(recs), [recs]);
  const settings = useMemo(() => getSettings(recs), [recs]);
  const [workerId, setWorkerId] = useState(params.get('worker') ?? '');
  const [amount, setAmount] = useState(''); const [mode, setMode] = useState<PayMode>('cash');
  const [day, setDay] = useState(todayIST()); const [note, setNote] = useState(''); const [photoId, setPhotoId] = useState<string | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const paise = rupeesToPaise(Number(amount) || 0);
  const limit = settings?.photoRequiredAbovePaise ?? 200_000;
  const needPhoto = paise > limit;
  const balance = workerId ? advanceBalance(recs, workerId) : 0;

  const save = async () => {
    const e: Record<string, string> = {};
    if (!workerId) e.worker = t('valid.required');
    if (!(paise > 0)) e.amount = t('valid.positive');
    if (needPhoto && !photoId) e.photo = t('valid.photoRequired');
    if (isDayLocked(recs, day)) e.day = t('valid.locked');
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await addRecord<AdvanceP>('advance', { workerId, amountPaise: paise, mode, note: note.trim() || undefined }, { day, photoIds: photoId ? [photoId] : undefined });
      toast.show(t('adv.saved'), 'success');
      navigate(`/workers/${workerId}`, { replace: true });
    } finally { setBusy(false); }
  };

  return (
    <section className="mx-auto max-w-2xl">
      <PageHeader title={t('adv.title')} back />
      <Card className="md:p-6">
        <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <FormGrid>
            <Field label={t('adv.worker')} required error={errors.worker} className="lg:col-span-2">
              {({ id, describedBy, invalid }) => <Select id={id} value={workerId} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setWorkerId(e.target.value)}><option value="">—</option>{workers.map((w) => <option key={w.entityId} value={w.entityId}>{w.name}</option>)}</Select>}
            </Field>
            <Field label={t('adv.amount')} required error={errors.amount} hint={workerId ? `${t('wages.outstanding')}: ${formatINR(balance)} → ${t('adv.balanceAfter')}: ${formatINR(balance + paise)}` : undefined}>
              {({ id, describedBy, invalid }) => <Input id={id} inputMode="decimal" value={amount} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} className="num text-2xl text-given" autoFocus />}
            </Field>
            <div className="mb-4"><p className="mb-1.5 text-sm font-medium text-muted">{t('adv.mode')}</p>
              <SegmentedControl<PayMode> label={t('adv.mode')} value={mode} onChange={setMode} options={[{ value: 'cash', label: t('common.cash') }, { value: 'upi', label: t('common.upi') }]} /></div>
            <DateField value={day} onChange={setDay} error={errors.day} />
            <Field label={t('common.note')}>{({ id }) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
            <div className="lg:col-span-2"><PhotoCapture label={needPhoto ? `${t('common.photo')} — ${t('wages.photoHint')}` : t('common.photo')} required={needPhoto} value={photoId} onChange={setPhotoId} error={errors.photo} /></div>
          </FormGrid>
          <Button type="submit" size="xl" disabled={busy}>{t('action.save')}</Button>
        </form>
      </Card>
    </section>
  );
}
