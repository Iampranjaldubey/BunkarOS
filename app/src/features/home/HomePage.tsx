import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, Wallet, Boxes, ClipboardList, AlertTriangle, Truck, HandCoins, ArrowDownToLine, Users, ChevronRight } from 'lucide-react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PageGrid } from '../../components/ui/PageGrid';
import { PwaInstallCard } from '../../components/ui/PwaInstallCard';
import { RollingNumber, WovenProgress } from '../../components/ui/Motion';
import { Knot } from '../../components/carpet/Carpet';
import type { KnotState } from '../../components/carpet/knots';
import { useIsDesktop } from '../../components/ui/useIsDesktop';
import { useCan, useModule } from '../../app/useCan';
import { useRecords } from '../../db/hooks';
import type { Rec, WorkerP } from '../../db/types';
import { listWorkers, listItems, getSettings } from '../../domain/masters';
import { dashboard, type Dashboard } from '../../domain/dashboard';
import { attendanceIndex, markKey } from '../../domain/attendance';
import { orderViews } from '../../domain/orders';
import { formatQty } from '../../domain/qty';
import { weekday } from '../../domain/ids';
import { DueLine } from '../orders/shared';
import { Qty } from '../stock/shared';
import { formatINR } from '../../domain/money';
import { formatDay } from '../../domain/dates';
import { todayIST } from '../../domain/ids';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

type Tone = 'neutral' | 'given' | 'received' | 'warn' | 'info';

/**
 * A ledger cell that opens the records behind it. SPEC-M17: no tinted card; the tone shows as a small marker
 * next to the label and, for money, in the figure's colour.
 */
function Tile({ to, icon, label, value, sub, tone = 'neutral', testid, className }: { to: string; icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: Tone; testid?: string; className?: string }) {
  const mark = { neutral: 'bg-line-strong', given: 'bg-given', received: 'bg-received', warn: 'bg-accent', info: 'bg-primary' }[tone];
  return (
    <Link to={to} data-testid={testid}
      className={cn('group flex min-h-32 flex-col gap-3 bg-surface p-4 transition-colors hover:bg-surface-2/60 focus-visible:outline focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-accent-ink md:p-5', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-ink-2"><span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-[2px]', mark)} />{label}</span>
        <span className="text-muted transition-colors group-hover:text-ink-2 [&_svg]:stroke-[1.6]" aria-hidden="true">{icon}</span>
      </div>
      <div className="num text-2xl font-medium leading-tight text-ink md:text-[1.75rem]">{value}</div>
      {sub && <div className="-mt-1 text-sm text-muted">{sub}</div>}
    </Link>
  );
}

/** Today's register: one knot per worker, in the order of the roll call. The Home's carpet moment (SPEC-M17). */
function TodayRegister({ workers, recs, today, canMark }: { workers: WorkerP[]; recs: Rec[]; today: string; canMark: boolean }) {
  const { t } = useT();
  const navigate = useNavigate();
  const idx = useMemo(() => attendanceIndex(recs), [recs]);
  const list = workers.filter((w) => w.joinedOn <= today);
  if (list.length === 0) return null;
  const stateOf = (w: WorkerP): KnotState => {
    const m = idx.get(markKey(w.entityId, today));
    if (m?.status === 'present') return 'present';
    if (m?.status === 'half') return 'half';
    if (m?.status === 'absent') return 'absent';
    return weekday(today) === 0 ? 'off' : 'unmarked';
  };
  const states = list.map(stateOf);
  const marked = states.filter((s) => s === 'present' || s === 'half' || s === 'absent').length;
  return (
    <Card className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:gap-6" data-testid="today-register">
      <div className="min-w-0 md:w-56 md:shrink-0">
        <h2 className="text-base font-semibold text-ink">{t('m17.register')}</h2>
        <p className="text-sm text-muted">{t('m17.registerHint')} · <span className="num">{marked}/{list.length}</span></p>
      </div>
      {/* Up to 24 workers: a knot with each name. More than that: knots only, like a row of the naksha. */}
      <ul className={cn('flex min-w-0 flex-1 flex-wrap', list.length <= 24 ? 'gap-x-5 gap-y-2' : 'gap-1.5')} aria-label={t('m17.register')}>
        {list.map((w, i) => {
          const label = `${w.name} · ${states[i] === 'unmarked' || states[i] === 'off' ? t('att.notMarked') : t(`att.${states[i]}`)}`;
          return (
            <li key={w.entityId} className="weave-row flex items-center gap-2" style={{ ['--i' as string]: i, ['--row' as string]: i }} title={label}>
              <Knot state={states[i]} size={list.length <= 24 ? 18 : 22} />
              {list.length <= 24 ? <span className="text-sm text-ink-2">{w.name}</span> : <span className="visually-hidden">{label}</span>}
            </li>
          );
        })}
      </ul>
      {canMark && marked < list.length && <Button size="md" variant="secondary" onClick={() => navigate('/attendance')} className="shrink-0"><CalendarCheck aria-hidden="true" size={18} />{t('m17.markNow')}</Button>}
    </Card>
  );
}

/** Owner home: what needs attention today. Every number opens the records behind it. */
export default function HomePage() {
  const { t, lang } = useT();
  const { role } = useSession();
  const navigate = useNavigate();
  const recs = useRecords();
  const isDesktop = useIsDesktop();
  const allowed = useCan();
  const on = useModule(); // SPEC-M18: only modules the platform turned on
  const today = todayIST();
  const workers = useMemo(() => listWorkers(recs), [recs]);
  const items = useMemo(() => listItems(recs), [recs]);
  const settings = useMemo(() => getSettings(recs), [recs]);
  const d = useMemo(() => dashboard(recs, today, workers, items, settings), [recs, today, workers, items, settings]);
  const isOwner = role === 'owner';
  const unmarked = d.roll.total - d.roll.marked;
  const money = (n: number) => <RollingNumber value={n} format={formatINR} />;

  const tiles = (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-3" data-testid="home-tiles">
      {on('attendance') && <Tile to="/attendance" icon={<CalendarCheck size={20} />} label={t('home.attendance')} value={t('home.attendanceOf', { present: d.roll.present + d.roll.half, total: d.roll.total })} sub={unmarked > 0 ? t('home.unmarked', { n: unmarked }) : undefined} tone={unmarked > 0 ? 'warn' : 'received'} testid="tile-attendance" />}
      {isOwner && on('wages') && <Tile to="/wages" icon={<Wallet size={20} />} label={t('home.wagesDue')} value={money(d.wagesDuePaise)}
        sub={<><span>{t('home.wagesPaid', { paid: d.paidCount, total: d.workerCount })}</span>{d.workerCount > 0 && <WovenProgress done={d.paidCount} total={d.workerCount} tone="received" label={t('m17.paidOf', { paid: d.paidCount, total: d.workerCount })} className="mt-2" />}</>}
        tone={d.wagesDuePaise > 0 ? 'given' : 'neutral'} testid="tile-wages" />}
      {isOwner && on('advances') && <Tile to="/workers" icon={<HandCoins size={20} />} label={t('home.advances')} value={money(d.advancesOutstandingPaise)} tone={d.advancesOutstandingPaise > 0 ? 'given' : 'neutral'} testid="tile-advances" />}
      {on('stock') && <Tile to="/stock" icon={<Boxes size={20} />} label={t('home.lowStock')} value={d.lowStock.length} sub={d.lowStock.length ? d.lowStock.slice(0, 2).map((r) => r.item.name).join(', ') : t('home.lowStockNone')} tone={d.lowStock.length ? 'given' : 'received'} testid="tile-stock" />}
      {on('orders') && <Tile to="/orders" icon={<AlertTriangle size={20} />} label={t('home.ordersOverdue')} value={d.orders.overdue} sub={`${t('home.ordersDue')}: ${d.orders.dueSoon}`} tone={d.orders.overdue ? 'given' : d.orders.dueSoon ? 'warn' : 'neutral'} testid="tile-orders" />}
      {on('orders') && <Tile to="/orders" icon={<Truck size={20} />} label={t('home.deliveriesPending')} value={d.orders.pendingDeliveries} tone={d.orders.pendingDeliveries ? 'info' : 'neutral'} testid="tile-deliveries"
        className={cn(!isOwner && 'col-span-2 lg:col-span-1')} />}
    </div>
  );

  const quick = [
    allowed('attendance.mark') && <Button key="att" size="md" onClick={() => navigate('/attendance')}><CalendarCheck aria-hidden="true" size={18} />{t('nav.attendance')}</Button>,
    allowed('advance.give') && <Button key="adv" size="md" variant="secondary" onClick={() => navigate('/advances/new')}><HandCoins aria-hidden="true" size={18} />{t('adv.title')}</Button>,
    allowed('stock.move') && <Button key="in" size="md" variant="secondary" onClick={() => navigate('/stock/move/in')}><ArrowDownToLine aria-hidden="true" size={18} />{t('stock.in')}</Button>,
    allowed('order.manage') && <Button key="ord" size="md" variant="secondary" onClick={() => navigate('/orders/new')}><ClipboardList aria-hidden="true" size={18} />{t('order.new')}</Button>,
  ].filter(Boolean);

  const aside = (
    <div className="flex flex-col gap-4">
      {quick.length > 0 && (
        <Card>
          <CardTitle>{t('home.quick')}</CardTitle>
          <div className="grid grid-cols-2 gap-2 [&>button]:justify-start [&>button]:px-3">{quick}</div>
        </Card>
      )}
      {isOwner && (
        <Card data-testid="entries-today">
          <CardTitle className="mb-1">{t('home.entries')}</CardTitle>
          {d.entriesToday.length === 0 ? <p className="text-sm text-muted">{t('home.noEntries')}</p> : (
            <ul className="divide-y divide-line">{d.entriesToday.map((e) => <li key={e.userId} className="flex items-center justify-between py-1"><span className="text-ink">{e.name}</span><Link to="/log" className="num -mr-2 inline-flex min-h-11 min-w-11 items-center justify-end rounded-xl px-2 text-sm font-medium text-primary transition-colors hover:bg-primary-soft">{t('home.entriesCount', { n: e.count })}</Link></li>)}</ul>
          )}
        </Card>
      )}
      {workers.length === 0 && <Card className="border-dashed border-line-strong"><p className="mb-3 text-ink">{t('worker.emptyHint')}</p><Button size="md" onClick={() => navigate('/workers/new')}><Users aria-hidden="true" size={18} />{t('worker.new')}</Button></Card>}
      <PwaInstallCard />
    </div>
  );

  return (
    <section>
      <header className="mb-5 lg:mb-6">
        <p className="mb-0.5 text-sm text-muted">{settings?.unitName || t('app.name')}{!isOwner ? ` · ${t('home.staffHint')}` : ''}</p>
        <h1 className="text-2xl md:text-3xl" data-testid="home-title">{formatDay(today, lang, 'long')}</h1>
      </header>
      {on('attendance') && <TodayRegister workers={workers} recs={recs} today={today} canMark={allowed('attendance.mark')} />}
      <PageGrid main={isDesktop ? <div className="flex flex-col gap-5">{tiles}<HomePanels recs={recs} today={today} lowStock={d.lowStock} showOrders={on('orders')} showStock={on('stock')} /></div> : tiles} aside={aside} asideSticky />
    </section>
  );
}

/** SPEC-M12 (desktop): what to deliver soon and what is running out, each row opens its record. */
function HomePanels({ recs, today, lowStock, showOrders, showStock }: { recs: Rec[]; today: string; lowStock: Dashboard['lowStock']; showOrders: boolean; showStock: boolean }) {
  const { t, lang } = useT();
  const due = useMemo(() => orderViews(recs, today).filter((v) => v.overdue || v.dueSoon).slice(0, 6), [recs, today]);
  const head = (title: string, to: string) => (
    <div className="mb-1 flex items-center justify-between"><CardTitle className="mb-0">{title}</CardTitle>
      <Link to={to} className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-primary transition-colors hover:bg-primary-soft">{t('home.viewAll')}<ChevronRight aria-hidden="true" size={16} /></Link></div>
  );
  return (
    <div className="grid grid-cols-2 gap-5">
      {showOrders && <Card data-testid="home-orders-panel">
        {head(t('home.ordersPanel'), '/orders')}
        {due.length === 0 ? <p className="py-3 text-sm text-muted">{t('home.ordersPanelEmpty')}</p> : (
          <ul className="divide-y divide-line">
            {due.map((v) => (
              <li key={v.order.entityId}>
                <Link to={`/orders/${v.order.entityId}`} className="-mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2/70">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{v.order.orderNo} · {v.order.design} {v.order.size}</p>
                    <p className="truncate text-sm text-muted">{v.buyer?.name ?? ''} · {formatDay(v.order.dueDate, lang, 'short')}</p>
                    <DueLine v={v} />
                  </div>
                  <div className="flex w-24 shrink-0 flex-col items-end gap-1.5">
                    <span className="num text-sm font-medium text-ink">{t('home.pendingQty', { n: v.pendingQty })}</span>
                    <WovenProgress done={v.deliveredQty} total={v.order.qty} tone={v.overdue ? 'given' : 'primary'} label={t('m17.delivered', { done: v.deliveredQty, total: v.order.qty })} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>}
      {showStock && <Card data-testid="home-stock-panel">
        {head(t('home.stockPanel'), '/stock')}
        {lowStock.length === 0 ? <p className="py-3 text-sm text-muted">{t('home.stockPanelEmpty')}</p> : (
          <ul className="divide-y divide-line">
            {lowStock.slice(0, 6).map((r) => (
              <li key={r.item.entityId}>
                <Link to={`/stock/${r.item.entityId}`} className="-mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2/70">
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{r.item.name}</span>
                  <div className="flex flex-col items-end gap-0.5">
                    <Qty q={r.balance} item={r.item} className="font-medium text-given" />
                    <span className="text-sm text-muted">{t('home.lowLevel')}: {formatQty(r.item.lowStockQty, r.item.unit)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>}
    </div>
  );
}
