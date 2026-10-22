import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatTile, EmptyState } from '../../components/ui/Feedback';
import { PageGrid } from '../../components/ui/PageGrid';
import { ConfirmSheet } from '../../components/ui/Sheet';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { ItemP } from '../../db/types';
import { listItems, nameMaps } from '../../domain/masters';
import { stockBalance, stockLedger, type Move } from '../../domain/stock';
import { formatQty } from '../../domain/qty';
import { formatDay } from '../../domain/dates';
import { monthOf, todayIST } from '../../domain/ids';
import { can } from '../../domain/permissions';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { MonthPicker } from '../wages/shared';
import { Qty } from './shared';

export default function ItemDetailPage() {
  const { t, lang } = useT();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { role } = useSession();
  const recs = useRecords();
  const [month, setMonth] = useState(monthOf(todayIST()));
  const [confirm, setConfirm] = useState(false);
  const item = useMemo(() => listItems(recs, false).find((i) => i.entityId === id), [recs, id]);
  const names = useMemo(() => nameMaps(recs), [recs]);
  const ledger = useMemo(() => stockLedger(recs, id, month), [recs, id, month]);
  if (!item) return <EmptyState title={t('common.empty')} />;
  const balance = stockBalance(recs, id);
  const low = item.lowStockQty > 0 && balance <= item.lowStockQty;
  const canManage = role ? can(role, 'item.manage') : false;

  const refOf = (m: Move) => {
    if (m.kind === 'in') return m.ref ?? '';
    if (m.kind === 'out') return t(`stock.purpose.${m.ref}`);
    if (m.kind === 'adjust') return t(`stock.reason.${m.ref}`);
    return m.ref ? (names.orders.get(m.ref)?.orderNo ?? '') : t('stock.noOrder');
  };
  const kindLabel = (m: Move) => (m.kind === 'in' ? t('stock.in') : m.kind === 'out' ? t('stock.out') : m.kind === 'adjust' ? t('stock.adjust') : m.kind === 'finished' ? t('stock.finishedIn') : t('stock.kindBadge.delivery'));

  return (
    <section>
      <PageHeader title={item.name} back={() => navigate('/stock')} right={canManage && <Button size="md" variant="secondary" onClick={() => navigate(`/stock/${id}/edit`)}><Pencil aria-hidden="true" size={16} />{t('action.edit')}</Button>} />
      <PageGrid asideSticky aside={
        <div className="flex flex-col gap-3">
          <StatTile label={t('stock.balance')} tone={low ? 'given' : 'received'} value={<Qty q={balance} item={item} />} testid="item-balance" />
          {low && <Badge tone="danger">{t('stock.low')}</Badge>}
          {item.lowStockQty > 0 && <p className="text-sm text-muted">{t('stock.lowQty')}: <span className="num">{formatQty(item.lowStockQty, item.unit)}</span></p>}
          <div className="grid grid-cols-2 gap-2">
            <Button size="md" variant="success" onClick={() => navigate(`/stock/move/in?item=${id}`)}>{t('stock.in')}</Button>
            <Button size="md" variant="danger" onClick={() => navigate(`/stock/move/out?item=${id}`)}>{t('stock.out')}</Button>
            <Button size="md" variant="secondary" onClick={() => navigate(`/stock/move/adjust?item=${id}`)}>{t('stock.adjust')}</Button>
            {item.kind === 'finished' && <Button size="md" variant="secondary" onClick={() => navigate(`/stock/move/finished?item=${id}`)}>{t('stock.finishedIn')}</Button>}
          </div>
          {canManage && <Button variant="ghost" onClick={() => setConfirm(true)}>{item.active ? t('stock.deactivate') : t('stock.reactivate')}</Button>}
        </div>
      } main={
        <Card>
          <div className="mb-3 flex items-center justify-between"><CardTitle className="mb-0">{t('stock.ledger')}</CardTitle><MonthPicker month={month} onChange={setMonth} /></div>
          <div className="mb-3 grid grid-cols-4 gap-2 text-center">
            {[[t('stock.opening'), ledger.opening, 'text-ink'], [t('stock.totalIn'), ledger.in, 'text-received'], [t('stock.totalOut'), ledger.out, 'text-given'], [t('stock.closing'), ledger.closing, 'text-ink']].map(([l, v, c]) => (
              <div key={String(l)} className="rounded-xl bg-surface-2 p-2"><p className={`num text-lg font-bold ${c}`}>{formatQty(Number(v), item.unit)}</p><p className="text-xs text-muted">{l}</p></div>
            ))}
          </div>
          {ledger.moves.length === 0 ? <p className="text-sm text-muted">{t('common.empty')}</p> : (
            <ul className="divide-y divide-line">
              {[...ledger.moves].reverse().map((m) => (
                <li key={m.recId} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1"><p className="text-sm text-ink">{kindLabel(m)}{refOf(m) ? ` · ${refOf(m)}` : ''}{m.note ? ` · ${m.note}` : ''}</p><p className="text-xs text-muted">{formatDay(m.day, lang, 'short')} · {names.users.get(m.by) ?? ''}</p></div>
                  <span className={`num font-medium ${m.qty < 0 ? 'text-given' : 'text-received'}`}>{m.qty > 0 ? '+' : '−'}{formatQty(Math.abs(m.qty), item.unit)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      } />
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} onConfirm={async () => { await addRecord<ItemP>('item', { ...item, active: !item.active }); setConfirm(false); }} title={item.active ? t('stock.deactivate') : t('stock.reactivate')} message={item.name} />
    </section>
  );
}
