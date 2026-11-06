import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { FormActions } from '../../components/ui/FormActions';

import { Card, CardTitle } from '../../components/ui/Card';
import { FormWithContext } from '../../components/ui/FormWithContext';
import { Qty } from './shared';
import { formatDay } from '../../domain/dates';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { FormGrid } from '../../components/ui/FormGrid';
import { PhotoCapture } from '../../components/ui/PhotoCapture';
import { DateField } from '../../components/ui/DateField';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { AdjustReason, FinishedInP, StockAdjustP, StockInP, StockOutP, StockOutPurpose } from '../../db/types';
import { listItems, listWorkers, listOrders, getSettings } from '../../domain/masters';
import { stockBalance, movesFor, type Move } from '../../domain/stock';
import { parseQty, formatQty } from '../../domain/qty';
import { formatINR, rupeesToPaise } from '../../domain/money';
import { isDayLocked } from '../../domain/locks';
import { todayIST } from '../../domain/ids';
import { useT } from '../../i18n';
import { useCan } from '../../app/useCan';

type Kind = 'in' | 'out' | 'adjust' | 'finished';
const REASONS: AdjustReason[] = ['wastage', 'count_correction', 'damage', 'other'];
const PURPOSES: StockOutPurpose[] = ['production', 'sale', 'other'];

/** One screen for stock in / out / adjust / finished-in, chosen by the route. */
export default function StockMovePage() {
  const { t, lang } = useT();
  const { kind = 'in' } = useParams<{ kind: Kind }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const settings = useMemo(() => getSettings(recs), [recs]);
  const items = useMemo(() => listItems(recs).filter((i) => (kind === 'finished' ? i.kind === 'finished' : true)), [recs, kind]);
  const workers = useMemo(() => listWorkers(recs), [recs]);
  const orders = useMemo(() => listOrders(recs), [recs]);
  const [itemId, setItemId] = useState(params.get('item') ?? '');
  const [qty, setQty] = useState(''); const [rate, setRate] = useState(''); const [supplier, setSupplier] = useState('');
  const [purpose, setPurpose] = useState<StockOutPurpose>('production'); const [workerId, setWorkerId] = useState(''); const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState<AdjustReason>('wastage'); const [note, setNote] = useState(''); const [day, setDay] = useState(todayIST());
  const [photoId, setPhotoId] = useState<string | undefined>(); const [errors, setErrors] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const item = items.find((i) => i.entityId === itemId);
  const balance = itemId ? stockBalance(recs, itemId) : 0;
  const parsed = qty.trim() ? parseQty(qty.replace(/^[−-]/, '')) : null;
  const negative = kind === 'adjust' && /^[−-]/.test(qty.trim());
  const signed = parsed === null ? 0 : kind === 'out' || negative ? -parsed : parsed;
  const after = balance + signed;
  const ratePaise = rupeesToPaise(Number(rate) || 0);
  const totalPaise = parsed ? Math.round((parsed / 1000) * ratePaise) : 0;
  const allowed = useCan();
  const canOverride = allowed('record.reverse.any'); // owner
  const takesOut = kind === 'out' || (kind === 'adjust' && negative);
  // SPEC-M16 §4: the server refuses going below zero unless the owner says so explicitly, with a reason.
  const needsOverride = takesOut && parsed !== null && after < 0 && canOverride;
  const override = needsOverride ? { allowNegative: true as const, overrideReason: overrideReason.trim() } : {};
  const photoAlways = kind === 'adjust' && reason === 'wastage';
  const needPhoto = photoAlways || (kind === 'in' && totalPaise > (settings?.photoRequiredAbovePaise ?? 200_000));
  const title = kind === 'in' ? t('stock.in') : kind === 'out' ? t('stock.out') : kind === 'adjust' ? t('stock.adjust') : t('stock.finishedIn');

  const save = async () => {
    const e: Record<string, string> = {};
    if (!itemId) e.item = t('valid.required');
    if (parsed === null || parsed <= 0) e.qty = t('valid.positive');
    if (takesOut && after < 0 && !canOverride) e.qty = t('stock.overIssue', { bal: item ? formatQty(balance, item.unit) : '0' });
    if (needsOverride && !overrideReason.trim()) e.override = t('valid.required');
    if (kind === 'adjust' && !note.trim()) e.note = t('valid.required');
    if (needPhoto && !photoId) e.photo = t('valid.photoRequired');
    if (isDayLocked(recs, day)) e.day = t('valid.locked');
    setErrors(e); if (Object.keys(e).length) return;
    setBusy(true);
    const opts = { day, photoIds: photoId ? [photoId] : undefined };
    try {
      if (kind === 'in') await addRecord<StockInP>('stock_in', { itemId, qty: parsed!, ratePaise: ratePaise || undefined, supplier: supplier.trim() || undefined, note: note.trim() || undefined }, opts);
      else if (kind === 'out') await addRecord<StockOutP>('stock_out', { itemId, qty: parsed!, purpose, workerId: workerId || undefined, orderId: orderId || undefined, note: note.trim() || undefined, ...override }, opts);
      else if (kind === 'adjust') await addRecord<StockAdjustP>('stock_adjust', { itemId, qtyDelta: signed, reason, note: note.trim(), ...override }, opts);
      else await addRecord<FinishedInP>('finished_in', { itemId, qty: parsed!, orderId: orderId || undefined }, opts);
      toast.show(t('stock.saved'), 'success');
      navigate(`/stock/${itemId}`, { replace: true });
    } finally { setBusy(false); }
  };

  const recentMoves = useMemo(() => (itemId ? movesFor(recs, itemId).slice(-5).reverse() : []), [recs, itemId]);
  const moveLabel = (k: Move['kind']) => (k === 'in' ? t('stock.in') : k === 'out' ? t('stock.out') : k === 'adjust' ? t('stock.adjust') : k === 'finished' ? t('stock.finishedIn') : t('stock.kindBadge.delivery'));
  const context = (
    <Card>
      <CardTitle>{t('ctx.item')}</CardTitle>
      {!item ? <p className="text-sm text-muted">{t('ctx.pickItem')}</p> : (
        <>
          <p className="font-medium text-ink">{item.name}</p>
          <div className="my-3 rounded-xl bg-surface-2 p-3">
            <p className="text-sm text-muted">{t('ctx.stockNow')}</p>
            <p className="text-2xl font-medium" data-testid="ctx-stock"><Qty q={balance} item={item} className={item.lowStockQty > 0 && balance <= item.lowStockQty ? 'text-given' : 'text-ink'} /></p>
            {item.lowStockQty > 0 && <p className="mt-1 text-sm text-muted">{t('home.lowLevel')}: {formatQty(item.lowStockQty, item.unit)}</p>}
          </div>
          <p className="mb-1 text-sm font-medium text-muted">{t('ctx.lastMoves')}</p>
          {recentMoves.length === 0 ? <p className="text-sm text-muted">{t('ctx.none')}</p> : (
            <ul className="divide-y divide-line text-sm">
              {recentMoves.map((m) => (
                <li key={m.recId} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate text-muted">{formatDay(m.day, lang, 'short')} · {moveLabel(m.kind)}</span>
                  <span className={`num shrink-0 font-medium ${m.qty < 0 ? 'text-given' : 'text-received'}`}>{m.qty > 0 ? '+' : ''}{formatQty(m.qty, item.unit)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );

  return (
    <FormWithContext context={context}>
      <PageHeader title={title} back />
      <Card className="md:p-6">
        <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <FormGrid>
            <Field label={t('stock.item')} required error={errors.item} className="lg:col-span-2">
              {({ id, describedBy, invalid }) => <Select id={id} value={itemId} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setItemId(e.target.value)}><option value="">—</option>{items.map((i) => <option key={i.entityId} value={i.entityId}>{i.name} ({t(`stock.unit.${i.unit}`)})</option>)}</Select>}
            </Field>
            <Field label={kind === 'adjust' ? t('stock.delta') : t('stock.qty')} required error={errors.qty} hint={item ? `${t('stock.balance')}: ${formatQty(balance, item.unit)} → ${t('stock.balanceAfter')}: ${formatQty(after, item.unit)}${kind === 'adjust' ? ` · ${t('stock.deltaHint')}` : ''}` : undefined}>
              {({ id, describedBy, invalid }) => <Input id={id} inputMode="decimal" value={qty} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setQty(e.target.value.replace(/[^\d.−-]/g, ''))} className={`num text-2xl ${kind === 'out' ? 'text-given' : kind === 'in' || kind === 'finished' ? 'text-received' : ''}`} autoFocus />}
            </Field>
            {kind === 'in' && <Field label={t('stock.rate')} hint={totalPaise ? `${t('stock.total')}: ${formatINR(totalPaise)}` : undefined}>{({ id }) => <Input id={id} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} className="num" />}</Field>}
            {kind === 'in' && <Field label={t('stock.supplier')}>{({ id }) => <Input id={id} value={supplier} onChange={(e) => setSupplier(e.target.value)} />}</Field>}
            {kind === 'out' && <Field label={t('stock.purpose')}>{({ id }) => <Select id={id} value={purpose} onChange={(e) => setPurpose(e.target.value as StockOutPurpose)}>{PURPOSES.map((p) => <option key={p} value={p}>{t(`stock.purpose.${p}`)}</option>)}</Select>}</Field>}
            {kind === 'out' && <Field label={t('stock.worker')}>{({ id }) => <Select id={id} value={workerId} onChange={(e) => setWorkerId(e.target.value)}><option value="">—</option>{workers.map((w) => <option key={w.entityId} value={w.entityId}>{w.name}</option>)}</Select>}</Field>}
            {(kind === 'out' || kind === 'finished') && <Field label={t('stock.order')}>{({ id }) => <Select id={id} value={orderId} onChange={(e) => setOrderId(e.target.value)}><option value="">{t('stock.noOrder')}</option>{orders.map((o) => <option key={o.entityId} value={o.entityId}>{o.orderNo} · {o.design} {o.size}</option>)}</Select>}</Field>}
            {kind === 'adjust' && <Field label={t('stock.reason')}>{({ id }) => <Select id={id} value={reason} onChange={(e) => setReason(e.target.value as AdjustReason)}>{REASONS.map((r) => <option key={r} value={r}>{t(`stock.reason.${r}`)}</option>)}</Select>}</Field>}
            {needsOverride && (
              <Field label={t('stock.overrideReason')} required error={errors.override} hint={t('stock.overrideHint')} className="lg:col-span-2">
                {({ id, describedBy, invalid }) => <Input id={id} value={overrideReason} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setOverrideReason(e.target.value)} data-testid="override-reason" />}
              </Field>
            )}
            <DateField value={day} onChange={setDay} error={errors.day} />
            <Field label={t('common.note')} required={kind === 'adjust'} error={errors.note} className="lg:col-span-2">{({ id, describedBy, invalid }) => <Textarea id={id} rows={2} value={note} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setNote(e.target.value)} />}</Field>
            <div className="lg:col-span-2"><PhotoCapture label={t('common.photo')} required={needPhoto} value={photoId} onChange={setPhotoId} error={errors.photo} /></div>
          </FormGrid>
          <FormActions><Button type="submit" size="xl" disabled={busy} variant={kind === 'out' ? 'danger' : kind === 'adjust' ? 'primary' : 'success'}>{t('action.save')}</Button></FormActions>
        </form>
      </Card>
    </FormWithContext>
  );
}
