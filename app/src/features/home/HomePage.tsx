import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package, ShoppingBag, HandCoins, MapPin, Wallet, Boxes,
  FileText, AlertTriangle, RefreshCw, MessageSquareWarning, ChevronRight, Plus,
  Check, Clock, Pause, Circle, CalendarClock, Users, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardTitle } from '../../components/ui/Card';
import { Money } from '../../components/ui/Money';
import { Button } from '../../components/ui/Button';
import { EmptyState, StatTile } from '../../components/ui/Feedback';
import { PwaInstallCard } from '../../components/ui/PwaInstallCard';
import { useRecords, useSession } from '../../db/hooks';
import {
  loomBoard, listLooms, listThekedars, listPieces, listUsers, digest, getSettings,
  formatDay, formatTime, yarnBalances,
} from '../../domain/projections';
import type { LoomStatus } from '../../domain/projections';
import { loomsFreeSoon, peshgiOutstanding, todayEntriesByUser } from '../../domain/owner';
import { gramsToKgStr, cn } from '../../lib/utils';
import { istDay } from '../../domain/ids';
import type { Rec } from '../../db/types';
import { useT } from '../../i18n';

function greetingKey(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// Tile fill — dark text/strong fills keep every label ≥ 4.5:1 contrast.
//   on_track: white on jute-green  slow: white on amber-ink (5.9:1)
//   idle: white on madder-red      no_wool: dark ink on grey (≥ 4.5:1)
//   free: muted on light line
const STATUS_TILE: Record<LoomStatus, string> = {
  on_track: 'bg-ok text-white',
  slow: 'bg-saffron-ink text-white',
  idle: 'bg-madder text-white',
  // #d8dbe3 grey with #1f2430 ink → ~11:1 contrast (well above 4.5:1).
  no_wool: 'bg-[#d8dbe3] text-[#1f2430]',
  free: 'bg-line text-[#464d60]', // 6.0:1 on the line bg (muted #5a6275 was 4.36:1)
};

// Status is ALSO signalled by shape/icon, not colour alone (WCAG 1.4.1).
const STATUS_ICON: Record<LoomStatus, LucideIcon> = {
  on_track: Check,
  slow: Clock,
  idle: Pause,
  no_wool: Package,
  free: Circle,
};

const BOARD_STATUSES: LoomStatus[] = ['on_track', 'slow', 'idle', 'no_wool', 'free'];

// ---------------- Loom board (owner K2) ----------------
function LoomBoard({ recs }: { recs: Rec[] }) {
  const { t } = useT();
  const navigate = useNavigate();
  const nowISO = new Date().toISOString();
  const board = useMemo(() => loomBoard(recs, nowISO), [recs, nowISO]);
  const looms = useMemo(() => listLooms(recs), [recs]);
  const thekedars = useMemo(() => listThekedars(recs), [recs]);
  const pieces = useMemo(() => listPieces(recs), [recs]);

  const loomThekedar = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const l of looms) m.set(l.entityId, l.thekedarId);
    return m;
  }, [looms]);

  // loomId → the orderId of its on_loom piece (for the "by order" filter).
  const loomOrder = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pieces) if (p.loomId && p.status === 'on_loom') m.set(p.loomId, p.orderId);
    return m;
  }, [pieces]);

  // Distinct orders that actually have a loom on the board.
  const boardOrders = useMemo(() => {
    const seen = new Map<string, string>(); // orderId → orderNo
    for (const p of pieces) {
      if (p.loomId && p.status === 'on_loom' && !seen.has(p.orderId)) seen.set(p.orderId, p.orderNo);
    }
    return [...seen.entries()].map(([id, orderNo]) => ({ id, orderNo })).sort((a, b) => a.orderNo.localeCompare(b.orderNo));
  }, [pieces]);

  const [mode, setMode] = useState<'thekedar' | 'order'>('thekedar');
  const [thekedarFilter, setThekedarFilter] = useState<string>('all');
  const [orderFilter, setOrderFilter] = useState<string>('all');

  const filtered = board.filter((b) => {
    if (mode === 'thekedar') {
      return thekedarFilter === 'all' || loomThekedar.get(b.loomId) === thekedarFilter;
    }
    return orderFilter === 'all' || loomOrder.get(b.loomId) === orderFilter;
  });

  const counts = useMemo(() => {
    const c: Record<LoomStatus, number> = { on_track: 0, slow: 0, idle: 0, no_wool: 0, free: 0 };
    for (const b of filtered) c[b.status] += 1;
    return c;
  }, [filtered]);

  if (looms.length === 0) {
    return (
      <Card className="mb-4">
        <CardTitle>{t('home.board.title')}</CardTitle>
        <EmptyState
          icon={<Boxes size={40} />}
          title={t('home.board.empty')}
          hint={t('home.board.emptyHint')}
          action={
            <Button onClick={() => navigate('/looms/new')}>
              <Plus aria-hidden="true" size={20} />{t('home.board.addLoom')}
            </Button>
          }
        />
      </Card>
    );
  }

  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-12 items-center rounded-full px-4 text-sm font-medium',
      active ? 'bg-indigo text-white' : 'bg-bg text-muted border border-line',
    );

  return (
    <Card className="mb-4">
      <CardTitle>{t('home.board.title')}</CardTitle>
      <p className="mb-3 text-sm text-muted">{t('home.board.hint')}</p>

      {/* Segmented "by thekedar / by order" switch */}
      {(thekedars.length > 0 || boardOrders.length > 0) && (
        <div className="mb-3 inline-flex rounded-full border border-line bg-bg p-1" role="group" aria-label={t('home.board.filterBy')}>
          <button
            type="button"
            onClick={() => setMode('thekedar')}
            aria-pressed={mode === 'thekedar'}
            className={cn('min-h-12 rounded-full px-4 text-sm font-medium', mode === 'thekedar' ? 'bg-indigo text-white' : 'text-muted')}
          >
            {t('home.board.byThekedar')}
          </button>
          <button
            type="button"
            onClick={() => setMode('order')}
            aria-pressed={mode === 'order'}
            className={cn('min-h-12 rounded-full px-4 text-sm font-medium', mode === 'order' ? 'bg-indigo text-white' : 'text-muted')}
          >
            {t('home.board.byOrder')}
          </button>
        </div>
      )}

      {/* Thekedar filter chips */}
      {mode === 'thekedar' && thekedars.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t('home.board.filterThekedar')}>
          <button type="button" onClick={() => setThekedarFilter('all')} aria-pressed={thekedarFilter === 'all'} className={chip(thekedarFilter === 'all')}>
            {t('home.board.allThekedars')}
          </button>
          {thekedars.map((th) => (
            <button key={th.entityId} type="button" onClick={() => setThekedarFilter(th.entityId)} aria-pressed={thekedarFilter === th.entityId} className={chip(thekedarFilter === th.entityId)}>
              {th.name}
            </button>
          ))}
        </div>
      )}

      {/* Order filter chips */}
      {mode === 'order' && boardOrders.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t('home.board.filterOrder')}>
          <button type="button" onClick={() => setOrderFilter('all')} aria-pressed={orderFilter === 'all'} className={chip(orderFilter === 'all')}>
            {t('home.board.allOrders')}
          </button>
          {boardOrders.map((o) => (
            <button key={o.id} type="button" data-testid="board-order-chip" onClick={() => setOrderFilter(o.id)} aria-pressed={orderFilter === o.id} className={cn(chip(orderFilter === o.id), 'num')}>
              {o.orderNo}
            </button>
          ))}
        </div>
      )}

      {/* Legend with counts — colour + icon + label (not colour alone) */}
      <div className="mb-4 grid grid-cols-5 gap-2" data-testid="board-legend">
        {BOARD_STATUSES.map((st) => {
          const Icon = STATUS_ICON[st];
          return (
            <div key={st} className="flex flex-col items-center gap-1">
              <span aria-hidden="true" className={cn('flex h-6 w-full items-center justify-center rounded-lg', STATUS_TILE[st])}>
                <Icon size={14} strokeWidth={2.5} />
              </span>
              <span className="num text-lg font-bold text-ink" data-testid={`legend-${st}`}>{counts[st]}</span>
              <span className="text-center text-xs text-muted">{t(`board.${st}`)}</span>
            </div>
          );
        })}
      </div>

      {/* Colour tiles numbered by loom code. 8 per row at lg, 12 at xl so the
          board fills the wide board card instead of staying phone-narrow. */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-12">
        {filtered.map((b) => {
          const Icon = STATUS_ICON[b.status];
          return (
            <button
              key={b.loomId}
              type="button"
              data-testid="loom-tile"
              data-status={b.status}
              onClick={() => navigate(`/looms/${b.loomId}`)}
              aria-label={`${b.code} — ${t(`board.${b.status}`)}`}
              className={cn(
                'relative flex aspect-square flex-col items-center justify-center rounded-xl font-bold shadow-card',
                'focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink',
                STATUS_TILE[b.status],
              )}
            >
              <Icon aria-hidden="true" size={13} strokeWidth={2.5} className="absolute right-1 top-1 opacity-90" />
              <span className="num text-lg leading-none">{b.code}</span>
              {b.status !== 'free' && b.daysSinceProgress !== null && (
                <span className="num mt-0.5 text-[10px] opacity-90">{t('home.board.days', { n: b.daysSinceProgress })}</span>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------- Owner SPEC-017 cards ----------------
function FreeSoonCard({ recs }: { recs: Rec[] }) {
  const { t } = useT();
  const navigate = useNavigate();
  const nowISO = new Date().toISOString();
  const rows = useMemo(() => loomsFreeSoon(recs, nowISO, 30), [recs, nowISO]);
  if (rows.length === 0) return null;
  return (
    <Card className="mb-4">
      <CardTitle>
        <span className="inline-flex items-center gap-2">
          <CalendarClock aria-hidden="true" size={20} className="text-indigo" />
          {t('home.freeSoon.title')}
        </span>
      </CardTitle>
      <span className="mb-2 inline-block rounded-full bg-saffron/20 px-2.5 py-0.5 text-xs font-medium text-saffron-ink">
        {t('home.freeSoon.estimate')}
      </span>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          // SPEC-017 AC3: a forward-looking estimate must never read as a
          // negative "free in −N days". When the pace estimate has already
          // elapsed (freeDay in the past), the loom is due to free up now, so
          // clamp to 0 and show "अब खाली होने वाला" instead of a nonsensical
          // negative number. (owner.ts may still emit a negative daysLeft; we
          // clamp defensively at the render boundary.)
          const daysLeft = Math.max(0, r.daysLeft);
          return (
            <li key={r.loomId}>
              <button
                type="button"
                data-testid="free-soon-loom"
                onClick={() => navigate(`/looms/${r.loomId}`)}
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-card focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
              >
                <span className="num flex h-11 w-11 items-center justify-center rounded-xl bg-indigo/10 text-lg font-bold text-indigo">{r.code}</span>
                <span className="num flex-1 text-base text-ink">{r.pieceId}</span>
                <span className="num text-sm font-medium text-muted">
                  {daysLeft === 0 ? t('home.freeSoon.now') : t('home.freeSoon.in', { n: daysLeft })}
                </span>
                <ChevronRight aria-hidden="true" className="text-muted" size={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function DuesMaterialStaff({ recs }: { recs: Rec[] }) {
  const { t } = useT();
  const navigate = useNavigate();
  const day = istDay(new Date().toISOString());
  const dues = useMemo(() => peshgiOutstanding(recs), [recs]);
  const materialG = useMemo(
    () => yarnBalances(recs).reduce((s, row) => s + Math.max(0, row.grams), 0),
    [recs],
  );
  const staff = useMemo(() => todayEntriesByUser(recs, day), [recs, day]);

  return (
    <>
      {/* Dues + material outside */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          data-testid="dues-tile"
          onClick={() => navigate('/weavers')}
          className="flex flex-col items-start gap-1 rounded-2xl border border-madder/20 bg-madder/5 p-4 text-left shadow-card focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
        >
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-madder/10 text-madder"><HandCoins size={20} /></span>
          <span className="mt-1 text-sm text-muted">{t('home.dues.title')}</span>
          <Money paise={dues.totalPaise} flow="given" size="md" />
        </button>
        <button
          type="button"
          data-testid="material-tile"
          onClick={() => navigate('/yarn')}
          className="flex flex-col items-start gap-1 rounded-2xl border border-madder/20 bg-madder/5 p-4 text-left shadow-card focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
        >
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-madder/10 text-madder"><Boxes size={20} /></span>
          <span className="mt-1 text-sm text-muted">{t('home.material.title')}</span>
          <span className="num text-xl font-bold text-madder">{gramsToKgStr(materialG)}</span>
        </button>
      </div>

      {/* Today's entries by staff → audit */}
      <Card className="mb-4">
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <Users aria-hidden="true" size={20} className="text-indigo" />
            {t('home.staff.title')}
          </span>
        </CardTitle>
        {staff.length === 0 ? (
          <p className="text-base text-muted">{t('home.staff.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {staff.map((s) => (
              <li key={s.userId}>
                <button
                  type="button"
                  data-testid="staff-entry"
                  onClick={() => navigate('/audit')}
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-card focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
                >
                  <span className="flex-1 text-base font-medium text-ink">{s.name}</span>
                  <span className="rounded-full bg-indigo/10 px-2.5 py-0.5 text-xs font-medium text-indigo">{t(`role.${s.role}`)}</span>
                  <span className="num text-base font-bold text-ink">{t('home.staff.count', { n: s.count })}</span>
                  <ChevronRight aria-hidden="true" className="text-muted" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

// ---------------- Owner home ----------------
function OwnerHome({ recs }: { recs: Rec[] }) {
  const { t } = useT();
  const navigate = useNavigate();
  const day = istDay(new Date().toISOString());
  const nowISO = new Date().toISOString();
  const d = useMemo(() => digest(recs, day, nowISO), [recs, day, nowISO]);

  // Single DOM, two layouts. Below lg the sections flow in exactly today's
  // order (plain block flow — no grid, phone untouched). At lg the sections are
  // placed into a 3-column grid: the loom board fills the left 2/3 (main) and
  // the summary/alerts/dues/digest rail stacks in the right 1/3 (aside), each
  // section pinned to its own grid row so source order never shuffles the
  // phone layout. `items-start` lets the aside rail sit at the top while the
  // board grows; `auto-rows-min` keeps rows tight.
  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-x-6 lg:items-start lg:[grid-auto-rows:min-content]">
      {/* Loom board — left 2/3 at lg (spans every aside row). */}
      <div className="lg:col-start-1 lg:col-span-2 lg:row-start-1 lg:row-span-7">
        <LoomBoard recs={recs} />
      </div>

      {/* Today's key numbers — aside row 1 */}
      <div className="lg:col-start-3 lg:row-start-1">
        <Card className="mb-4">
          <CardTitle>{t('home.today')}</CardTitle>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label={t('home.stat.bazaars')} value={<span className="num">{d.bazaarCount}</span>} tone="info" />
            <StatTile label={t('home.stat.cashPaid')} value={<Money paise={d.cashPaidPaise} flow="given" size="md" />} tone="given" />
            <StatTile label={t('home.stat.woolOutside')} value={<span className="num">{gramsToKgStr(d.woolOutsideG)}</span>} tone="given" />
          </div>
        </Card>
      </div>

      {/* PWA install hint — aside row 2 */}
      <div className="lg:col-start-3 lg:row-start-2">
        <PwaInstallCard />
      </div>

      {/* Orders at risk (K1) — aside row 3 */}
      <div className="lg:col-start-3 lg:row-start-3">
        {d.ordersAtRisk.length > 0 && (
          <Card className="mb-4 border-madder/30 bg-madder/5">
            <CardTitle>
              <span className="inline-flex items-center gap-2 text-madder">
                <AlertTriangle aria-hidden="true" size={20} />
                {t('home.risk.title')} ({d.ordersAtRisk.length})
              </span>
            </CardTitle>
            <ul className="flex flex-col gap-2">
              {d.ordersAtRisk.map((o) => (
                <li key={o.orderId}>
                  <button
                    type="button"
                    data-testid="risk-order"
                    onClick={() => navigate(`/orders/${o.orderId}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-card focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
                  >
                    <span className="num text-lg font-bold text-ink">{o.orderNo}</span>
                    <span className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      o.reason === 'overdue' ? 'bg-madder/15 text-madder'
                        : o.reason === 'due_soon' ? 'bg-saffron/20 text-saffron-ink'
                          : 'bg-indigo/10 text-indigo',
                    )}>
                      {t(`risk.reason.${o.reason}`)}
                    </span>
                    <span className="flex-1 text-right text-sm text-muted">{t('risk.openPieces', { n: o.openPieces })}</span>
                    <ChevronRight aria-hidden="true" className="text-muted" size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Warnings (pending sync / disputes) — aside row 4 */}
      <div className="lg:col-start-3 lg:row-start-4">
        {d.pendingSync > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl border border-saffron/40 bg-saffron/15 p-3 text-saffron-ink">
            <RefreshCw aria-hidden="true" size={20} />
            <span className="flex-1 text-base">{t('home.warn.pending', { n: d.pendingSync })}</span>
          </div>
        )}
        {d.disputes > 0 && (
          <button
            type="button"
            onClick={() => navigate('/audit')}
            className="mb-3 flex w-full items-center gap-2 rounded-2xl border border-madder/30 bg-madder/10 p-3 text-left text-madder"
          >
            <MessageSquareWarning aria-hidden="true" size={20} />
            <span className="flex-1 text-base">{t('home.warn.disputes', { n: d.disputes })}</span>
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        )}
      </div>

      {/* SPEC-017: looms freeing up in the next 30 days (estimate) — aside row 5 */}
      <div className="lg:col-start-3 lg:row-start-5">
        <FreeSoonCard recs={recs} />
      </div>

      {/* SPEC-017: dues, material outside, today's staff entries — aside row 6 */}
      <div className="lg:col-start-3 lg:row-start-6">
        <DuesMaterialStaff recs={recs} />
      </div>

      {/* Digest card — aside row 7 */}
      <div className="lg:col-start-3 lg:row-start-7">
        <Link
          to="/digest"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-indigo/20 bg-indigo/5 p-4 shadow-card focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
        >
          <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo/10 text-indigo">
            <FileText size={24} />
          </span>
          <span className="flex-1">
            <span className="block text-lg font-medium text-ink">{t('home.digest.title')}</span>
            <span className="block text-sm text-muted">{t('home.digest.hint')}</span>
          </span>
          <ChevronRight aria-hidden="true" className="text-muted" />
        </Link>
      </div>
    </div>
  );
}

// ---------------- Munshi home ----------------
interface ActionTile { to: string; icon: LucideIcon; key: string; tone: string; }
const MUNSHI_ACTIONS: ActionTile[] = [
  { to: '/yarn/issue', icon: Package, key: 'woolIssue', tone: 'bg-madder/10 text-madder' },
  { to: '/bazaar/new', icon: ShoppingBag, key: 'bazaar', tone: 'bg-indigo/10 text-indigo' },
  { to: '/peshgi/new', icon: HandCoins, key: 'peshgi', tone: 'bg-madder/10 text-madder' },
  { to: '/checkin/new', icon: MapPin, key: 'checkin', tone: 'bg-indigo/10 text-indigo' },
  { to: '/roker', icon: Wallet, key: 'roker', tone: 'bg-saffron/20 text-saffron-ink' },
  { to: '/yarn', icon: Boxes, key: 'yarn', tone: 'bg-ok/12 text-ok' },
  { to: '/jobs/new', icon: Wrench, key: 'job', tone: 'bg-indigo/10 text-indigo' }, // C2 other paid work (SPEC-016)
];

function MunshiHome({ recs }: { recs: Rec[] }) {
  const { t, lang } = useT();
  const today = istDay(new Date().toISOString());
  const todayRecs = useMemo(
    () =>
      recs
        .filter((r) => r.day === today && ['bazaar', 'peshgi', 'yarn_issue', 'yarn_return', 'checkin', 'roker'].includes(r.type))
        .slice()
        .reverse(),
    [recs, today],
  );

  return (
    <>
      <PwaInstallCard />
      <Card className="mb-4">
        <CardTitle>{t('home.munshi.actions')}</CardTitle>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {MUNSHI_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.key}
                to={a.to}
                className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface p-3 text-center shadow-card focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
              >
                <span aria-hidden="true" className={cn('flex h-14 w-14 items-center justify-center rounded-full', a.tone)}>
                  <Icon size={28} />
                </span>
                <span className="text-base font-medium text-ink">{t(`home.munshi.${a.key}`)}</span>
              </Link>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>{t('home.munshi.todayEntries')}</CardTitle>
        {todayRecs.length === 0 ? (
          <EmptyState icon={<AlertTriangle size={36} />} title={t('home.munshi.noEntries')} hint={t('home.munshi.noEntriesHint')} />
        ) : (
          <>
            {/* Phone: unchanged tight time-stamped list. */}
            <ul className="lg:hidden">
              {todayRecs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 border-b border-line py-3 text-base last:border-0">
                  <span className="text-ink">{t(`home.entry.${r.type}`)}</span>
                  <span className="num text-sm text-muted">
                    {formatTime(r.at, lang)}
                  </span>
                </li>
              ))}
            </ul>
            {/* lg+: a real two-column ledger table (entry · time). */}
            <div className="hidden lg:block">
              <table data-testid="munshi-today-table" className="w-full border-collapse text-base">
                <thead>
                  <tr>
                    <th scope="col" className="border-b border-line px-3 py-2 text-left text-sm font-medium text-muted">{t('desktop.col.entry')}</th>
                    <th scope="col" className="border-b border-line px-3 py-2 text-right text-sm font-medium text-muted">{t('desktop.col.time')}</th>
                  </tr>
                </thead>
                <tbody>
                  {todayRecs.map((r) => (
                    <tr key={r.id} className="even:bg-bg/60">
                      <td className="h-11 border-b border-line px-3 py-2 align-middle text-ink">{t(`home.entry.${r.type}`)}</td>
                      <td className="num h-11 border-b border-line px-3 py-2 text-right align-middle text-muted whitespace-nowrap">{formatTime(r.at, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </>
  );
}

// ---------------- Thekedar home ----------------
function ThekedarHome({ recs, userId }: { recs: Rec[]; userId: string }) {
  const { t } = useT();
  const navigate = useNavigate();

  const myThekedarId = useMemo(() => {
    const u = listUsers(recs).find((x) => x.entityId === userId);
    return u?.thekedarId;
  }, [recs, userId]);

  const myLooms = useMemo(() => {
    const looms = listLooms(recs).filter((l) => myThekedarId && l.thekedarId === myThekedarId);
    const pieces = listPieces(recs);
    return looms.map((l) => {
      const piece = pieces.find((p) => p.loomId === l.entityId && p.status === 'on_loom');
      return { loom: l, pct: piece?.pctWoven ?? 0, hasWork: Boolean(piece) };
    });
  }, [recs, myThekedarId]);

  return (
    <>
      <Button block size="xl" className="mb-4 lg:w-auto lg:min-w-64" onClick={() => navigate('/checkin/new')}>
        <MapPin aria-hidden="true" />{t('home.thekedar.checkin')}
      </Button>

      <Card>
        <CardTitle>{t('home.thekedar.myLooms')}</CardTitle>
        {myLooms.length === 0 ? (
          <EmptyState icon={<Boxes size={40} />} title={t('home.thekedar.noLooms')} />
        ) : (
          <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-3 lg:gap-3">
            {myLooms.map(({ loom, pct, hasWork }) => (
              <li key={loom.entityId}>
                <Link
                  to={`/looms/${loom.entityId}`}
                  className="flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
                >
                  <span className="num flex h-12 w-12 items-center justify-center rounded-xl bg-indigo/10 text-lg font-bold text-indigo">
                    {loom.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-ink">{loom.village}</span>
                    <span className="block text-sm text-muted">
                      {hasWork ? t('home.thekedar.woven', { n: pct }) : t('home.board.noWork')}
                    </span>
                  </span>
                  {hasWork && (
                    <span className="h-2 w-16 overflow-hidden rounded-full bg-bg" aria-hidden="true">
                      <span className="block h-full rounded-full bg-indigo" style={{ width: `${pct}%` }} />
                    </span>
                  )}
                  <ChevronRight aria-hidden="true" className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function HomePage() {
  const { t, lang } = useT();
  const recs = useRecords();
  const { role, user } = useSession();
  const settings = getSettings(recs);
  const name = user?.name ?? settings?.unitName ?? '';
  const day = istDay(new Date().toISOString());

  return (
    <section>
      <h1 className="mb-1 text-2xl font-bold text-ink">{t(`home.greeting.${greetingKey()}`, { name })}</h1>
      <p className="mb-5 text-base text-muted">{formatDay(day, lang)}</p>

      {role === 'owner' && <OwnerHome recs={recs} />}
      {role === 'munshi' && <MunshiHome recs={recs} />}
      {role === 'thekedar' && user && <ThekedarHome recs={recs} userId={user.id} />}
    </section>
  );
}
