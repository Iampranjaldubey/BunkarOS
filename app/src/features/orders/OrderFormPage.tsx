import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { FormGrid } from '../../components/ui/FormGrid';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { OrderP } from '../../db/types';
import { listBuyers, listOrders, nextOrderNo } from '../../domain/masters';
import { rupeesToPaise, formatINR } from '../../domain/money';
import { uuid, todayIST, addDays } from '../../domain/ids';
import { useT } from '../../i18n';
import { BuyerSheet } from './BuyersPage';

export default function OrderFormPage() {
  const { t } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const existing = useMemo(() => (id ? listOrders(recs).find((o) => o.entityId === id) : undefined), [recs, id]);
  const buyers = useMemo(() => listBuyers(recs), [recs]);
  const [buyerId, setBuyerId] = useState(''); const [orderNo, setOrderNo] = useState(''); const [design, setDesign] = useState(''); const [size, setSize] = useState('');
  const [qty, setQty] = useState(''); const [dueDate, setDueDate] = useState(addDays(todayIST(), 30)); const [price, setPrice] = useState(''); const [notes, setNotes] = useState('');
  const [receivedOn, setReceivedOn] = useState(todayIST()); const [buyerOpen, setBuyerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);

  useEffect(() => { if (!existing && !orderNo) setOrderNo(nextOrderNo(recs)); }, [recs, existing, orderNo]);
  useEffect(() => {
    if (!existing) return;
    setBuyerId(existing.buyerId); setOrderNo(existing.orderNo); setDesign(existing.design); setSize(existing.size); setQty(String(existing.qty));
    setDueDate(existing.dueDate); setPrice(existing.pricePaise ? String(existing.pricePaise / 100) : ''); setNotes(existing.notes ?? ''); setReceivedOn(existing.receivedOn);
  }, [existing]);

  const q = Number(qty); const pricePaise = price.trim() ? rupeesToPaise(Number(price)) : undefined;
  const save = async () => {
    const e: Record<string, string> = {};
    if (!buyerId) e.buyer = t('valid.required');
    if (!orderNo.trim()) e.orderNo = t('valid.required');
    if (!design.trim()) e.design = t('valid.required');
    if (!Number.isInteger(q) || q <= 0) e.qty = t('valid.positive');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) e.dueDate = t('valid.date');
    setErrors(e); if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const o: OrderP = { entityId: existing?.entityId ?? uuid(), buyerId, orderNo: orderNo.trim(), design: design.trim(), size: size.trim(), qty: q, dueDate, pricePaise, notes: notes.trim() || undefined, receivedOn };
      await addRecord<OrderP>('order', o);
      toast.show(t('action.done'), 'success');
      navigate(`/orders/${o.entityId}`, { replace: true });
    } finally { setBusy(false); }
  };

  return (
    <section className="mx-auto max-w-2xl">
      <PageHeader title={existing ? t('order.edit') : t('order.new')} back />
      <Card className="md:p-6">
        <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <FormGrid>
            <Field label={t('order.buyer')} required error={errors.buyer} className="lg:col-span-2">
              {({ id, describedBy, invalid }) => (
                <div className="flex gap-2">
                  <Select id={id} value={buyerId} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setBuyerId(e.target.value)} className="flex-1"><option value="">{buyers.length ? '—' : t('order.noBuyer')}</option>{buyers.map((b) => <option key={b.entityId} value={b.entityId}>{b.name}{b.city ? ` · ${b.city}` : ''}</option>)}</Select>
                  <Button type="button" variant="secondary" size="md" onClick={() => setBuyerOpen(true)} aria-label={t('order.newBuyer')}><Plus aria-hidden="true" size={18} /></Button>
                </div>
              )}
            </Field>
            <Field label={t('order.orderNo')} required error={errors.orderNo}>{({ id, describedBy, invalid }) => <Input id={id} value={orderNo} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setOrderNo(e.target.value)} className="num" />}</Field>
            <Field label={t('order.receivedOn')}>{({ id }) => <Input id={id} type="date" value={receivedOn} max={todayIST()} onChange={(e) => setReceivedOn(e.target.value)} className="num" />}</Field>
            <Field label={t('order.design')} required error={errors.design}>{({ id, describedBy, invalid }) => <Input id={id} value={design} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setDesign(e.target.value)} placeholder="Kashan" />}</Field>
            <Field label={t('order.size')}>{({ id }) => <Input id={id} value={size} onChange={(e) => setSize(e.target.value)} placeholder="8x10" />}</Field>
            <Field label={t('order.qty')} required error={errors.qty}>{({ id, describedBy, invalid }) => <Input id={id} inputMode="numeric" value={qty} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} className="num text-xl" />}</Field>
            <Field label={t('order.dueDate')} required error={errors.dueDate}>{({ id }) => <Input id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="num" />}</Field>
            <Field label={t('order.price')} hint={pricePaise && q ? `${t('common.total')}: ${formatINR(pricePaise * q)}` : t('common.optional')}>{({ id }) => <Input id={id} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} className="num" />}</Field>
            <Field label={t('order.notes')} className="lg:col-span-2">{({ id }) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
          </FormGrid>
          <Button type="submit" size="xl" disabled={busy}>{t('action.save')}</Button>
        </form>
      </Card>
      <BuyerSheet open={buyerOpen} onClose={() => setBuyerOpen(false)} onSaved={(b) => setBuyerId(b.entityId)} />
    </section>
  );
}
