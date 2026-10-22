import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input, Select } from '../../components/ui/Input';
import { FormGrid } from '../../components/ui/FormGrid';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { PhotoCapture } from '../../components/ui/PhotoCapture';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { JobTitle, PayType, WorkerP } from '../../db/types';
import { listWorkers, getSettings } from '../../domain/masters';
import { can } from '../../domain/permissions';
import { formatINR, rupeesToPaise } from '../../domain/money';
import { uuid, todayIST } from '../../domain/ids';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';

const JOBS: JobTitle[] = ['weaver', 'finisher', 'helper', 'other'];

export default function WorkerFormPage() {
  const { t } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = useSession();
  const recs = useRecords();
  const existing = useMemo(() => (id ? listWorkers(recs, false).find((w) => w.entityId === id) : undefined), [recs, id]);
  const settings = useMemo(() => getSettings(recs), [recs]);
  const canRates = role ? can(role, 'worker.rates') : false;

  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [job, setJob] = useState<JobTitle>('weaver');
  const [payType, setPayType] = useState<PayType>('monthly'); const [amount, setAmount] = useState(''); const [otRate, setOtRate] = useState('');
  const [joinedOn, setJoinedOn] = useState(todayIST()); const [photoId, setPhotoId] = useState<string | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name); setPhone(existing.phone ?? ''); setJob(existing.jobTitle); setPayType(existing.payType);
    const amt = existing.payType === 'monthly' ? existing.salaryPaise : existing.payType === 'daily' ? existing.dailyRatePaise : existing.pieceRatePaise;
    setAmount(amt ? String(amt / 100) : ''); setOtRate(existing.otRatePaise ? String(existing.otRatePaise / 100) : ''); setJoinedOn(existing.joinedOn); setPhotoId(existing.photoId);
  }, [existing]);

  const wd = settings?.workingDaysPerMonth ?? 26;
  const amountPaise = rupeesToPaise(Number(amount) || 0);
  const defaultOt = payType === 'monthly' ? Math.round(amountPaise / wd / 8) : payType === 'daily' ? Math.round(amountPaise / 8) : 0;
  const otPaise = otRate.trim() ? rupeesToPaise(Number(otRate)) : defaultOt;

  const save = async (addAnother: boolean) => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('valid.required');
    if (phone.trim() && !/^\d{10}$/.test(phone.replace(/\D/g, '').slice(-10))) e.phone = t('valid.phone');
    if (!(amountPaise > 0)) e.amount = t('valid.positive');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(joinedOn)) e.joinedOn = t('valid.date');
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const base: WorkerP = {
        entityId: existing?.entityId ?? uuid(), name: name.trim(), phone: phone.trim() || undefined, jobTitle: job, payType,
        otRatePaise: existing && !canRates ? existing.otRatePaise : otPaise, joinedOn, active: existing?.active ?? true, photoId,
      };
      const rateField = payType === 'monthly' ? 'salaryPaise' : payType === 'daily' ? 'dailyRatePaise' : 'pieceRatePaise';
      if (existing && !canRates) {
        // staff: keep pay figures exactly as they were (server enforces this too)
        base.payType = existing.payType; base.salaryPaise = existing.salaryPaise; base.dailyRatePaise = existing.dailyRatePaise; base.pieceRatePaise = existing.pieceRatePaise;
      } else {
        base[rateField] = amountPaise;
      }
      await addRecord<WorkerP>('worker', base);
      toast.show(t('action.done'), 'success');
      if (addAnother) { setName(''); setPhone(''); setAmount(''); setOtRate(''); setPhotoId(undefined); setErrors({}); }
      else navigate(existing ? `/workers/${existing.entityId}` : '/workers', { replace: true });
    } finally { setBusy(false); }
  };

  const ratesDisabled = Boolean(existing) && !canRates;
  const amountLabel = payType === 'monthly' ? t('worker.salary') : payType === 'daily' ? t('worker.dailyRate') : t('worker.pieceRate');

  return (
    <section className="mx-auto max-w-2xl">
      <PageHeader title={existing ? t('worker.edit') : t('worker.new')} back />
      <Card className="md:p-6">
        <form onSubmit={(e) => { e.preventDefault(); void save(false); }}>
          <FormGrid>
            <Field label={t('worker.name')} required error={errors.name}>{({ id, describedBy, invalid }) => <Input id={id} value={name} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
            <Field label={t('worker.phone')} error={errors.phone}>{({ id, describedBy, invalid }) => <Input id={id} type="tel" inputMode="numeric" value={phone} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setPhone(e.target.value)} />}</Field>
            <Field label={t('worker.jobTitle')}>{({ id }) => <Select id={id} value={job} onChange={(e) => setJob(e.target.value as JobTitle)}>{JOBS.map((j) => <option key={j} value={j}>{t(`worker.job.${j}`)}</option>)}</Select>}</Field>
            <Field label={t('worker.joinedOn')} error={errors.joinedOn}>{({ id }) => <Input id={id} type="date" value={joinedOn} max={todayIST()} onChange={(e) => setJoinedOn(e.target.value)} className="num" />}</Field>
            <div className="mb-4 lg:col-span-2">
              <p className="mb-1.5 text-sm font-medium text-muted">{t('worker.payType')}</p>
              <SegmentedControl<PayType> label={t('worker.payType')} value={payType} onChange={(v) => { if (!ratesDisabled) setPayType(v); }}
                options={[{ value: 'monthly', label: t('worker.payType.monthly') }, { value: 'daily', label: t('worker.payType.daily') }, { value: 'piece', label: t('worker.payType.piece') }]} />
              {ratesDisabled && <p className="mt-1 text-sm text-muted">{t('worker.rateLocked')}</p>}
            </div>
            <Field label={amountLabel} required error={errors.amount} hint={payType === 'monthly' && amountPaise > 0 ? t('worker.perDay', { amount: formatINR(Math.round(amountPaise / wd)) }) : undefined}>
              {({ id, describedBy, invalid }) => <Input id={id} inputMode="decimal" value={amount} disabled={ratesDisabled} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} className="num text-xl" />}
            </Field>
            <Field label={t('worker.otRate')} hint={payType !== 'piece' ? `${t('worker.otHint')} = ${formatINR(defaultOt)}` : undefined}>
              {({ id }) => <Input id={id} inputMode="decimal" value={otRate} disabled={ratesDisabled} placeholder={payType !== 'piece' ? String(defaultOt / 100) : '0'} onChange={(e) => setOtRate(e.target.value.replace(/[^\d.]/g, ''))} className="num" />}
            </Field>
            <div className="lg:col-span-2"><PhotoCapture label={t('worker.photo')} value={photoId} onChange={setPhotoId} /></div>
          </FormGrid>
          <div className="mt-2 flex flex-col gap-2 md:flex-row">
            <Button type="submit" size="lg" disabled={busy} className="md:flex-1">{t('action.save')}</Button>
            {!existing && <Button type="button" variant="secondary" size="lg" disabled={busy} onClick={() => void save(true)} className="md:flex-1">{t('action.saveAdd')}</Button>}
          </div>
        </form>
      </Card>
    </section>
  );
}
