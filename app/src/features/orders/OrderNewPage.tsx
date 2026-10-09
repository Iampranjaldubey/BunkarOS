import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Minus, Plus } from 'lucide-react';
import { Button, Field, Input, FtInInput, FormGrid, useToast } from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import { latestEntities } from '../../domain/projections';
import type { OrderP, RateP } from '../../db/types';
import { uuid } from '../../domain/ids';
import { useT } from '../../i18n';

export default function OrderNewPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();

  // Quality datalist sourced from existing rate cards.
  const qualities = useMemo(() => {
    const rates = latestEntities<RateP>(recs, 'rate');
    return [...new Set(rates.map((r) => r.quality))];
  }, [recs]);

  const [exporter, setExporter] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [design, setDesign] = useState('');
  const [quality, setQuality] = useState('');
  const [colour, setColour] = useState('');
  const [lengthIn, setLengthIn] = useState(0);
  const [widthIn, setWidthIn] = useState(0);
  const [count, setCount] = useState(1);
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const errExporter = touched && !exporter.trim() ? t('valid.required') : undefined;
  const errOrderNo = touched && !orderNo.trim() ? t('valid.required') : undefined;
  const errQuality = touched && !quality.trim() ? t('valid.required') : undefined;
  const errLength = touched && lengthIn <= 0 ? t('masters.valid.width') : undefined;
  const errWidth = touched && widthIn <= 0 ? t('masters.valid.width') : undefined;
  const errCount = touched && (count < 1 || count > 200) ? t('masters.valid.count') : undefined;
  const valid =
    exporter.trim() && orderNo.trim() && quality.trim() && lengthIn > 0 && widthIn > 0 && count >= 1 && count <= 200;

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      const no = orderNo.trim();
      const pieces = Array.from({ length: count }, (_, i) => ({
        pieceId: `${no}/${String(i + 1).padStart(2, '0')}`,
        seq: i + 1,
      }));
      const payload: OrderP = {
        entityId: uuid(),
        orderNo: no,
        exporter: exporter.trim(),
        design: design.trim(),
        quality: quality.trim(),
        colour: colour.trim(),
        lengthIn,
        widthIn,
        count,
        dueDate: dueDate || undefined,
        pieces,
      };
      const rec = await addRecord<OrderP>('order', payload);
      toast.show(t('order.saved', { n: count }), 'success');
      navigate(`/orders/${rec.payload.entityId}`, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <PageHeader title={t('route.orderNew')} back />

      <FormGrid>
        <Field label={t('order.field.exporter')} required error={errExporter}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={exporter} onChange={(e) => setExporter(e.target.value)} />
          )}
        </Field>

        <Field label={t('order.field.orderNo')} required error={errOrderNo}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="EX-118" />
          )}
        </Field>

        <Field label={t('order.field.design')}>
          {({ id, describedBy }) => (
            <Input id={id} aria-describedby={describedBy} value={design} onChange={(e) => setDesign(e.target.value)} />
          )}
        </Field>

        <Field label={t('order.field.quality')} required error={errQuality}>
          {({ id, describedBy, invalid }) => (
            <>
              <Input
                id={id}
                list="order-qualities"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
              />
              <datalist id="order-qualities">
                {qualities.map((qlt) => (
                  <option key={qlt} value={qlt} />
                ))}
              </datalist>
            </>
          )}
        </Field>

        <Field label={t('order.field.colour')}>
          {({ id, describedBy }) => (
            <Input id={id} aria-describedby={describedBy} value={colour} onChange={(e) => setColour(e.target.value)} />
          )}
        </Field>

        <Field label={t('order.field.due')}>
          {({ id, describedBy }) => (
            <Input id={id} type="date" aria-describedby={describedBy} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          )}
        </Field>

        <Field label={t('order.field.size')} required error={errLength || errWidth} className="lg:col-span-2">
          {({ describedBy, invalid }) => (
            <div className="flex items-center gap-2">
              <FtInInput value={lengthIn} onChange={setLengthIn} describedBy={describedBy} invalid={invalid} className="flex-1" />
              <span className="pt-2 text-xl text-muted" aria-hidden="true">×</span>
              <FtInInput value={widthIn} onChange={setWidthIn} describedBy={describedBy} invalid={invalid} className="flex-1" />
            </div>
          )}
        </Field>

        <Field label={t('order.field.count')} hint={t('order.field.count.hint')} required error={errCount} className="lg:col-span-2">
          {({ id, describedBy, invalid }) => (
            <div className="flex items-center gap-3">
              <Button type="button" size="md" variant="secondary" aria-label="−1" onClick={() => setCount((c) => Math.max(1, c - 1))}>
                <Minus aria-hidden="true" size={20} />
              </Button>
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={count}
                onChange={(e) => setCount(Math.max(0, Math.min(200, Math.round(Number(e.target.value) || 0))))}
                className="w-20 text-center text-2xl font-bold"
              />
              <Button type="button" size="md" variant="secondary" aria-label="+1" onClick={() => setCount((c) => Math.min(200, c + 1))}>
                <Plus aria-hidden="true" size={20} />
              </Button>
              <span className="text-sm text-muted">{t('order.piecesWillBe', { n: count || 0 })}</span>
            </div>
          )}
        </Field>

        <div className="lg:col-span-2">
          <Button size="xl" onClick={save} disabled={saving || (touched && !valid)} className="lg:w-auto">
            <Check aria-hidden="true" size={22} />
            {t('order.save')}
          </Button>
        </div>
      </FormGrid>
    </section>
  );
}
