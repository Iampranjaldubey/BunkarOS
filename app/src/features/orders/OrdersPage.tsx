import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Users } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { EmptyState } from '../../components/ui/Feedback';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { useRecords } from '../../db/hooks';
import { orderViews, orderCounts, type OrderView } from '../../domain/orders';
import { formatDay } from '../../domain/dates';
import { todayIST } from '../../domain/ids';
import { can } from '../../domain/permissions';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { StatusBadge, DueLine } from './shared';

type Filter = 'open' | 'all';

export default function OrdersPage() {
  const { t, lang } = useT();
  const { role } = useSession();
  const navigate = useNavigate();
  const recs = useRecords();
  const [filter, setFilter] = useState<Filter>('open');
  const views = useMemo(() => orderViews(recs, todayIST()), [recs]);
  const counts = useMemo(() => orderCounts(views), [views]);
  const rows = filter === 'open' ? views.filter((v) => v.status !== 'delivered') : views;
  const canManage = role ? can(role, 'order.manage') : false;

  const card = (v: OrderView) => (
    <Link to={`/orders/${v.order.entityId}`} className={`card-hover flex items-center gap-3 rounded-2xl border bg-surface p-3 shadow-card ${v.overdue ? 'border-given/40' : 'border-line'}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink"><span className="num">{v.order.orderNo}</span> · {v.order.design} {v.order.size}</p>
        <p className="truncate text-sm text-muted">{v.buyer?.name ?? ''} · {formatDay(v.order.dueDate, lang, 'short')}</p>
        <DueLine v={v} />
      </div>
      <div className="text-right"><p className="num text-lg font-bold text-ink">{v.deliveredQty}/{v.order.qty}</p><StatusBadge v={v} /></div>
    </Link>
  );

  return (
    <section>
      <PageHeader title={t('order.title')} right={canManage && <div className="flex gap-2"><Button size="md" variant="ghost" onClick={() => navigate('/buyers')}><Users aria-hidden="true" size={18} />{t('buyer.title')}</Button><Button size="md" onClick={() => navigate('/orders/new')}><Plus aria-hidden="true" size={18} />{t('action.add')}</Button></div>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl<Filter> label={t('order.status')} value={filter} onChange={setFilter} options={[{ value: 'open', label: t('order.filter.open') }, { value: 'all', label: t('order.filter.all') }]} />
        <span className="num text-sm text-muted">{t('order.counts', { open: counts.new + counts.in_production + counts.finished, overdue: counts.overdue })}</span>
      </div>
      <ResponsiveTable<OrderView> rows={rows} rowKey={(v) => v.order.entityId} renderCard={card} onRowClick={(v) => navigate(`/orders/${v.order.entityId}`)}
        empty={<EmptyState icon={<ClipboardList size={40} />} title={t('order.empty')} hint={t('order.emptyHint')} action={canManage && <Button onClick={() => navigate('/orders/new')}>{t('order.new')}</Button>} />}
        columns={[
          { key: 'no', header: t('order.orderNo'), cell: (v) => <span className="num font-medium">{v.order.orderNo}</span> },
          { key: 'buyer', header: t('order.buyer'), cell: (v) => v.buyer?.name ?? '' },
          { key: 'what', header: t('order.design'), cell: (v) => `${v.order.design} ${v.order.size}` },
          { key: 'qty', header: t('order.qty'), align: 'right', cell: (v) => <span className="num">{v.deliveredQty}/{v.order.qty}</span> },
          { key: 'due', header: t('order.dueDate'), cell: (v) => <span className="flex flex-col"><span className="num">{formatDay(v.order.dueDate, lang, 'short')}</span><DueLine v={v} /></span> },
          { key: 'st', header: t('order.status'), cell: (v) => <StatusBadge v={v} /> },
        ]} />
    </section>
  );
}
