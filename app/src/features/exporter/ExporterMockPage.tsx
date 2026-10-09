import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ImageIcon, Package, Truck, Info, Check, Clock, Pause, Circle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';
import { useRecords } from '../../db/hooks';
import { listOrders, listPieces, loomBoard, formatDay } from '../../domain/projections';
import { formatFtIn } from '../../domain/units';
import { PhotoThumb } from '../../components/ui/PhotoThumb';
import type { CheckinP, Rec } from '../../db/types';
import type { PieceStatus } from '../../domain/projections';

const DAY_MS = 24 * 60 * 60 * 1000;

const statusTone: Record<PieceStatus, string> = {
  on_loom: 'bg-indigo/10 text-indigo',
  off_loom: 'bg-ok/12 text-ok',
  delivered: 'bg-ok/12 text-ok',
  not_started: 'bg-bg text-muted',
  on_hold: 'bg-saffron/20 text-saffron-ink',
};

/**
 * SPEC-013 (A2): read-only exporter status for a *real* seeded order.
 * No login — reads the active unit's records (available offline from the demo
 * seed) and projects header + per-piece status + % woven + latest check-in
 * photos. An unknown order shows a friendly not-found that never echoes the raw
 * id back to the viewer.
 */
export default function ExporterMockPage() {
  const { orderId = '' } = useParams();
  const { t, lang } = useT();
  const recs = useRecords();

  const view = useMemo(() => buildView(recs, orderId), [recs, orderId]);

  return (
    <div className="min-h-dvh bg-bg">
      {/* Demo mock banner */}
      <div className="bg-saffron-ink px-4 py-2 text-center text-sm font-bold text-white">
        {t('exporter.badge')}
      </div>

      <header className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3">
        <span className="text-lg font-bold text-indigo">{t('slip.poweredBy')}</span>
        <span className="text-base text-muted">{t('exporter.title')}</span>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {!view ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <Package aria-hidden="true" size={48} className="text-muted" />
            <p className="text-2xl text-ink">{t('exporter.notFound')}</p>
          </div>
        ) : (
          <>
            {/* Order summary */}
            <section className="mb-5 rounded-2xl border border-line bg-surface p-4 shadow-card">
              <h1 className="num mb-3 text-3xl font-bold text-ink">{view.orderNo}</h1>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
                <dt className="text-muted">{t('exporter.exporter')}</dt>
                <dd className="text-ink">{view.exporter}</dd>
                <dt className="text-muted">{t('exporter.design')}</dt>
                <dd className="text-ink">{view.design}</dd>
                <dt className="text-muted">{t('exporter.quality')}</dt>
                <dd className="text-ink">{view.quality}</dd>
                <dt className="text-muted">{t('exporter.size')}</dt>
                <dd className="num text-ink">{view.size}</dd>
              </dl>
            </section>

            {/* Stats */}
            <section className="mb-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-line bg-surface p-3 text-center shadow-card">
                <div className="num text-2xl font-bold text-ink">{view.pieceCount}</div>
                <div className="text-sm text-muted">{t('exporter.pieces')}</div>
              </div>
              <div className="rounded-2xl border border-ok/20 bg-ok/5 p-3 text-center shadow-card">
                <div className="num text-2xl font-bold text-ok">{view.finished}</div>
                <div className="text-sm text-muted">{t('exporter.finished')}</div>
              </div>
              <div className="rounded-2xl border border-indigo/20 bg-indigo/5 p-3 text-center shadow-card">
                <div className="num text-2xl font-bold text-indigo">{view.onLoom}</div>
                <div className="text-sm text-muted">{t('exporter.onLoom')}</div>
              </div>
            </section>

            {/* Avg % woven bar */}
            <section className="mb-5 rounded-2xl border border-line bg-surface p-4 shadow-card">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-base text-ink">{t('exporter.avgWoven')}</span>
                <span className="num text-2xl font-bold text-indigo">{view.avgWoven}%</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={view.avgWoven} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-indigo transition-all" style={{ width: `${view.avgWoven}%` }} />
              </div>
            </section>

            {/* Board legend (live board source of truth) */}
            <section className="mb-5 rounded-2xl border border-line bg-surface p-4 shadow-card" data-testid="board-legend">
              <h2 className="mb-3 text-base font-medium text-ink">{t('home.board.title')}</h2>
              <div className="grid grid-cols-5 gap-2">
                {view.legend.map((l) => {
                  const Icon = l.icon;
                  return (
                    <div key={l.key} className="flex flex-col items-center gap-1">
                      <span aria-hidden="true" className={cn('flex h-8 w-full items-center justify-center rounded-lg', l.cls)}>
                        <Icon size={16} strokeWidth={2.5} />
                      </span>
                      <span className="num text-lg font-bold text-ink" data-testid={`legend-${l.key}`}>{l.count}</span>
                      <span className="text-center text-xs text-muted">{t(`board.${l.key}`)}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Est. dispatch (projected from weaving pace) */}
            <section className="mb-5 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-saffron/20 text-saffron-ink">
                <Truck size={22} />
              </span>
              <span className="flex-1 text-base text-ink">{t('exporter.estDispatch')}</span>
              <span className="text-xl font-bold text-ink" data-testid="est-dispatch">{formatDay(view.estDispatch, lang, 'medium')}</span>
            </section>

            {/* Piece status list */}
            <section className="mb-5">
              <h2 className="mb-2 text-base font-medium text-ink">{t('exporter.pieceStatus')}</h2>
              <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                {view.pieces.map((p) => (
                  <li key={p.pieceId} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                    <span className="num flex-1 text-base font-medium text-ink">{p.pieceId}</span>
                    <span className="num text-base text-muted">{p.pctWoven}%</span>
                    <span className={cn('rounded-full px-3 py-1 text-sm font-medium', statusTone[p.status])}>
                      {t(`status.${p.status}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Latest check-in photos (real, via PhotoThumb) */}
            <section className="mb-5">
              <h2 className="mb-2 text-base font-medium text-ink">{t('exporter.loomPhotos')}</h2>
              <div className="grid grid-cols-3 gap-3" data-testid="checkin-photos">
                {view.photos.length > 0 ? (
                  view.photos.map((ph) => (
                    <PhotoThumb
                      key={ph.key}
                      id={ph.photoId}
                      alt={`${t('exporter.loomPhotos')} ${ph.pieceId}`}
                      size={110}
                      className="aspect-square w-full"
                    />
                  ))
                ) : (
                  [0, 1, 2].map((i) => (
                    <div key={i} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-surface text-muted">
                      <ImageIcon aria-hidden="true" size={28} />
                      <span className="text-xs">{t('exporter.photoPlaceholder')}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Consent note (J2) */}
            <p className="flex items-start gap-2 rounded-2xl border border-indigo/20 bg-indigo/5 p-3 text-sm text-indigo">
              <Info aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
              {t('exporter.consent')}
            </p>
          </>
        )}
      </main>
    </div>
  );
}

interface ExporterView {
  orderNo: string;
  exporter: string;
  design: string;
  quality: string;
  size: string;
  pieceCount: number;
  finished: number;
  onLoom: number;
  avgWoven: number;
  estDispatch: string;
  legend: { key: string; count: number; cls: string; icon: LucideIcon }[];
  pieces: { pieceId: string; status: PieceStatus; pctWoven: number }[];
  photos: { key: string; pieceId: string; photoId: string }[];
}

/** Project the exporter view from real records; null when the order is unknown. */
function buildView(recs: Rec[], orderId: string): ExporterView | null {
  if (!orderId || recs.length === 0) return null;
  const wanted = orderId.toUpperCase();
  const order = listOrders(recs).find((o) => o.orderNo.toUpperCase() === wanted);
  if (!order) return null;

  const pieces = listPieces(recs).filter((p) => p.orderId === order.entityId);
  if (pieces.length === 0) return null;

  const finished = pieces.filter((p) => p.status === 'off_loom' || p.status === 'delivered').length;
  const onLoom = pieces.filter((p) => p.status === 'on_loom').length;
  const avgWoven = pieces.length
    ? Math.round(pieces.reduce((s, p) => s + p.pctWoven, 0) / pieces.length)
    : 0;

  // Est. dispatch from pace: project the slowest in-progress piece to 100% using
  // its weaving pace (pctWoven since its first check-in), then pad for finishing.
  const estDispatch = estimateDispatch(recs, pieces);

  // Latest check-in photo per piece (real photoIds), newest first, up to 3.
  const checkins = recs.filter((r) => r.type === 'checkin') as Rec<CheckinP>[];
  const pieceIds = new Set(pieces.map((p) => p.pieceId));
  const latestByPiece = new Map<string, Rec<CheckinP>>();
  for (const r of checkins) {
    if (!pieceIds.has(r.payload.pieceId)) continue;
    if (!(r.photoIds && r.photoIds.length)) continue;
    const cur = latestByPiece.get(r.payload.pieceId);
    if (!cur || r.at > cur.at) latestByPiece.set(r.payload.pieceId, r);
  }
  const photos = [...latestByPiece.values()]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 3)
    .map((r) => ({ key: r.id, pieceId: r.payload.pieceId, photoId: r.photoIds![0] }));

  // Board legend = live loom board counts (single source of truth).
  // Mirrors the owner-home board (SPEC-012/017): colour + icon + dark/strong
  // fills keep every count label ≥ 4.5:1 (no_wool = #1f2430 ink on #d8dbe3 grey).
  const board = loomBoard(recs, new Date().toISOString());
  const legend: ExporterView['legend'] = [
    { key: 'on_track', count: board.filter((b) => b.status === 'on_track').length, cls: 'bg-ok text-white', icon: Check },
    { key: 'slow', count: board.filter((b) => b.status === 'slow').length, cls: 'bg-saffron-ink text-white', icon: Clock },
    { key: 'idle', count: board.filter((b) => b.status === 'idle').length, cls: 'bg-madder text-white', icon: Pause },
    { key: 'no_wool', count: board.filter((b) => b.status === 'no_wool').length, cls: 'bg-[#d8dbe3] text-[#1f2430]', icon: Package },
    { key: 'free', count: board.filter((b) => b.status === 'free').length, cls: 'bg-line text-[#464d60]', icon: Circle },
  ];

  return {
    orderNo: order.orderNo,
    exporter: order.exporter,
    design: order.design,
    quality: order.quality,
    size: `${formatFtIn(order.lengthIn)} × ${formatFtIn(order.widthIn)}`,
    pieceCount: pieces.length,
    finished,
    onLoom,
    avgWoven,
    estDispatch,
    legend,
    pieces: pieces
      .sort((a, b) => a.seq - b.seq)
      .map((p) => ({ pieceId: p.pieceId, status: p.status, pctWoven: p.pctWoven })),
    photos,
  };
}

/**
 * Deterministic dispatch estimate (YYYY-MM-DD) projected from weaving pace. For
 * each in-progress piece we project days-to-100% from its check-in pace, take
 * the slowest, and pad +10 days for washing/finishing. Falls back to +30 days
 * when there is no measurable progress yet.
 */
function estimateDispatch(recs: Rec[], pieces: { pieceId: string; pctWoven: number; status: PieceStatus }[]): string {
  const checkins = recs.filter((r) => r.type === 'checkin') as Rec<CheckinP>[];
  let maxRemainingDays = 0;
  let anyPace = false;

  for (const p of pieces) {
    if (p.status === 'off_loom' || p.status === 'delivered') continue;
    const pcc = checkins
      .filter((r) => r.payload.pieceId === p.pieceId)
      .sort((a, b) => (a.at < b.at ? -1 : 1));
    if (pcc.length < 1 || p.pctWoven <= 0 || p.pctWoven >= 100) continue;
    const firstAt = Date.parse(pcc[0].at);
    const elapsedDays = Math.max(1, (Date.now() - firstAt) / DAY_MS);
    const pacePerDay = p.pctWoven / elapsedDays; // % per day
    if (pacePerDay <= 0) continue;
    anyPace = true;
    const remainingDays = (100 - p.pctWoven) / pacePerDay;
    if (remainingDays > maxRemainingDays) maxRemainingDays = remainingDays;
  }

  const padDays = anyPace ? Math.ceil(maxRemainingDays) + 10 : 30;
  const d = new Date(Date.now() + padDays * DAY_MS);
  return d.toISOString().slice(0, 10);
}
