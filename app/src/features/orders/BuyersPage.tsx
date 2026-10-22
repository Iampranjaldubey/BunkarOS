import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import { EmptyState } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { BuyerP } from '../../db/types';
import { listBuyers, listOrders } from '../../domain/masters';
import { uuid } from '../../domain/ids';
import { useT } from '../../i18n';

/** Buyer list + add/edit sheet. Exported `BuyerSheet` is reused by the order form. */
export function BuyerSheet({ open, onClose, existing, onSaved }: { open: boolean; onClose: () => void; existing?: BuyerP; onSaved?: (b: BuyerP) => void }) {
  const { t } = useT();
  const toast = useToast();
  const [name, setName] = useState(existing?.name ?? ''); const [phone, setPhone] = useState(existing?.phone ?? ''); const [city, setCity] = useState(existing?.city ?? '');
  const [err, setErr] = useState('');
  const save = async () => {
    if (!name.trim()) { setErr(t('valid.required')); return; }
    const b: BuyerP = { entityId: existing?.entityId ?? uuid(), name: name.trim(), phone: phone.trim() || undefined, city: city.trim() || undefined, active: existing?.active ?? true };
    await addRecord<BuyerP>('buyer', b);
    toast.show(t('action.done'), 'success'); onSaved?.(b); onClose(); if (!existing) { setName(''); setPhone(''); setCity(''); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={existing ? t('action.edit') : t('order.newBuyer')} footer={<Button block onClick={() => void save()}>{t('action.save')}</Button>}>
      <Field label={t('buyer.name')} required error={err}>{({ id }) => <Input id={id} value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} autoFocus />}</Field>
      <Field label={t('buyer.phone')}>{({ id }) => <Input id={id} type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
      <Field label={t('buyer.city')}>{({ id }) => <Input id={id} value={city} onChange={(e) => setCity(e.target.value)} />}</Field>
    </Sheet>
  );
}

export default function BuyersPage() {
  const { t } = useT();
  const recs = useRecords();
  const [open, setOpen] = useState(false); const [edit, setEdit] = useState<BuyerP | undefined>();
  const buyers = useMemo(() => listBuyers(recs), [recs]);
  const orderCount = useMemo(() => { const m = new Map<string, number>(); for (const o of listOrders(recs)) m.set(o.buyerId, (m.get(o.buyerId) ?? 0) + 1); return m; }, [recs]);
  return (
    <section className="mx-auto max-w-2xl">
      <PageHeader title={t('buyer.title')} back right={<Button size="md" onClick={() => { setEdit(undefined); setOpen(true); }}><Plus aria-hidden="true" size={18} />{t('action.add')}</Button>} />
      {buyers.length === 0 ? <EmptyState title={t('buyer.empty')} action={<Button onClick={() => setOpen(true)}>{t('order.newBuyer')}</Button>} /> : (
        <Card className="divide-y divide-line p-0">
          {buyers.map((b) => (
            <button key={b.entityId} type="button" onClick={() => { setEdit(b); setOpen(true); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
              <div className="min-w-0 flex-1"><p className="font-medium text-ink">{b.name}</p><p className="text-sm text-muted">{[b.city, b.phone].filter(Boolean).join(' · ')}</p></div>
              <span className="num text-sm text-muted">{t('buyer.orders', { n: orderCount.get(b.entityId) ?? 0 })}</span>
            </button>
          ))}
        </Card>
      )}
      <BuyerSheet key={edit?.entityId ?? 'new'} open={open} onClose={() => setOpen(false)} existing={edit} />
    </section>
  );
}
