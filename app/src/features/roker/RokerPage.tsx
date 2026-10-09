import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Money } from '../../components/ui/Money';
import { Pill } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Sheet, ConfirmSheet } from '../../components/ui/Sheet';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Field } from '../../components/ui/Field';
import { Select, Textarea } from '../../components/ui/Input';
import { MoneyInput } from '../../components/ui/NumberInputs';
import { PhotoCapture } from '../../components/ui/PhotoCapture';
import { EmptyState } from '../../components/ui/Feedback';
import { StatTile } from '../../components/ui/Feedback';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { useToast } from '../../components/ui/Toast';
import { useRecords, useSession } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import { rokerDay, getSettings, formatDay, listWeavers, listThekedars } from '../../domain/projections';
import type { RokerEntry } from '../../domain/projections';
import type { RokerHead, RokerP, PayMode, Rec, BazaarP, PeshgiP } from '../../db/types';
import { istDay, daysBetween } from '../../domain/ids';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

const HEADS: RokerHead[] = ['kharcha', 'dyer', 'transport', 'wool_purchase', 'receipt', 'misc'];

/** Shift a YYYY-MM-DD day by n days (UTC-safe). */
function shiftDay(day: string, n: number): string {
  const ms = Date.parse(`${day}T00:00:00Z`) + n * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function EntryRow({ entry, label }: { entry: RokerEntry; label: string }) {
  const { t } = useT();
  const out = entry.dir === 'out';
  const info = entry.kind === 'adjusted';
  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-0">
      <span
        aria-hidden="true"
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          info ? 'bg-indigo/10 text-indigo' : out ? 'bg-madder/10 text-madder' : 'bg-ok/12 text-ok',
        )}
      >
        {out ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-base text-ink">{label}</span>
          {entry.auto && <Pill tone="info">{t('roker.auto')}</Pill>}
          {info && <Pill tone="neutral">{t('roker.adjusted')}</Pill>}
        </span>
        <span className="text-sm text-muted">
          {t(`roker.mode.${entry.mode}`)}
          {info ? ` · ${t('roker.adjustedInfo')}` : ''}
        </span>
      </span>
      <Money
        paise={entry.amountPaise}
        flow={info ? 'neutral' : out ? 'given' : 'received'}
        size="md"
      />
    </li>
  );
}

export default function RokerPage() {
  const { t, lang } = useT();
  const toast = useToast();
  const recs = useRecords();
  const { role } = useSession();
  const settings = getSettings(recs);
  const threshold = settings?.photoRequiredAbovePaise ?? 200_000;

  const today = istDay(new Date().toISOString());
  const [day, setDay] = useState(today);
  const data = useMemo(() => rokerDay(recs, day), [recs, day]);

  // Resolve human-readable, i18n'd entry labels from each entry's source record
  // (B1): auto-posted rows otherwise render a raw English word + a 36-char UUID
  // (e.g. "Peshgi thekedar 421c912a-…"), and manual rows prefix the raw head
  // enum. We derive names/head/piece from entry.recId + live records instead.
  const weaverNames = useMemo(
    () => new Map(listWeavers(recs).map((w) => [w.entityId, w.name])),
    [recs],
  );
  const thekedarNames = useMemo(
    () => new Map(listThekedars(recs).map((x) => [x.entityId, x.name])),
    [recs],
  );
  const recById = useMemo(() => new Map<string, Rec>(recs.map((r) => [r.id, r])), [recs]);

  const entryLabel = (e: RokerEntry): string => {
    const r = recById.get(e.recId);
    if (!r) return e.label; // defensive fallback — should not happen
    if (r.type === 'peshgi') {
      const p = r.payload as PeshgiP;
      const name =
        (p.personKind === 'weaver' ? weaverNames : thekedarNames).get(p.personId) ?? '—';
      return `${t('roker.label.peshgiGiven')} · ${name}`;
    }
    if (r.type === 'bazaar') {
      const b = r.payload as BazaarP;
      const name = weaverNames.get(b.weaverId) ?? b.pieceId;
      return e.kind === 'adjusted'
        ? `${t('roker.label.peshgiRecovered')} · ${name}`
        : `${t('roker.label.bazaarPayout')} · ${b.pieceId}`;
    }
    if (r.type === 'roker') {
      const p = r.payload as RokerP;
      return t(`roker.head.${p.head}`) + (p.note ? `: ${p.note}` : '');
    }
    if (r.type === 'job') {
      // The job entry already carries the translated-work key + resolved worker.
      const work = e.work ? t('work.' + e.work) : '';
      const worker = e.workerName ?? '';
      return t('job.roker.label', { work, worker });
    }
    return e.label;
  };

  // Add-entry sheet state.
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState<'in' | 'out'>('out');
  const [mode, setMode] = useState<PayMode>('cash');
  const [head, setHead] = useState<RokerHead>('kharcha');
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [photoId, setPhotoId] = useState<string | undefined>();
  const [err, setErr] = useState<string | undefined>();
  const [photoErr, setPhotoErr] = useState<string | undefined>();
  const [confirm, setConfirm] = useState(false);

  const canAdd = role === 'owner' || role === 'munshi';
  const needsPhoto = amount > threshold;
  const isToday = day === today;
  const prettyDay = formatDay(day, lang, 'medium');

  const reset = () => {
    setDir('out'); setMode('cash'); setHead('kharcha'); setAmount(0);
    setNote(''); setPhotoId(undefined); setErr(undefined); setPhotoErr(undefined);
  };

  const tryConfirm = () => {
    let ok = true;
    if (amount <= 0) { setErr(t('valid.positive')); ok = false; } else setErr(undefined);
    if (needsPhoto && !photoId) { setPhotoErr(t('roker.photoNeeded')); ok = false; } else setPhotoErr(undefined);
    if (ok) setConfirm(true);
  };

  const save = async () => {
    setConfirm(false);
    await addRecord<RokerP>(
      'roker',
      { dir, mode, amountPaise: amount, head, note: note.trim() || undefined },
      photoId ? { photoIds: [photoId] } : {},
    );
    toast.show(t('roker.saved'), 'success');
    setOpen(false);
    reset();
  };

  return (
    <section>
      <PageHeader title={t('roker.title')} />

      {/* Date selector */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button
          variant="secondary"
          size="md"
          aria-label={t('roker.prevDay')}
          onClick={() => setDay((d) => shiftDay(d, -1))}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <div className="flex-1 text-center">
          <div className="text-xl font-bold text-ink">{prettyDay}</div>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDay(today)}
              className="text-sm font-medium text-indigo underline-offset-2 hover:underline"
            >
              {t('roker.today')}
            </button>
          )}
        </div>
        <Button
          variant="secondary"
          size="md"
          aria-label={t('roker.nextDay')}
          disabled={daysBetween(day, today) <= 0}
          onClick={() => setDay((d) => shiftDay(d, 1))}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      {/* Mobile (below lg): opening, entries list, totals grid, closing — unchanged. */}
      <div className="lg:hidden">
        {/* Opening cash */}
        <Card className="mb-4 flex items-center justify-between">
          <span className="text-base text-muted">{t('roker.opening')}</span>
          <Money paise={data.openingCash} size="lg" />
        </Card>

        {/* Entries */}
        <Card className="mb-4">
          <h2 className="mb-1 text-lg">{t('roker.entries')}</h2>
          {data.entries.length === 0 ? (
            <EmptyState
              icon={<Wallet size={40} />}
              title={t('roker.empty')}
              hint={canAdd ? t('roker.emptyHint') : undefined}
            />
          ) : (
            <ul>
              {data.entries.map((e, i) => (
                <EntryRow key={e.recId + i} entry={e} label={entryLabel(e)} />
              ))}
            </ul>
          )}
        </Card>

        {/* Totals */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Card className="bg-ok/5">
            <div className="text-sm text-muted">{t('roker.cashIn')}</div>
            <Money paise={data.cashIn} flow="received" size="md" />
          </Card>
          <Card className="bg-madder/5">
            <div className="text-sm text-muted">{t('roker.cashOut')}</div>
            <Money paise={data.cashOut} flow="given" size="md" />
          </Card>
          <Card className="bg-ok/5">
            <div className="text-sm text-muted">{t('roker.upiIn')}</div>
            <Money paise={data.upiIn} flow="received" size="md" />
          </Card>
          <Card className="bg-madder/5">
            <div className="text-sm text-muted">{t('roker.upiOut')}</div>
            <Money paise={data.upiOut} flow="given" size="md" />
          </Card>
        </div>

        {/* Closing cash — big */}
        <Card className="mb-6 border-indigo/30 bg-indigo/5 text-center" data-testid="roker-closing">
          <div className="mb-1 text-base text-muted">{t('roker.closing')}</div>
          <Money paise={data.closingCash} size="xl" className="text-indigo" />
        </Card>
      </div>

      {/* Desktop/tablet (lg+): StatTiles row above a real entries table. */}
      <div className="hidden lg:block">
        <div className="mb-5 grid grid-cols-4 gap-4">
          <StatTile tone="neutral" label={t('roker.stat.opening')} value={<Money paise={data.openingCash} size="md" />} />
          <StatTile tone="received" label={t('roker.stat.in')} value={<Money paise={data.cashIn + data.upiIn} flow="received" size="md" />} />
          <StatTile tone="given" label={t('roker.stat.out')} value={<Money paise={data.cashOut + data.upiOut} flow="given" size="md" />} />
          <StatTile tone="info" label={t('roker.stat.closing')} value={<Money paise={data.closingCash} size="md" className="text-indigo" />} />
        </div>

        <ResponsiveTable
          rows={data.entries}
          rowKey={(e) => e.recId + ':' + e.dir + ':' + e.mode + ':' + (e.kind ?? '')}
          testid="roker-table"
          empty={<EmptyState icon={<Wallet size={40} />} title={t('roker.empty')} hint={canAdd ? t('roker.emptyHint') : undefined} />}
          renderCard={() => null}
          columns={[
            {
              key: 'label',
              header: t('col.roker.label'),
              cell: (e) => (
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-ink">{entryLabel(e)}</span>
                  {e.auto && <Pill tone="info">{t('roker.auto')}</Pill>}
                  {e.kind === 'adjusted' && <Pill tone="neutral">{t('roker.adjusted')}</Pill>}
                </span>
              ),
            },
            { key: 'mode', header: t('col.roker.mode'), cell: (e) => <span className="text-muted">{t(`roker.mode.${e.mode}`)}</span> },
            {
              key: 'in',
              header: t('col.roker.in'),
              align: 'right',
              cell: (e) =>
                e.kind !== 'adjusted' && e.dir === 'in' ? (
                  <Money paise={e.amountPaise} flow="received" size="md" />
                ) : e.kind === 'adjusted' ? (
                  <Money paise={e.amountPaise} flow="neutral" size="md" />
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
            {
              key: 'out',
              header: t('col.roker.out'),
              align: 'right',
              cell: (e) =>
                e.kind !== 'adjusted' && e.dir === 'out' ? (
                  <Money paise={e.amountPaise} flow="given" size="md" />
                ) : (
                  <span className="text-muted">—</span>
                ),
            },
          ]}
        />
      </div>

      {canAdd && (
        <Button block size="xl" data-testid="roker-add" onClick={() => { reset(); setOpen(true); }}>
          <Plus aria-hidden="true" />
          {t('roker.add')}
        </Button>
      )}

      {/* Add-entry sheet */}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('roker.addTitle')}
        footer={
          <>
            <Button variant="secondary" block onClick={() => setOpen(false)}>
              {t('action.cancel')}
            </Button>
            <Button block onClick={tryConfirm}>
              {t('roker.save')}
            </Button>
          </>
        }
      >
        <div className="mb-4">
          <span className="mb-1.5 block text-base font-medium text-ink">{t('roker.dir')}</span>
          <SegmentedControl<'in' | 'out'>
            label={t('roker.dir')}
            value={dir}
            onChange={setDir}
            className="w-full [&>button]:flex-1"
            options={[
              { value: 'out', label: t('roker.dir.out') },
              { value: 'in', label: t('roker.dir.in') },
            ]}
          />
        </div>

        <div className="mb-4">
          <span className="mb-1.5 block text-base font-medium text-ink">{t('roker.mode')}</span>
          <SegmentedControl<PayMode>
            label={t('roker.mode')}
            value={mode}
            onChange={setMode}
            className="w-full [&>button]:flex-1"
            options={[
              { value: 'cash', label: t('roker.mode.cash') },
              { value: 'upi', label: t('roker.mode.upi') },
            ]}
          />
        </div>

        <Field label={t('roker.head')}>
          {({ id }) => (
            <Select id={id} value={head} onChange={(e) => setHead(e.target.value as RokerHead)}>
              {HEADS.map((h) => (
                <option key={h} value={h}>
                  {t(`roker.head.${h}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t('roker.amount')} required error={err}>
          {({ describedBy, invalid }) => (
            <MoneyInput
              value={amount}
              onChange={setAmount}
              aria-label={t('roker.amount')}
              describedBy={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        <Field label={t('roker.note')} hint={t('common.optional')}>
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>

        {needsPhoto && (
          <PhotoCapture
            value={photoId}
            onChange={setPhotoId}
            required
            label={t('roker.photo')}
            error={photoErr}
          />
        )}
      </Sheet>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={save}
        title={t('roker.confirmTitle')}
        danger={dir === 'out'}
        message={t('roker.confirmMsg', {
          dir: t(`roker.dir.${dir}`),
          mode: t(`roker.mode.${mode}`),
          amount: new Intl.NumberFormat('en-IN').format(Math.round(amount / 100)),
          head: t(`roker.head.${head}`),
        })}
      />
    </section>
  );
}
