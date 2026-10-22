import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, Boxes, Plus, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Feedback';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { useRecords } from '../../db/hooks';
import { listItems } from '../../domain/masters';
import { stockRows, type StockRow } from '../../domain/stock';
import { can } from '../../domain/permissions';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { Qty } from './shared';

export default function StockPage() {
  const { t } = useT();
  const { role } = useSession();
  const navigate = useNavigate();
  const recs = useRecords();
  const items = useMemo(() => listItems(recs), [recs]);
  const rows = useMemo(() => stockRows(recs, items), [recs, items]);
  const raw = rows.filter((r) => r.item.kind === 'raw'); const finished = rows.filter((r) => r.item.kind === 'finished');
  const lowCount = rows.filter((r) => r.low).length;
  const canMove = role ? can(role, 'stock.move') : false; const canManage = role ? can(role, 'item.manage') : false;

  const card = (r: StockRow) => (
    <Link to={`/stock/${r.item.entityId}`} className={`card-hover flex items-center gap-3 rounded-2xl border bg-surface p-3 shadow-card ${r.low ? 'border-given/40' : 'border-line'}`} data-testid={`stock-row-${r.item.entityId}`}>
      <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{r.item.name}</p>{r.low && <Badge tone="danger"><AlertTriangle aria-hidden="true" size={12} />{t('stock.low')}</Badge>}</div>
      <Qty q={r.balance} item={r.item} className={`text-xl font-bold ${r.low ? 'text-given' : 'text-ink'}`} />
    </Link>
  );
  const table = (list: StockRow[], title: string) => (
    <div className="mb-6">
      <h2 className="mb-2 text-lg">{title} <span className="num text-sm text-muted">({list.length})</span></h2>
      <ResponsiveTable<StockRow> rows={list} rowKey={(r) => r.item.entityId} renderCard={card} onRowClick={(r) => navigate(`/stock/${r.item.entityId}`)} empty={<p className="text-sm text-muted">{t('common.empty')}</p>}
        columns={[
          { key: 'name', header: t('stock.name'), cell: (r) => <span className="font-medium">{r.item.name}</span> },
          { key: 'bal', header: t('stock.balance'), align: 'right', cell: (r) => <Qty q={r.balance} item={r.item} className={`font-bold ${r.low ? 'text-given' : ''}`} /> },
          { key: 'low', header: '', cell: (r) => (r.low ? <Badge tone="danger">{t('stock.low')}</Badge> : null) },
        ]} />
    </div>
  );

  return (
    <section>
      <PageHeader title={t('stock.title')} right={canManage && <Button size="md" variant="secondary" onClick={() => navigate('/stock/new')}><Plus aria-hidden="true" size={18} />{t('stock.newItem')}</Button>} />
      {canMove && items.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Button variant="success" size="md" onClick={() => navigate('/stock/move/in')}><ArrowDownToLine aria-hidden="true" size={18} />{t('stock.in')}</Button>
          <Button variant="danger" size="md" onClick={() => navigate('/stock/move/out')}><ArrowUpFromLine aria-hidden="true" size={18} />{t('stock.out')}</Button>
          <Button variant="secondary" size="md" onClick={() => navigate('/stock/move/adjust')}><SlidersHorizontal aria-hidden="true" size={18} />{t('stock.adjust')}</Button>
        </div>
      )}
      {lowCount > 0 && <p role="status" className="mb-4 rounded-xl bg-given-soft px-4 py-2 text-sm font-medium text-given">{t('stock.lowCount', { n: lowCount })}</p>}
      {items.length === 0 ? (
        <EmptyState icon={<Boxes size={40} />} title={t('stock.empty')} hint={t('stock.emptyHint')} action={canManage && <Button onClick={() => navigate('/stock/new')}>{t('stock.newItem')}</Button>} />
      ) : (
        <div className="lg:grid lg:grid-cols-2 lg:gap-6">{table(raw, t('stock.raw'))}{table(finished, t('stock.finished'))}</div>
      )}
    </section>
  );
}
