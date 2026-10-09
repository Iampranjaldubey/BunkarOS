import { useMemo, useState } from 'react';
import { IndianRupee, Lock, Plus, Scale } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Pill,
  Sheet,
  MoneyInput,
  useToast,
  ResponsiveTable,
  type ColumnDef,
} from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { useRecords, useSession } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import { activeRecords, latestEntities } from '../../domain/projections';
import { can } from '../../domain/permissions';
import { formatINR } from '../../domain/money';
import { istDay } from '../../domain/ids';
import type { Rec, RateP, NormP, RateUnit, WorkKind } from '../../db/types';
import { uuid } from '../../domain/ids';
import { useT } from '../../i18n';
import { formatDay } from '../../domain/dates';
import { cn } from '../../lib/utils';
import { Section } from '../looms/shared';
import { PhoneOnly, DesktopOnly } from '../../components/ui/Responsive';

/** Group all (non-reversed) WEAVING rate records by quality, newest first. */
function ratesByQuality(recs: Rec[]): Map<string, RateP[]> {
  const active = activeRecords(recs).filter((r) => r.type === 'rate') as Rec<RateP>[];
  const map = new Map<string, RateP[]>();
  for (const r of active) {
    if (r.payload.work && r.payload.work !== 'weaving') continue; // skip job rates
    const list = map.get(r.payload.quality) ?? [];
    list.push(r.payload);
    map.set(r.payload.quality, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.effectiveFrom === b.effectiveFrom ? 0 : a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  }
  return map;
}

/** Group ancillary-work (job) rate records by work kind, newest first. */
function ratesByWork(recs: Rec[]): Map<string, RateP[]> {
  const active = activeRecords(recs).filter((r) => r.type === 'rate') as Rec<RateP>[];
  const map = new Map<string, RateP[]>();
  for (const r of active) {
    const work = r.payload.work;
    if (!work || work === 'weaving') continue; // weaving handled separately
    const list = map.get(work) ?? [];
    list.push(r.payload);
    map.set(work, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.effectiveFrom === b.effectiveFrom ? 0 : a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  }
  return map;
}

const perSqftPaise = (r: RateP) => (r.unit === 'sqgaj' ? Math.round(r.ratePaise / 9) : r.ratePaise);

export default function RatesPage() {
  const { t } = useT();
  const { role } = useSession();
  const toast = useToast();
  const recs = useRecords();

  const canEdit = role ? can(role, 'rate.edit') : false;
  const grouped = useMemo(() => ratesByQuality(recs), [recs]);
  const jobGrouped = useMemo(() => ratesByWork(recs), [recs]);
  const norms = useMemo(() => latestEntities<NormP>(recs, 'norm'), [recs]);

  const [rateSheet, setRateSheet] = useState(false);
  const [jobSheet, setJobSheet] = useState(false);
  const [normSheet, setNormSheet] = useState(false);

  return (
    <section>
      <PageHeader
        title={t('rate.list.title')}
        right={
          canEdit && grouped.size > 0 ? (
            <Button size="md" data-testid="add-rate-btn" onClick={() => setRateSheet(true)} aria-label={t('rate.add')}>
              <Plus aria-hidden="true" size={20} />
            </Button>
          ) : undefined
        }
      />

      {!canEdit && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-line bg-bg px-4 py-3 text-sm text-muted">
          <Lock aria-hidden="true" size={18} />
          {t('rate.readonly')}
        </div>
      )}

      {/* Weaving + ancillary (job) rate tables. On phones each renders today's
          card list (unchanged); at lg they become real tables and at xl the two
          sit side by side so the wide screen is used, not stretched. */}
      <div className="xl:grid xl:grid-cols-2 xl:gap-6">
        <Section title={t('rate.section.weaving')}>
          {grouped.size === 0 ? (
            <EmptyState
              icon={<IndianRupee size={48} />}
              title={t('rate.empty.title')}
              hint={t('rate.empty.hint')}
              action={canEdit ? <Button data-testid="add-rate-btn" onClick={() => setRateSheet(true)}><Plus aria-hidden="true" size={20} />{t('rate.add.weaving')}</Button> : undefined}
            />
          ) : (
            <RateTable
              groups={grouped}
              label={(k) => k}
              testid="weaving-rates-table"
              rowTestid="rate-row"
              perSqft
              renderCard={(quality, list) => {
                const current = list[0];
                const history = list.slice(1);
                return (
                  <Card data-testid="rate-row">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold text-ink">{quality}</div>
                        <div className="text-sm text-muted">{t('rate.current')} · {t('rate.effectiveFrom', { d: current.effectiveFrom })}</div>
                      </div>
                      <div className="text-right">
                        <div className="num text-2xl font-bold text-indigo">{formatINR(current.ratePaise)}</div>
                        <div className="text-sm text-muted">{t('rate.unit.' + current.unit)}</div>
                        {current.unit === 'sqgaj' && (
                          <div className="num text-xs text-muted">= {t('rate.perSqft', { v: (perSqftPaise(current) / 100).toFixed(2) })}</div>
                        )}
                      </div>
                    </div>
                    {history.length > 0 && (
                      <div className="mt-3 border-t border-line pt-3">
                        <div className="mb-1.5 text-sm text-muted">{t('rate.history')}</div>
                        <ul className="space-y-1.5">
                          {history.map((h, i) => (
                            <li key={h.effectiveFrom + i} className="flex items-center justify-between text-sm text-muted">
                              <span className="num">{t('rate.effectiveFrom', { d: h.effectiveFrom })}</span>
                              <span className="num">{formatINR(h.ratePaise)} / {t('rate.unit.' + h.unit)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                );
              }}
            />
          )}
        </Section>

        <Section
          title={t('rate.section.job')}
          right={
            canEdit ? (
              <Button size="md" variant="secondary" data-testid="add-job-rate-btn" onClick={() => setJobSheet(true)} aria-label={t('rate.add.job')}>
                <Plus aria-hidden="true" size={18} />
              </Button>
            ) : undefined
          }
        >
          <p className="mb-2 text-sm text-muted">{t('rate.section.job.hint')}</p>
          {jobGrouped.size === 0 ? (
            <p className="text-base text-muted">{t('rate.empty.job')}</p>
          ) : (
            <RateTable
              groups={jobGrouped}
              label={(k) => t('work.' + k)}
              testid="job-rates-table"
              rowTestid="job-rate-row"
              renderCard={(work, list) => {
                const current = list[0];
                const history = list.slice(1);
                return (
                  <Card data-testid="job-rate-row">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold text-ink">{t('work.' + work)}</div>
                        <div className="text-sm text-muted">{t('rate.current')} · {t('rate.effectiveFrom', { d: current.effectiveFrom })}</div>
                      </div>
                      <div className="text-right">
                        <div className="num text-2xl font-bold text-indigo">{formatINR(current.ratePaise)}</div>
                        <div className="text-sm text-muted">{t('rate.unit.' + current.unit)}</div>
                      </div>
                    </div>
                    {history.length > 0 && (
                      <div className="mt-3 border-t border-line pt-3">
                        <div className="mb-1.5 text-sm text-muted">{t('rate.history')}</div>
                        <ul className="space-y-1.5">
                          {history.map((h, i) => (
                            <li key={h.effectiveFrom + i} className="flex items-center justify-between text-sm text-muted">
                              <span className="num">{t('rate.effectiveFrom', { d: h.effectiveFrom })}</span>
                              <span className="num">{formatINR(h.ratePaise)} / {t('rate.unit.' + h.unit)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                );
              }}
            />
          )}
        </Section>
      </div>

      <Section
        title={t('norm.title')}
        right={
          canEdit ? (
            <Button size="md" variant="secondary" onClick={() => setNormSheet(true)} aria-label={t('norm.add')}>
              <Plus aria-hidden="true" size={18} />
            </Button>
          ) : undefined
        }
      >
        <p className="mb-2 text-sm text-muted">{t('norm.hint')}</p>
        {!canEdit && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl border border-line bg-bg px-4 py-2.5 text-sm text-muted">
            <Lock aria-hidden="true" size={16} />
            {t('norm.readonly')}
          </div>
        )}
        {norms.length === 0 ? (
          <p className="text-base text-muted">{t('norm.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {norms.map((n) => (
              <li key={n.entityId}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-2">
                    <Scale aria-hidden="true" size={18} className="text-muted" />
                    <span className="text-base text-ink">{n.quality}</span>
                  </div>
                  <Pill tone="info" className="num">{t('norm.perSqft', { v: n.gramsPerSqft })}</Pill>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {canEdit && <AddRateSheet open={rateSheet} onClose={() => setRateSheet(false)} existing={[...grouped.keys()]} onSaved={() => toast.show(t('rate.saved'), 'success')} />}
      {canEdit && <AddJobRateSheet open={jobSheet} onClose={() => setJobSheet(false)} onSaved={() => toast.show(t('rate.saved'), 'success')} />}
      {canEdit && <AddNormSheet open={normSheet} onClose={() => setNormSheet(false)} existing={[...grouped.keys()]} onSaved={() => toast.show(t('norm.saved'), 'success')} />}
    </section>
  );
}

/** A single flattened row in a desktop rates table: the current rate for a
 *  quality/work, or one of its (muted) history entries. */
interface RateRow {
  id: string;
  label: string;
  rate: RateP;
  isCurrent: boolean;
}

/**
 * Desktop/tablet rates table (lg+). Below lg it renders `renderCard` per group
 * — byte-identical to today's phone cards (same `space-y-3` card list). At lg
 * each group flattens into one current row plus muted history rows: label ·
 * rate (right-aligned) · unit · effective-from. The current row carries
 * `rowTestid` so existing selectors (`rate-row` / `job-rate-row`) keep working
 * on both layouts.
 */
function RateTable({
  groups,
  label,
  testid,
  rowTestid,
  perSqft,
  renderCard,
}: {
  groups: Map<string, RateP[]>;
  label: (key: string) => string;
  testid: string;
  rowTestid: string;
  perSqft?: boolean;
  renderCard: (key: string, list: RateP[]) => React.ReactNode;
}) {
  const { t, lang } = useT();
  const entries = [...groups.entries()];

  const rows: RateRow[] = [];
  for (const [key, list] of entries) {
    rows.push({ id: key, label: label(key), rate: list[0], isCurrent: true });
    list.slice(1).forEach((h, i) => {
      rows.push({ id: `${key}:h${i}`, label: label(key), rate: h, isCurrent: false });
    });
  }

  const columns: ColumnDef<RateRow>[] = [
    {
      key: 'label',
      header: perSqft ? t('col.rate.quality') : t('col.rate.work'),
      cell: (r) =>
        r.isCurrent ? (
          <span data-testid={rowTestid} className="font-bold text-ink">{r.label}</span>
        ) : (
          <span className="pl-2 text-sm text-muted">{t('rate.table.history')}</span>
        ),
    },
    {
      key: 'rate',
      header: t('col.rate.rate'),
      align: 'right',
      cell: (r) => (
        <span className={cn('num font-bold', r.isCurrent ? 'text-indigo' : 'text-muted')}>
          {formatINR(r.rate.ratePaise)}
          {perSqft && r.rate.unit === 'sqgaj' && (
            <span className="num ml-1 text-xs font-normal text-muted">
              (= {t('rate.perSqft', { v: (perSqftPaise(r.rate) / 100).toFixed(2) })})
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'unit',
      header: t('col.rate.unit'),
      cell: (r) => <span className={cn('text-sm', r.isCurrent ? 'text-ink' : 'text-muted')}>{t('rate.unit.' + r.rate.unit)}</span>,
    },
    {
      key: 'effective',
      header: t('col.rate.effective'),
      align: 'right',
      cell: (r) => <span className={cn('num text-sm', r.isCurrent ? 'text-ink' : 'text-muted')}>{formatDay(r.rate.effectiveFrom, lang, 'medium')}</span>,
    },
  ];

  return (
    <>
      {/* Phone cards — unchanged phone layout (one card per group). */}
      <PhoneOnly>
      <ul className="space-y-3">
        {entries.map(([key, list]) => (
          <li key={key}>{renderCard(key, list)}</li>
        ))}
      </ul>
      </PhoneOnly>

      {/* Desktop/tablet table (current rate + muted history rows). */}
      <DesktopOnly>
      <div>
        <ResponsiveTable<RateRow>
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          testid={testid}
          renderCard={() => null}
        />
      </div>
      </DesktopOnly>
    </>
  );
}

function AddRateSheet({ open, onClose, existing, onSaved }: { open: boolean; onClose: () => void; existing: string[]; onSaved: () => void }) {
  const { t } = useT();
  const [quality, setQuality] = useState('');
  const [unit, setUnit] = useState<RateUnit>('sqft');
  const [ratePaise, setRatePaise] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(() => istDay(new Date()));
  const [touched, setTouched] = useState(false);

  const errQuality = touched && !quality.trim() ? t('valid.required') : undefined;
  const errRate = touched && ratePaise <= 0 ? t('masters.valid.rate') : undefined;
  const valid = quality.trim() && ratePaise > 0 && effectiveFrom;

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    await addRecord<RateP>('rate', { entityId: uuid(), quality: quality.trim(), unit, ratePaise, effectiveFrom });
    onSaved();
    setQuality('');
    setRatePaise(0);
    setTouched(false);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('rate.add')}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose}>{t('action.cancel')}</Button>
          <Button block onClick={save}>{t('rate.save')}</Button>
        </>
      }
    >
      <Field label={t('rate.field.quality')} required error={errQuality}>
        {({ id, describedBy, invalid }) => (
          <>
            <Input id={id} list="rate-qualities" aria-describedby={describedBy} aria-invalid={invalid || undefined} value={quality} onChange={(e) => setQuality(e.target.value)} />
            <datalist id="rate-qualities">{existing.map((q) => <option key={q} value={q} />)}</datalist>
          </>
        )}
      </Field>
      <Field label={t('rate.field.unit')}>
        {({ id, describedBy }) => (
          <Select id={id} aria-describedby={describedBy} value={unit} onChange={(e) => setUnit(e.target.value as RateUnit)}>
            <option value="sqft">{t('rate.unit.sqft')}</option>
            <option value="sqgaj">{t('rate.unit.sqgaj')}</option>
            <option value="piece">{t('rate.unit.piece')}</option>
          </Select>
        )}
      </Field>
      <Field label={t('rate.field.rupees')} required error={errRate}>
        {({ describedBy, invalid }) => (
          <MoneyInput value={ratePaise} onChange={setRatePaise} allowPaise describedBy={describedBy} invalid={invalid} aria-label={t('rate.field.rupees')} />
        )}
      </Field>
      <Field label={t('rate.field.effective')} required>
        {({ id, describedBy }) => (
          <Input id={id} type="date" aria-describedby={describedBy} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        )}
      </Field>
    </Sheet>
  );
}

function AddJobRateSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  type JobWork = Exclude<WorkKind, 'weaving'>;
  const WORK_UNIT: Record<JobWork, RateUnit> = { untying: 'kg', straightening: 'kg', helper: 'day', other: 'piece' };
  const [work, setWork] = useState<JobWork>('straightening');
  const [ratePaise, setRatePaise] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(() => istDay(new Date()));
  const [touched, setTouched] = useState(false);

  const unit = WORK_UNIT[work];
  const errRate = touched && ratePaise <= 0 ? t('masters.valid.rate') : undefined;
  const valid = ratePaise > 0 && effectiveFrom;

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    await addRecord<RateP>('rate', { entityId: uuid(), quality: '', unit, ratePaise, effectiveFrom, work });
    onSaved();
    setRatePaise(0);
    setTouched(false);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('rate.add.job')}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose}>{t('action.cancel')}</Button>
          <Button block onClick={save}>{t('rate.save')}</Button>
        </>
      }
    >
      <Field label={t('rate.field.work')}>
        {({ id, describedBy }) => (
          <Select id={id} aria-describedby={describedBy} value={work} onChange={(e) => setWork(e.target.value as JobWork)}>
            <option value="untying">{t('work.untying')}</option>
            <option value="straightening">{t('work.straightening')}</option>
            <option value="helper">{t('work.helper')}</option>
            <option value="other">{t('work.other')}</option>
          </Select>
        )}
      </Field>
      <div className="mb-3 flex items-center gap-2 rounded-2xl border border-line bg-bg px-4 py-2.5 text-sm text-muted">
        <Lock aria-hidden="true" size={16} />
        {t('rate.field.unit')}: {t('rate.unit.' + unit)}
      </div>
      <Field label={t('rate.field.rupeesJob')} required error={errRate}>
        {({ describedBy, invalid }) => (
          <MoneyInput value={ratePaise} onChange={setRatePaise} allowPaise describedBy={describedBy} invalid={invalid} aria-label={t('rate.field.rupeesJob')} />
        )}
      </Field>
      <Field label={t('rate.field.effective')} required>
        {({ id, describedBy }) => (
          <Input id={id} type="date" aria-describedby={describedBy} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        )}
      </Field>
    </Sheet>
  );
}

function AddNormSheet({ open, onClose, existing, onSaved }: { open: boolean; onClose: () => void; existing: string[]; onSaved: () => void }) {
  const { t } = useT();
  const [quality, setQuality] = useState('');
  const [grams, setGrams] = useState('');
  const [touched, setTouched] = useState(false);

  const g = Number(grams);
  const errQuality = touched && !quality.trim() ? t('valid.required') : undefined;
  const errGrams = touched && !(g > 0) ? t('masters.valid.grams') : undefined;
  const valid = quality.trim() && g > 0;

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    await addRecord<NormP>('norm', { entityId: uuid(), quality: quality.trim(), gramsPerSqft: g });
    onSaved();
    setQuality('');
    setGrams('');
    setTouched(false);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('norm.add')}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose}>{t('action.cancel')}</Button>
          <Button block onClick={save}>{t('norm.save')}</Button>
        </>
      }
    >
      <Field label={t('norm.field.quality')} required error={errQuality}>
        {({ id, describedBy, invalid }) => (
          <>
            <Input id={id} list="norm-qualities" aria-describedby={describedBy} aria-invalid={invalid || undefined} value={quality} onChange={(e) => setQuality(e.target.value)} />
            <datalist id="norm-qualities">{existing.map((q) => <option key={q} value={q} />)}</datalist>
          </>
        )}
      </Field>
      <Field label={t('norm.field.grams')} required error={errGrams}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} type="number" inputMode="decimal" min={0} step={0.1} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={grams} onChange={(e) => setGrams(e.target.value)} className="text-right" />
        )}
      </Field>
    </Sheet>
  );
}
