import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input, Select } from '../../components/ui/Input';
import { FormGrid } from '../../components/ui/FormGrid';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { ItemKind, ItemP, ItemUnit } from '../../db/types';
import { listItems } from '../../domain/masters';
import { parseQty, formatQty } from '../../domain/qty';
import { uuid } from '../../domain/ids';
import { useT } from '../../i18n';

const UNITS: ItemUnit[] = ['kg', 'pcs', 'litre', 'metre'];

export default function ItemFormPage() {
  const { t } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const existing = useMemo(() => (id ? listItems(recs, false).find((i) => i.entityId === id) : undefined), [recs, id]);
  const [name, setName] = useState(''); const [kind, setKind] = useState<ItemKind>('raw'); const [unit, setUnit] = useState<ItemUnit>('kg'); const [low, setLow] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  useEffect(() => { if (existing) { setName(existing.name); setKind(existing.kind); setUnit(existing.unit); setLow(existing.lowStockQty ? formatQty(existing.lowStockQty, existing.unit) : ''); } }, [existing]);
  useEffect(() => { if (!existing && kind === 'finished') setUnit('pcs'); }, [kind, existing]);

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
          <div className="mb-4"><p className="mb-1.5 text-sm font-medium text-muted">{t('stock.kind')}</p>
            <SegmentedControl<ItemKind> label={t('stock.kind')} value={kind} onChange={setKind} options={[{ value: 'raw', label: t('stock.raw') }, { value: 'finished', label: t('stock.finished') }]} />
            <p className="mt-1 text-sm text-muted">{t(`stock.kind.${kind}`)}</p></div>
          <FormGrid>
            <Field label={t('stock.name')} required error={errors.name} className="lg:col-span-2">{({ id, describedBy, invalid }) => <Input id={id} value={name} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setName(e.target.value)} autoFocus placeholder={kind === 'finished' ? 'Kashan 8x10' : undefined} />}</Field>
            <Field label={t('stock.unit')}>{({ id }) => <Select id={id} value={unit} onChange={(e) => setUnit(e.target.value as ItemUnit)}>{UNITS.map((u) => <option key={u} value={u}>{t(`stock.unit.${u}`)}</option>)}</Select>}</Field>
            <Field label={t('stock.lowQty')} hint={t('stock.lowQtyHint')} error={errors.low}>{({ id, describedBy, invalid }) => <Input id={id} inputMode="decimal" value={low} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setLow(e.target.value.replace(/[^\d.]/g, ''))} className="num" />}</Field>
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
