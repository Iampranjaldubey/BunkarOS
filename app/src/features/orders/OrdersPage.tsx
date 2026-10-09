import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { Button, Card, EmptyState, Input, Skeleton, ResponsiveTable, type ColumnDef } from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { useRecords, useSession } from '../../db/hooks';
import { listOrders, listPieces, formatDay } from '../../domain/projections';
import type { OrderP } from '../../db/types';
import { can } from '../../domain/permissions';
import { formatFtIn } from '../../domain/units';
import { useT } from '../../i18n';

function CountChip({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className={'flex min-w-16 flex-col items-center rounded-xl px-2 py-1.5 ' + cls}>
      <span className="num text-xl font-bold leading-none">{n}</span>
      <span className="mt-0.5 text-xs leading-tight">{label}</span>
    </div>
  );
}

/** Compact inline status counts for the table cell (icons-free, labelled by title). */
function StatusCounts({ c }: { c: ReturnType<ReturnType<typeof useOrderCounts>> }) {
  const { t } = useT();
  const items: [number, string, string][] = [
    [c.notStarted, t('order.count.notStarted'), 'bg-bg text-muted'],
    [c.onLoom, t('order.count.onLoom'), 'bg-saffron/20 text-saffron-ink'],
    [c.offLoom, t('order.count.offLoom'), 'bg-indigo/10 text-indigo'],
    [c.delivered, t('order.count.delivered'), 'bg-ok/12 text-ok'],
  ];
  return (
    <div className="flex items-center gap-1.5">
      {items.map(([n, label, cls], i) => (
        <span
          key={i}
          title={label}
          className={'num inline-flex min-w-7 items-center justify-center rounded-lg px-1.5 py-0.5 text-sm font-bold ' + cls}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

function useOrderCounts(pieces: ReturnType<typeof listPieces>) {
  return (orderNo: string) => {
    const ps = pieces.filter((p) => p.orderNo === orderNo);
    return {
      notStarted: ps.filter((p) => p.status === 'not_started').length,
      onLoom: ps.filter((p) => p.status === 'on_loom' || p.status === 'on_hold').length,
      offLoom: ps.filter((p) => p.status === 'off_loom').length,
      delivered: ps.filter((p) => p.status === 'delivered').length,
    };
  };
}

export default function OrdersPage() {
  const { t, lang } = useT();
  const { role } = useSession();
  const navigate = useNavigate();
  const recs = useRecords();
  const [q, setQ] = useState('');

  const ready = recs.length > 0;
  const orders = useMemo(() => listOrders(recs), [recs]);
  const pieces = useMemo(() => listPieces(recs), [recs]);
  const counts = useOrderCounts(pieces);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return orders;
    return orders.filter((o) => o.orderNo.toLowerCase().includes(n) || o.exporter.toLowerCase().includes(n));
  }, [orders, q]);

  const canCreate = role ? can(role, 'order.create') : false;

  const renderCard = (o: OrderP) => {
    const c = counts(o.orderNo);
    return (
      <button
        type="button"
        data-testid="order-row"
        onClick={() => navigate(`/orders/${o.entityId}`)}
        className="w-full text-left focus-visible:outline-none"
      >
        <Card className="transition-colors hover:bg-bg">
          <div className="flex items-baseline justify-between gap-2">
            <span className="num text-lg font-bold text-ink">{o.orderNo}</span>
            <span className="num text-sm text-muted">{o.count} {t('order.pieces')}</span>
          </div>
          <div className="text-sm text-muted">{o.exporter} · {o.design} · {o.colour}</div>
          <div className="text-sm text-muted">{formatFtIn(o.lengthIn)} × {formatFtIn(o.widthIn)}</div>
          <div className="mt-3 flex gap-2">
            <CountChip n={c.notStarted} label={t('order.count.notStarted')} cls="bg-bg text-muted" />
            <CountChip n={c.onLoom} label={t('order.count.onLoom')} cls="bg-saffron/20 text-saffron-ink" />
            <CountChip n={c.offLoom} label={t('order.count.offLoom')} cls="bg-indigo/10 text-indigo" />
            <CountChip n={c.delivered} label={t('order.count.delivered')} cls="bg-ok/12 text-ok" />
          </div>
        </Card>
      </button>
    );
  };

  const columns: ColumnDef<OrderP>[] = [
    { key: 'no', header: t('col.order.no'), cell: (o) => <span className="num font-bold text-ink">{o.orderNo}</span> },
    { key: 'exporter', header: t('col.order.exporter'), cell: (o) => o.exporter },
    { key: 'design', header: t('col.order.design'), cell: (o) => <span className="text-muted">{o.design} · {o.colour}</span> },
    { key: 'size', header: t('col.order.size'), cell: (o) => <span className="num text-muted">{formatFtIn(o.lengthIn)} × {formatFtIn(o.widthIn)}</span> },
    { key: 'count', header: t('col.order.count'), align: 'right', cell: (o) => <span className="num">{o.count}</span> },
    { key: 'status', header: t('col.order.status'), cell: (o) => <StatusCounts c={counts(o.orderNo)} /> },
    { key: 'due', header: t('col.order.due'), align: 'right', cell: (o) => <span className="num text-muted">{o.dueDate ? formatDay(o.dueDate, lang, 'short') : '—'}</span> },
  ];

  return (
    <section>
      <PageHeader
        title={t('order.list.title')}
        right={
          canCreate && orders.length > 0 ? (
            <Button size="md" onClick={() => navigate('/orders/new')}>
              <Plus aria-hidden="true" size={20} />
              {t('order.addShort')}
            </Button>
          ) : undefined
        }
      />

      {orders.length > 0 && (
        <div className="relative mb-4 lg:max-w-sm">
          <Search aria-hidden="true" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('order.search')} aria-label={t('order.search')} className="pl-11" />
        </div>
      )}

      {!ready ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={48} />}
          title={t('order.empty.title')}
          hint={t('order.empty.hint')}
          action={canCreate ? <Button onClick={() => navigate('/orders/new')}><Plus aria-hidden="true" size={20} />{t('order.add')}</Button> : undefined}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search size={40} />} title={t('common.empty')} />
      ) : (
        <ResponsiveTable
          rows={filtered}
          columns={columns}
          rowKey={(o) => o.entityId}
          onRowClick={(o) => navigate(`/orders/${o.entityId}`)}
          renderCard={renderCard}
          testid="orders-table"
        />
      )}
    </section>
  );
}
