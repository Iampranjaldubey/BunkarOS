import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Scissors, AlignJustify, UserCog, Package, Lock, IndianRupee } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Field } from '../../components/ui/Field';
import { KgInput, MoneyInput } from '../../components/ui/NumberInputs';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { PhotoCapture } from '../../components/ui/PhotoCapture';
import { ConfirmSheet } from '../../components/ui/Sheet';
import { PersonPicker, type Person } from '../../components/ui/PersonPicker';
import { FormGrid } from '../../components/ui/FormGrid';
import { useToast } from '../../components/ui/Toast';
import { useRecords, useSession } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { JobP, WorkKind } from '../../db/types';
import { listWeavers, listThekedars, jobRateFor, computeJob } from '../../domain/projections';
import { formatINR } from '../../domain/money';
import { today, photoThresholdPaise, Row, ActionBar } from '../shared/helpers';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

type WorkerKind = JobP['workerKind'];
type JobWork = Exclude<WorkKind, 'weaving'>;
type JobUnit = JobP['unit'];

/** Each ancillary work has a fixed billing unit. */
const WORK_UNIT: Record<JobWork, JobUnit> = {
  untying: 'kg',
  straightening: 'kg',
  helper: 'day',
  other: 'piece',
};

const WORK_ICON: Record<JobWork, typeof Scissors> = {
  untying: Scissors,
  straightening: AlignJustify,
  helper: UserCog,
  other: Package,
};

const WORKS: JobWork[] = ['untying', 'straightening', 'helper', 'other'];

export default function JobNewPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const { role } = useSession();
  const isOwner = role === 'owner';

  const [workerKind, setWorkerKind] = useState<WorkerKind>('weaver');
  const [workerId, setWorkerId] = useState<string | undefined>();
  const [workerName, setWorkerName] = useState('');
  const [work, setWork] = useState<JobWork>('straightening');
  const [grams, setGrams] = useState(0);
  const [days, setDays] = useState(0);
  const [count, setCount] = useState(0);
  const [cash, setCash] = useState(0);
  const [upi, setUpi] = useState(0);
  const [photoId, setPhotoId] = useState<string | undefined>();
  const [confirm, setConfirm] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const unit = WORK_UNIT[work];
  const onDay = today();

  const weavers = useMemo<Person[]>(
    () => listWeavers(recs).filter((w) => w.active).map((w) => ({ id: w.entityId, name: w.name, fatherName: w.fatherName, village: w.village, photoId: w.photoId })),
    [recs],
  );
  const thekedars = useMemo(() => listThekedars(recs).filter((x) => x.active), [recs]);

  const rate = useMemo(() => jobRateFor(recs, work, unit, onDay), [recs, work, unit, onDay]);

  // Compute amount (guarded: computeJob throws on bad qty, so wrap).
  const amount = useMemo(() => {
    if (!rate) return undefined;
    try {
      return computeJob({ unit, grams, days, count, ratePaise: rate.ratePaise });
    } catch {
      return undefined;
    }
  }, [rate, unit, grams, days, count]);

  const threshold = photoThresholdPaise(recs);
  const paid = amount?.paidPaise ?? 0;
  const needsPhoto = paid > threshold;
  const splitOk = amount ? cash + upi === paid : false;

  const resolvedWorkerName =
    workerKind === 'weaver'
      ? weavers.find((w) => w.id === workerId)?.name ?? ''
      : workerKind === 'thekedar'
        ? thekedars.find((th) => th.entityId === workerId)?.name ?? ''
        : workerName.trim();

  const workerOk = workerKind === 'other' ? workerName.trim().length > 0 : Boolean(workerId);
  const valid = workerOk && Boolean(rate) && Boolean(amount) && splitOk && (!needsPhoto || photoId);

  const doSave = async () => {
    if (!rate || !amount) return;
    setSaving(true);
    try {
      const payload: JobP = {
        workerKind,
        workerId: workerKind === 'other' ? undefined : workerId,
        workerName: workerKind === 'other' ? workerName.trim() : undefined,
        work,
        unit,
        grams: unit === 'kg' ? grams : undefined,
        days: unit === 'day' ? days : undefined,
        count: unit === 'piece' ? count : undefined,
        rateId: rate.entityId,
        ratePaise: rate.ratePaise,
        amountPaise: amount.amountPaise,
        paidPaise: amount.paidPaise,
        roundingPaise: amount.roundingPaise,
        payment: { cashPaise: cash, upiPaise: upi },
      };
      await addRecord<JobP>('job', payload, photoId ? { photoIds: [photoId] } : {});
      toast.show(t('job.saved'), 'success');
      navigate('/');
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  };

  return (
    <section>
      <PageHeader title={t('job.new.title')} back />

      <FormGrid>
      {/* Worker ---------------------------------------------------------- */}
      <Card className="lg:col-span-2">
        <p className="mb-2 text-base font-medium text-ink">{t('job.worker')}</p>
        <SegmentedControl
          label={t('job.worker')}
          value={workerKind}
          onChange={(k) => {
            setWorkerKind(k);
            setWorkerId(undefined);
            setWorkerName('');
          }}
          options={[
            { value: 'weaver', label: t('job.worker.weaver') },
            { value: 'thekedar', label: t('job.worker.thekedar') },
            { value: 'other', label: t('job.worker.other') },
          ]}
          className="mb-3"
        />
        {workerKind === 'weaver' && <PersonPicker people={weavers} value={workerId} onSelect={setWorkerId} label={t('job.worker.pick')} />}
        {workerKind === 'thekedar' && (
          <ul className="flex flex-col gap-2" role="listbox" aria-label={t('job.worker.thekedar')}>
            {thekedars.map((th) => (
              <li key={th.entityId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={workerId === th.entityId}
                  onClick={() => setWorkerId(th.entityId)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink',
                    workerId === th.entityId ? 'border-indigo bg-indigo/5' : 'border-line bg-surface hover:bg-bg',
                  )}
                >
                  <span className="block text-lg font-semibold text-ink">{th.name}</span>
                  <span className="block text-sm text-muted">{th.village}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {workerKind === 'other' && (
          <Field label={t('job.worker.name')} required error={touched && !workerName.trim() ? t('job.valid.name') : undefined}>
            {({ id, describedBy, invalid }) => (
              <>
                <Input id={id} value={workerName} onChange={(e) => setWorkerName(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                <p className="mt-1 text-sm text-muted">{t('job.worker.name.hint')}</p>
              </>
            )}
          </Field>
        )}
      </Card>

      {/* Work type ------------------------------------------------------- */}
      <Card className="lg:col-span-2">
        <p className="mb-2 text-base font-medium text-ink">{t('job.work')}</p>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t('job.work')}>
          {WORKS.map((w) => {
            const Icon = WORK_ICON[w];
            const selected = w === work;
            return (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setWork(w)}
                className={cn(
                  'flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center transition-colors',
                  'focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink',
                  selected ? 'border-indigo bg-indigo/5' : 'border-line bg-surface hover:bg-bg',
                )}
              >
                <Icon aria-hidden="true" size={26} className={selected ? 'text-indigo' : 'text-muted'} />
                <span className="text-base font-medium text-ink">{t('work.' + w)}</span>
                <span className="text-xs text-muted">{t('rate.unit.' + unitForWork(w))}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Quantity -------------------------------------------------------- */}
      <Card>
        {unit === 'kg' && (
          <Field label={t('job.qty.kg')} required error={touched && !(grams > 0) ? t('job.valid.qty') : undefined}>
            {({ describedBy, invalid }) => <KgInput value={grams} onChange={setGrams} describedBy={describedBy} invalid={invalid} aria-label={t('job.qty.kg')} />}
          </Field>
        )}
        {unit === 'day' && (
          <Field label={t('job.qty.day')} required error={touched && !(days > 0) ? t('job.valid.qty') : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                min={0.5}
                step={0.5}
                value={days || ''}
                onChange={(e) => setDays(Number(e.target.value) || 0)}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className="text-right"
              />
            )}
          </Field>
        )}
        {unit === 'piece' && (
          <Field label={t('job.qty.piece')} required error={touched && !(count > 0) ? t('job.valid.qty') : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={count || ''}
                onChange={(e) => setCount(Math.floor(Number(e.target.value)) || 0)}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                className="text-right"
              />
            )}
          </Field>
        )}
      </Card>

      {/* Rate + amount --------------------------------------------------- */}
      {rate ? (
        <Card>
          <div className="mb-3 flex items-center gap-2 rounded-2xl border border-line bg-bg px-4 py-2.5 text-sm text-muted">
            <Lock aria-hidden="true" size={16} />
            {t('job.rate.locked', { rate: `${formatINR(rate.ratePaise)} ${t('rate.unit.' + unit)}` })}
          </div>
          {amount && (
            <>
              <Row label={t('job.amount')}>{formatINR(amount.amountPaise, { paise: true })}</Row>
              {amount.roundingPaise !== 0 && <Row label={t('job.rounding')}>{formatINR(amount.roundingPaise, { paise: true })}</Row>}
              <div className="my-1 border-t border-line" />
              <Row label={t('job.paid')} strong>{formatINR(amount.paidPaise)}</Row>
            </>
          )}
        </Card>
      ) : (
        <Card className="border-madder/30 bg-madder/5" data-testid="job-no-rate">
          <div className="flex items-start gap-2 text-madder">
            <IndianRupee aria-hidden="true" size={18} className="mt-0.5" />
            <div>
              <p className="font-medium">{isOwner ? t('job.rate.none.owner') : t('job.rate.none.munshi')}</p>
              {isOwner && (
                <Link to="/rates" className="mt-1 inline-block text-indigo underline">
                  {t('job.rate.goto')}
                </Link>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Payment split --------------------------------------------------- */}
      {rate && amount && (
        <Card className="lg:col-span-2">
          <p className="mb-2 text-base font-medium text-ink">{t('job.payment')}</p>
          <Field label={t('job.cash')}>
            {({ describedBy }) => <MoneyInput value={cash} onChange={setCash} describedBy={describedBy} aria-label={t('job.cash')} />}
          </Field>
          <Field label={t('job.upi')}>
            {({ describedBy }) => <MoneyInput value={upi} onChange={setUpi} describedBy={describedBy} aria-label={t('job.upi')} />}
          </Field>
          {touched && !splitOk && <p className="text-sm text-madder">{t('job.split.mismatch')}</p>}
          <PhotoCapture
            value={photoId}
            onChange={setPhotoId}
            required={needsPhoto}
            label={needsPhoto ? t('job.photo') : `${t('job.photo')} (${t('common.optional')})`}
            error={touched && needsPhoto && !photoId ? t('job.photo.required') : undefined}
          />
        </Card>
      )}
      </FormGrid>

      <ActionBar>
        <Button
          data-testid="job-save"
          variant="danger"
          size="xl"
          disabled={saving}
          onClick={() => {
            setTouched(true);
            if (valid) setConfirm(true);
          }}
        >
          {t('job.save')}
        </Button>
      </ActionBar>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => void doSave()}
        danger
        title={t('job.confirm.title')}
        confirmLabel={t('job.save')}
        message={t('job.confirm.body', { work: t('work.' + work), worker: resolvedWorkerName, paid: formatINR(paid) })}
      />
    </section>
  );
}

function unitForWork(w: JobWork): JobUnit {
  return WORK_UNIT[w];
}
