import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ban, Bookmark, PackagePlus, Pencil, ShoppingBag, Truck, Undo2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import { PageGrid } from '../../components/ui/PageGrid';
import { DateField } from '../../components/ui/DateField';
import { PhotoCapture } from '../../components/ui/PhotoCapture';
import { EmptyState, StatTile, StatRow } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord, reverse } from '../../db/repo';
import type { CarpetInP, CarpetOutKind, CarpetOutP, CarpetReserveP, DeliveryP, Rec } from '../../db/types';
import { carpetHistory, carpetView, moveError, moveLimits, sizeLabel, type MoveError } from '../../domain/catalogue';
import { orderViews } from '../../domain/orders';
import { nameMaps } from '../../domain/masters';
import { isDayLocked, isRecordLocked, lockedMonths } from '../../domain/locks';
import { formatINR } from '../../domain/money';
import { formatDay } from '../../domain/dates';
import { todayIST } from '../../domain/ids';
import { useCan } from '../../app/useCan';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { CarpetPhoto, StatusChips } from './shared';

type Move = 'in' | 'reserve' | 'deliver' | 'sold' | 'written_off';

export default function CarpetDetailPage() {
  const { t, lang } = useT();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const { user } = useSession();
  const allowed = useCan();
  const today = todayIST();
  const v = useMemo(() => carpetView(recs, id), [recs, id]);
  const history = useMemo(() => carpetHistory(recs, id), [recs, id]);
  const names = useMemo(() => nameMaps(recs), [recs]);
  const openOrders = useMemo(() => orderViews(recs, today).filter((o) => o.pendingQty > 0), [recs, today]);
  const locked = useMemo(() => lockedMonths(recs), [recs]);
  const [move, setMove] = useState<Move | null>(null);
  const [orderId, setOrderId] = useState(''); const [qty, setQty] = useState('1'); const [day, setDay] = useState(today); const [note, setNote] = useState(''); const [photo, setPhoto] = useState<string | undefined>();
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<{ rec: Rec; title: string } | null>(null); const [reason, setReason] = useState('');
  const [photoIdx, setPhotoIdx] = useState(0);
  if (!v) return <EmptyState title={t('common.empty')} />;
  const c = v.carpet;
  const canMove = allowed('carpet.manage');
  const canSeePrice = allowed('price.view');
  const orderLabel = (oid?: string) => { const o = oid ? names.orders.get(oid) : undefined; return o ? `${o.orderNo} · ${o.design} ${o.size}` : '—'; };
  const orderNo = (oid?: string) => (oid ? names.orders.get(oid)?.orderNo ?? '—' : '—');

  // Same rule as the entry log: owner anything; operators their own entries of today, or past ones with "edit past entries".
  const canUndo = (r: Rec) => {
    if (isRecordLocked(locked, r)) return false;
    if (allowed('record.reverse.any')) return true;
    if (allowed('record.reverse.ownToday') && r.by === user?.id && r.day === today) return true;
    return allowed('record.reverse.past') && r.day < today;
  };

  const open = (m: Move) => {
    setMove(m); setErr(''); setNote(''); setPhoto(undefined); setDay(today);
    const reservedOrders = v.reservations.filter((r) => r.reserved > 0).map((r) => r.orderId);
    const firstOrder = m === 'deliver' ? (reservedOrders[0] ?? openOrders[0]?.order.entityId ?? '') : m === 'reserve' ? (openOrders[0]?.order.entityId ?? '') : '';
    setOrderId(firstOrder); setQty('1');
  };
  const limits = moveLimits(recs, id, orderId || undefined);
  const errText = (e: MoveError) => {
    if (e === 'insufficient_stock') return t('cat.err.insufficient_stock', { n: move === 'deliver' ? limits.reservedForOrder + limits.inStock : limits.inStock });
    if (e === 'exceeds_order') return t('cat.err.exceeds_order', { n: move === 'deliver' ? limits.orderPending : limits.orderNeed });
    return e ? t(`cat.err.${e}`) : '';
  };
  const submit = async () => {
    if (!move) return;
    const q = Number(qty);
    const type = move === 'in' ? 'carpet_in' : move === 'reserve' ? 'carpet_reserve' : move === 'deliver' ? 'delivery' : 'carpet_out';
    const e = moveError(recs, type, { carpetId: id, orderId: orderId || undefined, qty: q, note });
    if (e) { setErr(errText(e)); return; }
    if (isDayLocked(recs, day)) { setErr(t('cat.err.locked')); return; }
    setBusy(true);
    try {
      if (move === 'in') await addRecord<CarpetInP>('carpet_in', { carpetId: id, qty: q }, { day });
      else if (move === 'reserve') await addRecord<CarpetReserveP>('carpet_reserve', { carpetId: id, orderId, qty: q }, { day });
      else if (move === 'deliver') await addRecord<DeliveryP>('delivery', { orderId, qty: q, carpetId: id, ...(note.trim() ? { note: note.trim() } : {}) }, { day });
      else await addRecord<CarpetOutP>('carpet_out', { carpetId: id, qty: q, kind: move as CarpetOutKind, note: note.trim() }, { day, ...(photo ? { photoIds: [photo] } : {}) });
      setMove(null); toast.show(t('action.done'), 'success');
    } finally { setBusy(false); }
  };
  const doUndo = async () => {
    if (!undo || !reason.trim()) return;
    await reverse(undo.rec.id, reason.trim());
    setUndo(null); setReason(''); toast.show(t('action.done'), 'success');
  };

  const titles: Record<Move, string> = { in: t('cat.addMore'), reserve: t('cat.reserve'), deliver: t('cat.deliver'), sold: t('cat.sell'), written_off: t('cat.writeOff') };
  const needsOrder = move === 'reserve' || move === 'deliver';
  const max = move === 'reserve' ? limits.reserveMax : move === 'deliver' ? limits.deliverMax : move === 'in' ? undefined : limits.inStock;
  const pieceAdded = c.mode === 'piece';

  const evText = (e: ReturnType<typeof carpetHistory>[number]) =>
    e.kind === 'in' ? t('cat.ev.in', { n: e.qty }) : e.kind === 'reserve' ? t('cat.ev.reserve', { n: e.qty, order: orderNo(e.orderId) })
      : e.kind === 'deliver' ? t('cat.ev.deliver', { n: e.qty, order: orderNo(e.orderId) }) : t(`cat.ev.${e.kind}`, { n: e.qty });

  return (
    <section>
      <PageHeader title={`${c.design}${c.tag ? ` · ${c.tag}` : ''}`} back={() => navigate('/catalogue')}
        right={canMove && <Button size="md" variant="secondary" onClick={() => navigate(`/catalogue/${id}/edit`)}><Pencil aria-hidden="true" size={16} />{t('action.edit')}</Button>} />
      <PageGrid asideSticky aside={
        <div className="flex flex-col gap-3">
          <Card>
            <StatusChips v={v} className="mb-2" />
            <p className="num text-lg text-ink" data-testid="carpet-size">{sizeLabel(c)}</p>
            {c.materialNotes && <p className="text-sm text-ink">{c.materialNotes}</p>}
            {c.notes && <p className="mt-1 text-sm text-muted">{c.notes}</p>}
            {canSeePrice && (c.costPaise !== undefined || c.pricePaise !== undefined) && (
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm" data-testid="carpet-prices">
                {c.costPaise !== undefined && <div><dt className="text-muted">{t('cat.cost')}</dt><dd className="num font-medium text-ink">{formatINR(c.costPaise)}</dd></div>}
                {c.pricePaise !== undefined && <div><dt className="text-muted">{t('cat.price')}</dt><dd className="num font-medium text-ink">{formatINR(c.pricePaise)}</dd></div>}
              </dl>
            )}
          </Card>
          <StatRow className="grid-cols-3">
            <StatTile label={t('cat.st.in_stock')} tone="received" value={<span className="num">{v.counts.inStock}</span>} testid="count-in-stock" />
            <StatTile label={t('cat.st.reserved')} tone="neutral" value={<span className="num">{v.counts.reserved}</span>} testid="count-reserved" />
            <StatTile label={t('cat.st.delivered')} tone="neutral" value={<span className="num">{v.counts.delivered}</span>} testid="count-delivered" />
            <StatTile label={t('cat.st.sold')} tone="neutral" value={<span className="num">{v.counts.sold}</span>} testid="count-sold" />
            <StatTile label={t('cat.st.written_off')} tone="neutral" value={<span className="num">{v.counts.writtenOff}</span>} testid="count-written-off" />
            <StatTile label={t('cat.added')} tone="neutral" value={<span className="num">{v.counts.added}</span>} testid="count-added" />
          </StatRow>
          {canMove && (
            <div className="grid grid-cols-2 gap-2">
              <Button size="md" onClick={() => open('reserve')} disabled={v.counts.inStock <= 0}><Bookmark aria-hidden="true" size={16} />{t('cat.reserve')}</Button>
              <Button size="md" variant="secondary" onClick={() => open('deliver')} disabled={v.counts.inStock + v.counts.reserved <= 0}><Truck aria-hidden="true" size={16} />{t('cat.deliver')}</Button>
              <Button size="md" variant="secondary" onClick={() => open('sold')} disabled={v.counts.inStock <= 0}><ShoppingBag aria-hidden="true" size={16} />{t('cat.sell')}</Button>
              <Button size="md" variant="secondary" onClick={() => open('written_off')} disabled={v.counts.inStock <= 0}><Ban aria-hidden="true" size={16} />{t('cat.writeOff')}</Button>
              {!pieceAdded && <Button size="md" variant="ghost" className="col-span-2" onClick={() => open('in')}><PackagePlus aria-hidden="true" size={16} />{t('cat.addMore')}</Button>}
            </div>
          )}
        </div>
      } main={
        <div className="flex flex-col gap-4">
          <Card className="p-0">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-surface-2">
              <CarpetPhoto id={c.photoIds[photoIdx] ?? c.photoIds[0]} alt={c.design} design={c.design} length={c.lengthMilli} width={c.widthMilli} seed={c.entityId} />
            </div>
            {c.photoIds.length === 0 && <p className="px-4 py-2.5 text-sm text-muted">{t('m17.drawn')}</p>}
            {c.photoIds.length > 1 && (
              <ul className="flex gap-2 p-3" aria-label={t('common.photo')}>
                {c.photoIds.map((p, i) => (
                  <li key={p}><button type="button" onClick={() => setPhotoIdx(i)} aria-label={t('cat.photoN', { n: i + 1 })} aria-pressed={i === photoIdx}
                    className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition-colors ${i === photoIdx ? 'border-primary' : 'border-line hover:border-line-strong'}`}><CarpetPhoto id={p} alt="" /></button></li>
                ))}
              </ul>
            )}
          </Card>
          {v.reservations.some((r) => r.reserved > 0) && (
            <Card data-testid="carpet-reservations">
              <CardTitle>{t('cat.reservations')}</CardTitle>
              <ul className="divide-y divide-line">
                {v.reservations.filter((r) => r.reserved > 0).map((r) => (
                  <li key={r.orderId} className="py-2">
                    <p className="text-ink"><span className="num font-medium">{r.reserved}</span> · {orderLabel(r.orderId)}</p>
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {r.records.filter((x) => canUndo(x)).map((x) => (
                        <li key={x.id}><Button size="md" variant="secondary" onClick={() => setUndo({ rec: x, title: t('cat.releaseOf', { n: Math.min(x.payload.qty, r.reserved), order: orderNo(r.orderId) }) })}>
                          <Undo2 aria-hidden="true" size={16} />{t('cat.releaseOf', { n: Math.min(x.payload.qty, r.reserved), order: orderNo(r.orderId) })}</Button></li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardTitle>{t('cat.history')}</CardTitle>
            {history.length === 0 ? <p className="text-sm text-muted">{t('common.empty')}</p> : (
              <ol className="divide-y divide-line" data-testid="carpet-history">
                {history.map((e) => (
                  <li key={e.rec.id} className="flex items-start gap-3 py-2" data-testid="carpet-event">
                    <div className="min-w-0 flex-1">
                      <p className={e.reversal ? 'text-muted line-through' : 'text-ink'}>{evText(e)}{e.note ? ` · ${e.note}` : ''}</p>
                      {e.reversal && <p className="text-sm text-muted">{t('cat.ev.reversed', { reason: e.reversal.payload.reason })}</p>}
                      <p className="text-sm text-muted">{formatDay(e.rec.day, lang, 'short')} · {names.users.get(e.rec.by) ?? ''}{e.rec.sync === 'pending' ? ' · …' : ''}</p>
                    </div>
                    {!e.reversal && e.kind !== 'reserve' && canUndo(e.rec) && !(e.kind === 'in' && v.counts.inStock < e.qty) && ( /* the server refuses taking back carpets that are no longer in stock */
                      <button type="button" onClick={() => setUndo({ rec: e.rec, title: evText(e) })} aria-label={`${t('cat.undo')}: ${evText(e)}`} title={t('cat.undo')}
                        className="tap-48 inline-flex items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-given"><Undo2 aria-hidden="true" /></button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      } />
      <Sheet open={Boolean(move)} onClose={() => setMove(null)} title={move ? titles[move] : ''}
        footer={<Button block disabled={busy} onClick={() => void submit()} data-testid="move-save">{move ? titles[move] : ''}</Button>}>
        {needsOrder && (
          <Field label={t('cat.order')} required>{({ id: fid }) => (
            <Select id={fid} value={orderId} onChange={(e) => { setOrderId(e.target.value); setErr(''); }} data-testid="move-order">
              <option value="">{t('cat.pickOrder')}</option>
              {openOrders.map((o) => <option key={o.order.entityId} value={o.order.entityId}>{o.order.orderNo} · {o.order.design} {o.order.size} · {o.buyer?.name ?? ''} ({o.pendingQty})</option>)}
            </Select>)}
          </Field>
        )}
        {move === 'reserve' && orderId && <p className="mb-3 text-sm text-muted" data-testid="order-needs">{t('cat.orderNeeds', { n: limits.orderNeed })}</p>}
        <Field label={t('cat.qty')} required hint={max !== undefined ? t('cat.max', { n: Math.max(0, max) }) : undefined} error={err}>
          {({ id: fid, describedBy, invalid }) => <Input id={fid} inputMode="numeric" value={qty} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => { setQty(e.target.value.replace(/\D/g, '')); setErr(''); }} className="num text-2xl" data-testid="move-qty" />}
        </Field>
        {move !== 'reserve' && <DateField value={day} onChange={setDay} />}
        {(move === 'sold' || move === 'written_off' || move === 'deliver') && (
          <Field label={t('common.note')} required={move !== 'deliver'} hint={move === 'sold' ? t('cat.sellNoteHint') : move === 'written_off' ? t('cat.writeOffNoteHint') : undefined}>
            {({ id: fid, describedBy }) => <Textarea id={fid} rows={2} value={note} aria-describedby={describedBy} onChange={(e) => { setNote(e.target.value); setErr(''); }} data-testid="move-note" />}
          </Field>
        )}
        {move === 'written_off' && <PhotoCapture value={photo} onChange={setPhoto} label={t('cat.optionalPhoto')} />}
      </Sheet>
      <Sheet open={Boolean(undo)} onClose={() => setUndo(null)} title={undo?.rec.type === 'carpet_reserve' ? t('cat.release') : t('cat.undo')}
        footer={<Button block variant="danger" disabled={!reason.trim()} onClick={() => void doUndo()} data-testid="undo-save">{undo?.rec.type === 'carpet_reserve' ? t('cat.release') : t('action.reverse')}</Button>}>
        {undo && <p className="mb-3 text-ink">{undo.title}</p>}
        <Field label={undo?.rec.type === 'carpet_reserve' ? t('cat.releaseReason') : t('cat.undoReason')} required>
          {({ id: fid }) => <Textarea id={fid} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="undo-reason" />}
        </Field>
      </Sheet>
    </section>
  );
}
