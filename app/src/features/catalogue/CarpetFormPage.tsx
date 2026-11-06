import { useMemo, useState } from 'react';
import { usePack } from '../../industries/usePack';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input, Textarea } from '../../components/ui/Input';
import { FormGrid } from '../../components/ui/FormGrid';
import { FormActions } from '../../components/ui/FormActions';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { PhotoList } from '../../components/ui/PhotoList';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { CarpetInP, CarpetMode, CarpetP, Rec, SizeUnit } from '../../db/types';
import { carpetError, listCarpets, MAX_CARPET_PHOTOS, SIZE_UNITS, type CarpetError } from '../../domain/catalogue';
import { parseQty } from '../../domain/qty';
import { rupeesToPaise } from '../../domain/money';
import { uuid } from '../../domain/ids';
import { useCan } from '../../app/useCan';
import { useT } from '../../i18n';

const FIELD_OF: Record<Exclude<CarpetError, ''>, string> = { too_many_photos: 'photos', duplicate_tag: 'tag', tag_required: 'tag', invalid_size: 'size', design_required: 'design', invalid_price: 'price' };
const milliText = (m?: number) => (m ? String(m / 1000) : '');

const paiseText = (p?: number) => (p !== undefined ? String(p / 100) : '');

/** Finds the carpet being edited; the form starts from it (keyed, so a late load starts the form fresh). */
export default function CarpetFormPage() {
  const { id } = useParams();
  const recs = useRecords();
  const existing = useMemo(() => (id ? listCarpets(recs, false).find((c) => c.entityId === id) : undefined), [recs, id]);
  if (id && !existing) return null; // records still loading (or an unknown id)
  return <CarpetForm key={existing?.entityId ?? 'new'} existing={existing} recs={recs} />;
}

function CarpetForm({ existing, recs }: { existing?: CarpetP; recs: Rec[] }) {
  const { t } = useT();
  const pack = usePack(); // SPEC-M18: a new entry starts in the pack's size unit (bags: cm)
  const navigate = useNavigate();
  const toast = useToast();
  const allowed = useCan();
  const canSeePrice = allowed('price.view');
  const designs = useMemo(() => [...new Set(listCarpets(recs).map((c) => c.design))].sort(), [recs]);

  const [photoIds, setPhotoIds] = useState<string[]>(existing?.photoIds ?? []);
  const [design, setDesign] = useState(existing?.design ?? '');
  const [length, setLength] = useState(milliText(existing?.lengthMilli)); const [width, setWidth] = useState(milliText(existing?.widthMilli)); const [unit, setUnit] = useState<SizeUnit>(existing?.sizeUnit ?? pack.sizeUnit);
  const [mode, setMode] = useState<CarpetMode>(existing?.mode ?? 'quantity');
  const [qty, setQty] = useState('1'); const [tag, setTag] = useState(existing?.tag ?? '');
  const [material, setMaterial] = useState(existing?.materialNotes ?? ''); const [cost, setCost] = useState(paiseText(existing?.costPaise)); const [price, setPrice] = useState(paiseText(existing?.pricePaise)); const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);

  const money = (s: string) => (s.trim() ? rupeesToPaise(Number(s)) : undefined);
  const save = async (another: boolean) => {
    const e: Record<string, string> = {};
    const l = parseQty(length) ?? 0; const w = parseQty(width) ?? 0;
    const q = Number(qty);
    const c: CarpetP = {
      entityId: existing?.entityId ?? uuid(), design: design.trim(), lengthMilli: l, widthMilli: w, sizeUnit: unit, mode,
      ...(mode === 'piece' ? { tag: tag.trim() } : {}),
      ...(material.trim() ? { materialNotes: material.trim() } : {}),
      // Without "see prices" the price fields are not sent at all; the server keeps the stored ones (SPEC-M13).
      ...(canSeePrice ? { costPaise: money(cost), pricePaise: money(price) } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      photoIds, active: existing?.active ?? true,
    };
    if (canSeePrice) { if (c.costPaise === undefined) delete c.costPaise; if (c.pricePaise === undefined) delete c.pricePaise; }
    const err = carpetError(recs, c);
    if (err) e[FIELD_OF[err]] = t(`cat.err.${err}`);
    if (!existing && mode === 'quantity' && !(Number.isInteger(q) && q > 0)) e.qty = t('cat.err.invalid_qty');
    if ([cost, price].some((s) => s.trim() && !Number.isFinite(Number(s)))) e.price = t('cat.err.invalid_price');
    setErrors(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await addRecord<CarpetP>('carpet', c, c.photoIds.length ? { photoIds: c.photoIds } : {});
      if (!existing) await addRecord<CarpetInP>('carpet_in', { carpetId: c.entityId, qty: mode === 'piece' ? 1 : q });
      toast.show(t('cat.saved'), 'success');
      if (another) { setPhotoIds([]); setTag(''); setQty('1'); setNotes(''); setCost(''); setPrice(''); setMaterial(''); }
      else navigate(`/catalogue/${c.entityId}`, { replace: true });
    } finally { setBusy(false); }
  };

  return (
    <section className="mx-auto max-w-3xl">
      <PageHeader title={existing ? t('cat.edit') : t('cat.new')} back />
      <Card className="md:p-6">
        <form onSubmit={(ev) => { ev.preventDefault(); void save(false); }} data-testid="carpet-form">
          <PhotoList value={photoIds} onChange={setPhotoIds} max={MAX_CARPET_PHOTOS} label={t('cat.photos', { max: MAX_CARPET_PHOTOS })} hint={t('cat.cover')} error={errors.photos} />
          <FormGrid>
            <Field label={t('cat.design')} required error={errors.design} className="lg:col-span-2">
              {({ id: fid, describedBy, invalid }) => <><Input id={fid} list="carpet-designs" value={design} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(ev) => setDesign(ev.target.value)} placeholder="Kashan 101" />
                <datalist id="carpet-designs">{designs.map((d) => <option key={d} value={d} />)}</datalist></>}
            </Field>
            <Field label={t('cat.length')} required error={errors.size}>{({ id: fid, describedBy, invalid }) => <Input id={fid} inputMode="decimal" value={length} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(ev) => setLength(ev.target.value.replace(/[^\d.]/g, ''))} className="num" />}</Field>
            <Field label={t('cat.width')} required>{({ id: fid }) => <Input id={fid} inputMode="decimal" value={width} onChange={(ev) => setWidth(ev.target.value.replace(/[^\d.]/g, ''))} className="num" />}</Field>
          </FormGrid>
          <div className="mb-4"><p className="mb-1.5 text-sm font-medium text-muted">{t('cat.sizeUnit')}</p>
            <SegmentedControl<SizeUnit> label={t('cat.sizeUnit')} value={unit} onChange={setUnit} options={SIZE_UNITS.map((u) => ({ value: u, label: t(`cat.unit.${u}`) }))} /></div>
          {!existing && (
            <div className="mb-4"><p className="mb-1.5 text-sm font-medium text-muted">{t('cat.mode')}</p>
              <SegmentedControl<CarpetMode> label={t('cat.mode')} value={mode} onChange={setMode} options={[{ value: 'quantity', label: t('cat.mode.quantity') }, { value: 'piece', label: t('cat.mode.piece') }]} /></div>
          )}
          <FormGrid>
            {mode === 'piece'
              ? <Field label={t('cat.tag')} required hint={t('cat.tagHint')} error={errors.tag}>{({ id: fid, describedBy, invalid }) => <Input id={fid} value={tag} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(ev) => setTag(ev.target.value)} className="num" />}</Field>
              : !existing && <Field label={t('cat.qty')} required error={errors.qty}>{({ id: fid, describedBy, invalid }) => <Input id={fid} inputMode="numeric" value={qty} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(ev) => setQty(ev.target.value.replace(/\D/g, ''))} className="num" />}</Field>}
            <Field label={t('cat.material')} className="lg:col-span-2">{({ id: fid }) => <Input id={fid} value={material} onChange={(ev) => setMaterial(ev.target.value)} />}</Field>
            {canSeePrice && <>
              <Field label={t('cat.cost')} hint={t('common.optional')} error={errors.price}>{({ id: fid, describedBy }) => <Input id={fid} inputMode="decimal" value={cost} aria-describedby={describedBy} onChange={(ev) => setCost(ev.target.value.replace(/[^\d.]/g, ''))} className="num" />}</Field>
              <Field label={t('cat.price')} hint={t('common.optional')}>{({ id: fid }) => <Input id={fid} inputMode="decimal" value={price} onChange={(ev) => setPrice(ev.target.value.replace(/[^\d.]/g, ''))} className="num" />}</Field>
            </>}
            <Field label={t('cat.notes')} className="lg:col-span-2">{({ id: fid }) => <Textarea id={fid} rows={2} value={notes} onChange={(ev) => setNotes(ev.target.value)} />}</Field>
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
