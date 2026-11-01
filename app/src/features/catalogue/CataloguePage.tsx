import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Images, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input, Select } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import { EmptyState } from '../../components/ui/Feedback';
import { useIsDesktop } from '../../components/ui/useIsDesktop';
import { useRecords } from '../../db/hooks';
import { carpetViews, filterCarpets, filterOptions, sizeLabel, CARPET_STATUSES, DEFAULT_STATUS_FILTER, type CarpetFilter, type CarpetStatus, type CarpetView } from '../../domain/catalogue';
import { formatINR, rupeesToPaise } from '../../domain/money';
import { useCan } from '../../app/useCan';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';
import { CarpetPhoto, StatusChips } from './shared';

/** SPEC-M15 /catalogue: photo grid of finished carpets with search and filters. */
export default function CataloguePage() {
  const { t } = useT();
  const navigate = useNavigate();
  const recs = useRecords();
  const isDesktop = useIsDesktop();
  const allowed = useCan();
  const canManage = allowed('carpet.manage');
  const canSeePrice = allowed('price.view');
  const views = useMemo(() => carpetViews(recs), [recs]);
  const opts = useMemo(() => filterOptions(views), [views]);
  const [q, setQ] = useState('');
  const [design, setDesign] = useState('');
  const [size, setSize] = useState('');
  const [statuses, setStatuses] = useState<CarpetStatus[]>(DEFAULT_STATUS_FILTER);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sheet, setSheet] = useState(false);

  const filter: CarpetFilter = {
    q, design: design || undefined, size: size || undefined, statuses,
    minPricePaise: canSeePrice && minPrice ? rupeesToPaise(Number(minPrice)) : undefined,
    maxPricePaise: canSeePrice && maxPrice ? rupeesToPaise(Number(maxPrice)) : undefined,
  };
  const shown = filterCarpets(views, filter);
  const isDefault = !q && !design && !size && !minPrice && !maxPrice && statuses.length === DEFAULT_STATUS_FILTER.length && DEFAULT_STATUS_FILTER.every((s) => statuses.includes(s));
  const clear = () => { setQ(''); setDesign(''); setSize(''); setMinPrice(''); setMaxPrice(''); setStatuses(DEFAULT_STATUS_FILTER); };
  const toggle = (s: CarpetStatus) => setStatuses(statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s]);

  const filters = (
    <div data-testid="catalogue-filters">
      <Field label={t('cat.design')}>{({ id }) => <Select id={id} value={design} onChange={(e) => setDesign(e.target.value)} data-testid="filter-design"><option value="">{t('cat.anyDesign')}</option>{opts.designs.map((d) => <option key={d} value={d}>{d}</option>)}</Select>}</Field>
      <Field label={t('cat.size')}>{({ id }) => <Select id={id} value={size} onChange={(e) => setSize(e.target.value)} data-testid="filter-size"><option value="">{t('cat.anySize')}</option>{opts.sizes.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>}</Field>
      <fieldset className="mb-4">
        <legend className="mb-1.5 text-base font-medium text-ink">{t('cat.statusFilter')}</legend>
        <div className="flex flex-col gap-1">
          {CARPET_STATUSES.map((s) => (
            <label key={s} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
              <input type="checkbox" checked={statuses.includes(s)} onChange={() => toggle(s)} className="h-5 w-5 accent-[var(--color-primary)]" data-testid={`filter-status-${s}`} />
              <span className="text-ink">{t(`cat.st.${s}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {canSeePrice && (
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('cat.priceMin')}>{({ id }) => <Input id={id} inputMode="decimal" value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/[^\d.]/g, ''))} className="num" data-testid="filter-price-min" />}</Field>
          <Field label={t('cat.priceMax')}>{({ id }) => <Input id={id} inputMode="decimal" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d.]/g, ''))} className="num" data-testid="filter-price-max" />}</Field>
        </div>
      )}
      {!isDefault && <Button variant="ghost" block onClick={clear}><X aria-hidden="true" size={16} />{t('cat.clearFilters')}</Button>}
    </div>
  );

  const card = (v: CarpetView) => (
    <li key={v.carpet.entityId}>
      <Link to={`/catalogue/${v.carpet.entityId}`} className="card-hover flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card" data-testid="carpet-card" data-carpet={v.carpet.entityId}>
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg"><CarpetPhoto id={v.carpet.photoIds[0]} alt={v.carpet.design} /></div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="truncate font-medium text-ink" title={v.carpet.design}>{v.carpet.design}</p>
          <p className="num text-sm text-muted">{sizeLabel(v.carpet)}{v.carpet.tag ? ` · ${v.carpet.tag}` : ''}</p>
          <StatusChips v={v} />
          {canSeePrice && v.carpet.pricePaise !== undefined && <p className="num mt-auto pt-1 font-bold text-ink" data-testid="carpet-price">{formatINR(v.carpet.pricePaise)}</p>}
        </div>
      </Link>
    </li>
  );

  return (
    <section>
      <PageHeader title={t('cat.title')} right={canManage && <Button size="md" onClick={() => navigate('/catalogue/new')}><Plus aria-hidden="true" size={18} />{t('cat.new')}</Button>} />
      {views.length === 0 ? (
        <EmptyState icon={<Images size={40} />} title={t('cat.empty')} hint={t('cat.emptyHint')} action={canManage && <Button onClick={() => navigate('/catalogue/new')}>{t('cat.new')}</Button>} />
      ) : (
        <div className={cn(isDesktop && 'grid grid-cols-[16rem_minmax(0,1fr)] gap-6')}>
          {isDesktop && <aside className="self-start rounded-2xl border border-line bg-surface p-4 shadow-card lg:sticky lg:top-20"><h2 className="mb-3 text-lg">{t('cat.filters')}</h2>{filters}</aside>}
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input type="search" aria-label={t('cat.search')} placeholder={t('cat.search')} value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" data-testid="catalogue-search" />
              </div>
              {!isDesktop && <Button variant="secondary" size="md" onClick={() => setSheet(true)} aria-label={t('cat.filters')} data-testid="open-filters"><SlidersHorizontal aria-hidden="true" size={18} />{!isDefault && <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />}</Button>}
            </div>
            <p className="num mb-3 text-sm text-muted" data-testid="catalogue-count">{t('cat.shown', { n: shown.length })}</p>
            {shown.length === 0
              ? <EmptyState title={t('cat.noMatch')} action={<Button variant="secondary" onClick={clear}>{t('cat.clearFilters')}</Button>} />
              : <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" data-testid="catalogue-grid">{shown.map(card)}</ul>}
          </div>
        </div>
      )}
      {!isDesktop && <Sheet open={sheet} onClose={() => setSheet(false)} title={t('cat.filters')} footer={<Button block onClick={() => setSheet(false)}>{t('cat.shown', { n: shown.length })}</Button>}>{filters}</Sheet>}
    </section>
  );
}
