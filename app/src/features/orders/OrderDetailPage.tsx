import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Share2, Truck, Play, CheckCircle2, MessageSquarePlus } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Field } from '../../components/ui/Field';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import { PageGrid } from '../../components/ui/PageGrid';
import { EmptyState, StatTile } from '../../components/ui/Feedback';
import { DateField } from '../../components/ui/DateField';
import { PreviewShareSheet } from '../../components/ui/PreviewShareSheet';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { DeliveryP, OrderNoteP, OrderStatus, OrderStatusP } from '../../db/types';
import { orderView, orderTimeline } from '../../domain/orders';
import { listItems, nameMaps, getSettings } from '../../domain/masters';
import { stockBalance } from '../../domain/stock';
import { formatINR } from '../../domain/money';
import { formatDay } from '../../domain/dates';
import { todayIST } from '../../domain/ids';
import { can } from '../../domain/permissions';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { StatusBadge, DueLine } from './shared';

export default function OrderDetailPage() {
  const { t, lang } = useT();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { role } = useSession();
  const recs = useRecords();
  const today = todayIST();
  const v = useMemo(() => orderView(recs, id, today), [recs, id, today]);
  const timeline = useMemo(() => orderTimeline(recs, id), [recs, id]);
  const names = useMemo(() => nameMaps(recs), [recs]);
  const settings = useMemo(() => getSettings(recs), [recs]);
  const finishedItems = useMemo(() => listItems(recs).filter((i) => i.kind === 'finished'), [recs]);
  const [deliverOpen, setDeliverOpen] = useState(false); const [dQty, setDQty] = useState(''); const [dDay, setDDay] = useState(today); const [dNote, setDNote] = useState(''); const [dItem, setDItem] = useState('');
  const [noteOpen, setNoteOpen] = useState(false); const [note, setNote] = useState(''); const [share, setShare] = useState(false); const [dErr, setDErr] = useState('');
  if (!v) return <EmptyState title={t('common.empty')} />;
  const canManage = role ? can(role, 'order.manage') : false;

  const setStatus = async (status: OrderStatus) => { await addRecord<OrderStatusP>('order_status', { orderId: id, status }); toast.show(t('action.done'), 'success'); };
  const deliver = async () => {
    const q = Number(dQty);
    if (!Number.isInteger(q) || q <= 0) { setDErr(t('valid.positive')); return; }
    if (q > v.pendingQty) { setDErr(t('order.tooMany', { pending: v.pendingQty })); return; }
    await addRecord<DeliveryP>('delivery', { orderId: id, qty: q, note: dNote.trim() || undefined, finishedItemId: dItem || undefined }, { day: dDay });
    setDeliverOpen(false); setDQty(''); setDNote(''); setDErr(''); toast.show(t('action.done'), 'success');
  };
  const addNote = async () => { if (!note.trim()) return; await addRecord<OrderNoteP>('order_note', { orderId: id, text: note.trim() }); setNote(''); setNoteOpen(false); };

  const shareText = t('order.shareText', { unit: settings?.unitName ?? '', orderNo: v.order.orderNo, design: v.order.design, size: v.order.size, qty: v.order.qty, delivered: v.deliveredQty, pending: v.pendingQty, status: t(`order.status.${v.status}`), due: formatDay(v.order.dueDate, lang, 'medium') });

  return (
    <section>
      <PageHeader title={`${v.order.orderNo} · ${v.order.design} ${v.order.size}`} back={() => navigate('/orders')} right={canManage && <Button size="md" variant="secondary" onClick={() => navigate(`/orders/${id}/edit`)}><Pencil aria-hidden="true" size={16} />{t('action.edit')}</Button>} />
      <PageGrid asideSticky aside={
        <div className="flex flex-col gap-3">
          <Card>
            <div className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge v={v} /><DueLine v={v} /></div>
            <p className="text-ink">{v.buyer?.name ?? ''}{v.buyer?.city ? ` · ${v.buyer.city}` : ''}</p>
            <p className="text-sm text-muted">{t('order.receivedOn')}: {formatDay(v.order.receivedOn, lang, 'short')} · {t('order.dueDate')}: {formatDay(v.order.dueDate, lang, 'short')}</p>
            {v.order.notes && <p className="mt-2 text-sm text-ink">{v.order.notes}</p>}
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label={t('order.delivered')} tone="received" value={<span className="num">{v.deliveredQty}/{v.order.qty}</span>} testid="order-delivered" />
            <StatTile label={t('order.pending')} tone={v.pendingQty > 0 ? 'given' : 'neutral'} value={<span className="num">{v.pendingQty}</span>} testid="order-pending" />
          </div>
          {v.amountPendingPaise !== undefined && <StatTile label={t('order.amountPending')} value={formatINR(v.amountPendingPaise)} />}
          {canManage && v.status !== 'delivered' && (
            <div className="flex flex-col gap-2">
              {v.status === 'new' && <Button onClick={() => void setStatus('in_production')}><Play aria-hidden="true" size={18} />{t('order.start')}</Button>}
              {v.status === 'in_production' && <Button onClick={() => void setStatus('finished')}><CheckCircle2 aria-hidden="true" size={18} />{t('order.finish')}</Button>}
              <Button variant="success" onClick={() => setDeliverOpen(true)}><Truck aria-hidden="true" size={18} />{t('order.deliver')}</Button>
            </div>
          )}
          <div className="flex gap-2">
            {canManage && <Button variant="secondary" size="md" className="flex-1" onClick={() => setNoteOpen(true)}><MessageSquarePlus aria-hidden="true" size={16} />{t('order.addNote')}</Button>}
            {v.buyer?.phone && <Button variant="secondary" size="md" className="flex-1" onClick={() => setShare(true)}><Share2 aria-hidden="true" size={16} />{t('action.share')}</Button>}
          </div>
        </div>
      } main={
        <Card>
          <CardTitle>{t('order.timeline')}</CardTitle>
          {timeline.length === 0 ? <p className="text-sm text-muted">{t('common.empty')}</p> : (
            <ol className="relative ml-2 border-l border-line pl-4">
              {timeline.map((it) => (
                <li key={it.recId} className="mb-4">
                  <span className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ${it.kind === 'delivery' ? 'bg-received' : it.kind === 'status' ? 'bg-primary' : 'bg-muted'}`} aria-hidden="true" />
                  <p className="text-ink">{it.kind === 'status' ? <Badge tone="info">{t(`order.status.${it.status}`)}</Badge> : it.kind === 'delivery' ? <><span className="num font-medium">{it.qty}</span> {t('order.delivered')}</> : it.text}</p>
                  {it.kind !== 'note' && it.text && <p className="text-sm text-ink">{it.text}</p>}
                  <p className="text-xs text-muted">{formatDay(it.day, lang, 'short')} · {names.users.get(it.by) ?? ''}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      } />
      <Sheet open={deliverOpen} onClose={() => setDeliverOpen(false)} title={`${t('order.deliver')} · ${t('order.pending')}: ${v.pendingQty}`} footer={<Button block variant="success" onClick={() => void deliver()}>{t('order.deliver')}</Button>}>
        <Field label={t('order.deliverQty')} required error={dErr}>{({ id, describedBy, invalid }) => <Input id={id} inputMode="numeric" value={dQty} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => { setDQty(e.target.value.replace(/\D/g, '')); setDErr(''); }} className="num text-2xl" autoFocus />}</Field>
        <DateField value={dDay} onChange={setDDay} />
        {finishedItems.length > 0 && <Field label={t('order.fromStock')}>{({ id }) => <Select id={id} value={dItem} onChange={(e) => setDItem(e.target.value)}><option value="">—</option>{finishedItems.map((i) => <option key={i.entityId} value={i.entityId}>{i.name} ({stockBalance(recs, i.entityId) / 1000})</option>)}</Select>}</Field>}
        <Field label={t('common.note')}>{({ id }) => <Textarea id={id} rows={2} value={dNote} onChange={(e) => setDNote(e.target.value)} />}</Field>
      </Sheet>
      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title={t('order.addNote')} footer={<Button block onClick={() => void addNote()}>{t('action.save')}</Button>}>
        <Textarea aria-label={t('order.notes')} rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
      </Sheet>
      {v.buyer?.phone && <PreviewShareSheet open={share} onClose={() => setShare(false)} recipientName={v.buyer.name} phone={v.buyer.phone} text={shareText} />}
    </section>
  );
}
