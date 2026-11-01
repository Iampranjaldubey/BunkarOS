import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Truck } from 'lucide-react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import { DateField } from '../../components/ui/DateField';
import { useToast } from '../../components/ui/Toast';
import { addRecord } from '../../db/repo';
import type { CarpetReserveP, DeliveryP, Rec } from '../../db/types';
import { carpetViews, moveError, moveLimits, orderCatalogue, sizeLabel, type MoveError } from '../../domain/catalogue';
import { isDayLocked } from '../../domain/locks';
import { todayIST } from '../../domain/ids';
import { useT } from '../../i18n';

/** SPEC-M15 on the order page: "कैटलॉग से रखें" and "कैटलॉग से डिलीवर करें", plus what the order holds. */
export function OrderCatalogueCard({ recs, orderId, canManage, open }: { recs: Rec[]; orderId: string; canManage: boolean; open: boolean }) {
  const { t } = useT();
  const toast = useToast();
  const today = todayIST();
  const holds = useMemo(() => orderCatalogue(recs, orderId), [recs, orderId]);
  const views = useMemo(() => carpetViews(recs), [recs]);
  const [mode, setMode] = useState<'reserve' | 'deliver' | null>(null);
  const [carpetId, setCarpetId] = useState(''); const [qty, setQty] = useState('1'); const [day, setDay] = useState(today); const [note, setNote] = useState(''); const [err, setErr] = useState('');
  const byId = new Map(views.map((v) => [v.carpet.entityId, v]));
  const held = new Map(holds.map((h) => [h.carpetId, h]));
  // Reserve: carpets in stock. Deliver: carpets reserved for this order first, then carpets in stock.
  const choices = views.filter((v) => (mode === 'deliver' ? (held.get(v.carpet.entityId)?.reserved ?? 0) + v.counts.inStock > 0 : v.counts.inStock > 0))
    .sort((a, b) => (held.get(b.carpet.entityId)?.reserved ?? 0) - (held.get(a.carpet.entityId)?.reserved ?? 0));
  if (views.length === 0 && holds.length === 0) return null;

  const start = (m: 'reserve' | 'deliver') => {
    setMode(m); setErr(''); setQty('1'); setDay(today); setNote('');
    const first = views.find((v) => (m === 'deliver' ? (held.get(v.carpet.entityId)?.reserved ?? 0) > 0 : false)) ?? views.find((v) => v.counts.inStock > 0);
    setCarpetId(first?.carpet.entityId ?? '');
  };
  const limits = carpetId ? moveLimits(recs, carpetId, orderId) : undefined;
  const errText = (e: MoveError) => {
    if (e === 'insufficient_stock') return t('cat.err.insufficient_stock', { n: mode === 'deliver' ? (limits?.reservedForOrder ?? 0) + (limits?.inStock ?? 0) : limits?.inStock ?? 0 });
    if (e === 'exceeds_order') return t('cat.err.exceeds_order', { n: mode === 'deliver' ? limits?.orderPending ?? 0 : limits?.orderNeed ?? 0 });
    return e ? t(`cat.err.${e}`) : '';
  };
  const save = async () => {
    if (!mode) return;
    const q = Number(qty);
    const e = moveError(recs, mode === 'reserve' ? 'carpet_reserve' : 'delivery', { carpetId: carpetId || undefined, orderId, qty: q });
    if (e) { setErr(errText(e)); return; }
    const d = mode === 'deliver' ? day : today;
    if (isDayLocked(recs, d)) { setErr(t('cat.err.locked')); return; }
    if (mode === 'reserve') await addRecord<CarpetReserveP>('carpet_reserve', { carpetId, orderId, qty: q });
    else await addRecord<DeliveryP>('delivery', { orderId, qty: q, carpetId, ...(note.trim() ? { note: note.trim() } : {}) }, { day: d });
    setMode(null); toast.show(t('action.done'), 'success');
  };

  return (
    <Card data-testid="order-catalogue">
      <CardTitle>{t('cat.fromCatalogue')}</CardTitle>
      {holds.length > 0 && (
        <ul className="mb-3 divide-y divide-line">
          {holds.map((h) => {
            const v = byId.get(h.carpetId);
            return <li key={h.carpetId} className="py-1.5 text-sm"><Link to={`/catalogue/${h.carpetId}`} className="font-medium text-primary underline-offset-2 hover:underline">{v ? `${v.carpet.design}${v.carpet.tag ? ` · ${v.carpet.tag}` : ''}` : h.carpetId}</Link>
              <span className="text-muted"> · {t('cat.orderHolds', { res: h.reserved, del: h.delivered })}</span></li>;
          })}
        </ul>
      )}
      {canManage && open && (
        <div className="flex flex-col gap-2">
          <Button size="md" variant="secondary" onClick={() => start('reserve')}><Bookmark aria-hidden="true" size={16} />{t('cat.orderReserve')}</Button>
          <Button size="md" variant="secondary" onClick={() => start('deliver')}><Truck aria-hidden="true" size={16} />{t('cat.orderDeliver')}</Button>
        </div>
      )}
      <Sheet open={Boolean(mode)} onClose={() => setMode(null)} title={mode === 'reserve' ? t('cat.orderReserve') : t('cat.orderDeliver')}
        footer={<Button block onClick={() => void save()} data-testid="order-cat-save">{mode === 'reserve' ? t('cat.reserve') : t('cat.deliver')}</Button>}>
        <Field label={t('cat.pickCarpet')} required>{({ id }) => (
          <Select id={id} value={carpetId} onChange={(e) => { setCarpetId(e.target.value); setErr(''); }} data-testid="order-cat-carpet">
            <option value="">{t('cat.pickCarpet')}</option>
            {choices.map((v) => {
              const res = held.get(v.carpet.entityId)?.reserved ?? 0;
              const name = `${v.carpet.design}${v.carpet.tag ? ` · ${v.carpet.tag}` : ''}`;
              return <option key={v.carpet.entityId} value={v.carpet.entityId}>{res ? t('cat.carpetOptionRes', { name, size: sizeLabel(v.carpet), stock: v.counts.inStock, res }) : t('cat.carpetOption', { name, size: sizeLabel(v.carpet), stock: v.counts.inStock })}</option>;
            })}
          </Select>)}
        </Field>
        {mode === 'reserve' && limits && <p className="mb-3 text-sm text-muted">{t('cat.orderNeeds', { n: limits.orderNeed })}</p>}
        <Field label={t('cat.qty')} required hint={limits ? t('cat.max', { n: Math.max(0, mode === 'reserve' ? limits.reserveMax : limits.deliverMax) }) : undefined} error={err}>
          {({ id, describedBy, invalid }) => <Input id={id} inputMode="numeric" value={qty} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => { setQty(e.target.value.replace(/\D/g, '')); setErr(''); }} className="num text-2xl" data-testid="order-cat-qty" />}
        </Field>
        {mode === 'deliver' && <><DateField value={day} onChange={setDay} /><Field label={t('common.note')}>{({ id }) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field></>}
      </Sheet>
    </Card>
  );
}
