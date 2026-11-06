import { useEffect, useMemo, useState } from 'react';
import { usePack } from '../../industries/usePack';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { FormActions } from '../../components/ui/FormActions';

import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input, Select } from '../../components/ui/Input';
import { FormGrid } from '../../components/ui/FormGrid';
import { Badge } from '../../components/ui/Badge';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { ItemKind, ItemP, ItemUnit } from '../../db/types';
import { listItems } from '../../domain/masters';
import { parseQty, formatQty } from '../../domain/qty';
import { uuid } from '../../domain/ids';
import { useT } from '../../i18n';


export default function ItemFormPage() {
  const pack = usePack(); // SPEC-M18: units and material suggestions come from the industry pack
  const { t, lang } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const existing = useMemo(() => (id ? listItems(recs, false).find((i) => i.entityId === id) : undefined), [recs, id]);
  // kind is 'finished' only for an existing legacy item (DM-004).
  const [name, setName] = useState(''); const [kind, setKind] = useState<ItemKind>('raw'); const [unit, setUnit] = useState<ItemUnit>(pack.itemUnits[0]); const [low, setLow] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (existing) { setName(existing.name); setKind(existing.kind); setUnit(existing.unit); setLow(existing.lowStockQty ? formatQty(existing.lowStockQty, existing.unit) : ''); } }, [existing]);

  const save = async (another: boolean) => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t('valid.required');
    const lowQ = low.trim() ? parseQty(low) : 0;
    if (lowQ === null) e.low = t('valid.number');
    setErrors(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await addRecord<ItemP>('item', { entityId: existing?.entityId ?? uuid(), name: name.trim(), kind, unit, lowStockQty: lowQ ?? 0, active: existing?.active ?? true });
      toast.show(t('action.done'), 'success');
      if (another) { setName(''); setLow(''); } else navigate(existing ? `/stock/${existing.entityId}` : '/stock', { replace: true });
    } finally { setBusy(false); }
  };

  return (
    <section className="mx-auto max-w-2xl">
      <PageHeader title={existing ? t('stock.editItem') : t('stock.newItem')} back />
      <Card className="md:p-6">
        <form onSubmit={(e) => { e.preventDefault(); void save(false); }}>
          {/* DM-004: new finished carpets go to the catalogue, so the form only makes raw-material items.
              An old finished item keeps its kind and is shown as legacy. */}
          {kind === 'finished'
            ? <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted" data-testid="item-legacy"><Badge tone="neutral">{t('cat.legacy')}</Badge>{t('stock.finished')} · {t('cat.legacyHint')}</p>
            : <p className="mb-4 text-sm text-muted" data-testid="item-kind-raw">{t('stock.kind.raw')} · <Link to="/catalogue/new" className="font-medium text-primary underline-offset-2 hover:underline">{t('cat.new')}</Link></p>}
          <FormGrid>
            <Field label={t('stock.name')} required error={errors.name} className="lg:col-span-2">{({ id, describedBy, invalid }) => <Input id={id} value={name} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setName(e.target.value)} autoFocus list={kind === 'raw' ? 'pack-materials' : undefined} placeholder={kind === 'finished' ? 'Kashan 8x10' : undefined} />}</Field>
            <datalist id="pack-materials">{pack.materials[lang].map((m) => <option key={m} value={m} />)}</datalist>
            <Field label={t('stock.unit')}>{({ id }) => <Select id={id} value={unit} onChange={(e) => setUnit(e.target.value as ItemUnit)}>{[...pack.itemUnits, ...(pack.itemUnits.includes(unit) ? [] : [unit])].map((u) => <option key={u} value={u}>{t(`stock.unit.${u}`)}</option>)}</Select>}</Field>
            <Field label={t('stock.lowQty')} hint={t('stock.lowQtyHint')} error={errors.low}>{({ id, describedBy, invalid }) => <Input id={id} inputMode="decimal" value={low} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setLow(e.target.value.replace(/[^\d.]/g, ''))} className="num" />}</Field>
          </FormGrid>
          <FormActions>
            <Button type="submit" size="lg" disabled={busy} className="md:flex-1">{t('action.save')}</Button>
            {!existing && <Button type="button" variant="secondary" size="lg" disabled={busy} onClick={() => void save(true)} className="md:flex-1">{t('action.saveAdd')}</Button>}
          </FormActions>
        </form>
      </Card>
    </section>
  );
}
