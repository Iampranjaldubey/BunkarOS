import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, Wallet, Boxes, ClipboardList, AlertTriangle, Truck, HandCoins, ArrowDownToLine, Users } from 'lucide-react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageGrid } from '../../components/ui/PageGrid';
import { PwaInstallCard } from '../../components/ui/PwaInstallCard';
import { useRecords } from '../../db/hooks';
import { listWorkers, listItems } from '../../domain/masters';
import { getSettings } from '../../domain/masters';
import { dashboard } from '../../domain/dashboard';
import { formatINR } from '../../domain/money';
import { formatDay } from '../../domain/dates';
import { todayIST } from '../../domain/ids';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

function Tile({ to, icon, label, value, sub, tone = 'neutral', testid }: { to: string; icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: 'neutral' | 'given' | 'received' | 'warn' | 'info'; testid?: string }) {
  const toneCls = { neutral: 'border-line', given: 'border-given/40 bg-given-soft/40', received: 'border-received/40 bg-received-soft/40', warn: 'border-accent/60 bg-accent-soft/50', info: 'border-primary/30 bg-primary-soft/50' }[tone];
  const iconCls = { neutral: 'bg-surface-2 text-muted', given: 'bg-given-soft text-given', received: 'bg-received-soft text-received', warn: 'bg-accent-soft text-accent-ink', info: 'bg-primary-soft text-primary' }[tone];
  return (
    <Link to={to} data-testid={testid} className={cn('card-hover flex min-h-28 flex-col justify-between rounded-2xl border bg-surface p-4 shadow-card', toneCls)}>
      <div className="flex items-center justify-between"><span className="text-sm text-muted">{label}</span><span className={cn('rounded-xl p-1.5', iconCls)} aria-hidden="true">{icon}</span></div>
      <div><div className="num text-2xl font-bold text-ink md:text-3xl">{value}</div>{sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}</div>
    </Link>
  );
}

/** Owner home: what needs attention today. Every number opens the records behind it. */
export default function HomePage() {
  const { t, lang } = useT();
  const { role, user } = useSession();
  const navigate = useNavigate();
  const recs = useRecords();
  const today = todayIST();
  const workers = useMemo(() => listWorkers(recs), [recs]);
  const items = useMemo(() => listItems(recs), [recs]);
  const settings = useMemo(() => getSettings(recs), [recs]);
  const d = useMemo(() => dashboard(recs, today, workers, items, settings), [recs, today, workers, items, settings]);
  const isOwner = role === 'owner';
  const unmarked = d.roll.total - d.roll.marked;

  const tiles = (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Tile to="/attendance" icon={<CalendarCheck size={20} />} label={t('home.attendance')} value={t('home.attendanceOf', { present: d.roll.present + d.roll.half, total: d.roll.total })} sub={unmarked > 0 ? t('home.unmarked', { n: unmarked }) : undefined} tone={unmarked > 0 ? 'warn' : 'received'} testid="tile-attendance" />
      {isOwner && <Tile to="/wages" icon={<Wallet size={20} />} label={t('home.wagesDue')} value={formatINR(d.wagesDuePaise)} sub={t('home.wagesPaid', { paid: d.paidCount, total: d.workerCount })} tone={d.wagesDuePaise > 0 ? 'given' : 'neutral'} testid="tile-wages" />}
      {isOwner && <Tile to="/workers" icon={<HandCoins size={20} />} label={t('home.advances')} value={formatINR(d.advancesOutstandingPaise)} tone={d.advancesOutstandingPaise > 0 ? 'given' : 'neutral'} testid="tile-advances" />}
      <Tile to="/stock" icon={<Boxes size={20} />} label={t('home.lowStock')} value={d.lowStock.length} sub={d.lowStock.length ? d.lowStock.slice(0, 2).map((r) => r.item.name).join(', ') : t('home.lowStockNone')} tone={d.lowStock.length ? 'given' : 'received'} testid="tile-stock" />
      <Tile to="/orders" icon={<AlertTriangle size={20} />} label={t('home.ordersOverdue')} value={d.orders.overdue} sub={`${t('home.ordersDue')}: ${d.orders.dueSoon}`} tone={d.orders.overdue ? 'given' : d.orders.dueSoon ? 'warn' : 'neutral'} testid="tile-orders" />
      <Tile to="/orders" icon={<Truck size={20} />} label={t('home.deliveriesPending')} value={d.orders.pendingDeliveries} tone={d.orders.pendingDeliveries ? 'info' : 'neutral'} testid="tile-deliveries" />
    </div>
  );

  const aside = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardTitle>{t('home.quick')}</CardTitle>
        <div className="grid grid-cols-2 gap-2">
          <Button size="md" onClick={() => navigate('/attendance')}><CalendarCheck aria-hidden="true" size={18} />{t('nav.attendance')}</Button>
          <Button size="md" variant="secondary" onClick={() => navigate('/advances/new')}><HandCoins aria-hidden="true" size={18} />{t('adv.title')}</Button>
          <Button size="md" variant="secondary" onClick={() => navigate('/stock/move/in')}><ArrowDownToLine aria-hidden="true" size={18} />{t('stock.in')}</Button>
          <Button size="md" variant="secondary" onClick={() => navigate('/orders/new')}><ClipboardList aria-hidden="true" size={18} />{t('order.new')}</Button>
        </div>
      </Card>
      {isOwner && (
        <Card data-testid="entries-today">
          <CardTitle>{t('home.entries')}</CardTitle>
          {d.entriesToday.length === 0 ? <p className="text-sm text-muted">{t('home.noEntries')}</p> : (
            <ul className="divide-y divide-line">{d.entriesToday.map((e) => <li key={e.userId} className="flex items-center justify-between py-2"><span className="text-ink">{e.name}</span><Link to="/log" className="num text-sm font-medium text-primary">{t('home.entriesCount', { n: e.count })}</Link></li>)}</ul>
          )}
        </Card>
      )}
      {workers.length === 0 && <Card className="bg-primary-soft"><p className="mb-2 text-ink">{t('worker.emptyHint')}</p><Button size="md" onClick={() => navigate('/workers/new')}><Users aria-hidden="true" size={18} />{t('worker.new')}</Button></Card>}
      <PwaInstallCard />
    </div>
  );

  return (
    <section>
      <div className="mb-4"><h1 className="text-2xl md:text-3xl">{t('home.greeting', { name: user?.name ?? '' })}</h1><p className="text-sm text-muted">{formatDay(today, lang, 'long')}{!isOwner ? ` · ${t('home.staffHint')}` : ''}</p></div>
      <PageGrid main={tiles} aside={aside} asideSticky />
    </section>
  );
}
