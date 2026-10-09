// Bunkar OS — entity list projections (pure). D5 piece status, yarn balances.
import type {
  Rec, LoomP, WeaverP, ThekedarP, UserP, OrderP, SettingP,
  PieceAssignP, PieceStatusP, BazaarP, CheckinP, YarnIssueP, YarnReturnP, Holder,
} from '../db/types.ts';
import { latestEntities, recsOfType } from './records.ts';

export type PieceStatus = 'not_started' | 'on_loom' | 'off_loom' | 'delivered' | 'on_hold';

export interface Piece {
  pieceId: string;
  orderId: string;
  orderNo: string;
  seq: number;
  design: string;
  quality: string;
  colour: string;
  lengthIn: number;
  widthIn: number;
  exporter: string;
  loomId?: string;
  weaverId?: string;
  status: PieceStatus;
  wovenIn: number;
  pctWoven: number;
  lastCheckinAt?: string;
  bazaarId?: string;
}

export function listLooms(recs: Rec[]): LoomP[] {
  return latestEntities<LoomP>(recs, 'loom');
}
export function listWeavers(recs: Rec[]): WeaverP[] {
  return latestEntities<WeaverP>(recs, 'weaver');
}
export function listThekedars(recs: Rec[]): ThekedarP[] {
  return latestEntities<ThekedarP>(recs, 'thekedar');
}
export function listUsers(recs: Rec[]): UserP[] {
  return latestEntities<UserP>(recs, 'user');
}
export function listOrders(recs: Rec[]): OrderP[] {
  return latestEntities<OrderP>(recs, 'order');
}
export function getSettings(recs: Rec[]): SettingP | undefined {
  const s = latestEntities<SettingP>(recs, 'setting');
  return s[0];
}

/** Build the piece list across all orders with derived status (D5). */
export function listPieces(recs: Rec[]): Piece[] {
  const orders = listOrders(recs);
  const assigns = recsOfType<PieceAssignP>(recs, 'piece_assign');
  const statuses = recsOfType<PieceStatusP>(recs, 'piece_status');
  const bazaars = recsOfType<BazaarP>(recs, 'bazaar');
  const checkins = recsOfType<CheckinP>(recs, 'checkin');

  const pieces: Piece[] = [];
  for (const o of orders) {
    for (const pc of o.pieces) {
      const pieceId = pc.pieceId;
      const assign = latestFor(assigns, (r) => r.payload.pieceId === pieceId);
      const bazaar = latestFor(bazaars, (r) => r.payload.pieceId === pieceId);
      const pieceCheckins = checkins.filter((r) => r.payload.pieceId === pieceId);

      const wovenIn = pieceCheckins.reduce((sum, r) => sum + r.payload.wovenIn, 0);
      const pctWoven =
        o.lengthIn > 0 ? Math.min(100, Math.round((wovenIn / o.lengthIn) * 100)) : 0;
      const lastCheckinAt = pieceCheckins.reduce<string | undefined>(
        (acc, r) => (acc === undefined || r.at > acc ? r.at : acc),
        undefined,
      );

      pieces.push({
        pieceId,
        orderId: o.entityId,
        orderNo: o.orderNo,
        seq: pc.seq,
        design: o.design,
        quality: o.quality,
        colour: o.colour,
        lengthIn: o.lengthIn,
        widthIn: o.widthIn,
        exporter: o.exporter,
        loomId: assign?.payload.loomId,
        weaverId: assign?.payload.weaverId,
        status: pieceStatus(statuses, assign, bazaar, pieceId),
        wovenIn,
        pctWoven,
        lastCheckinAt,
        bazaarId: bazaar?.id,
      });
    }
  }
  return pieces;
}

/**
 * D5 status precedence:
 *  on_hold   if latest piece_status is 'on_hold' (a later 'resumed' clears it)
 *  delivered if latest piece_status is 'delivered'
 *  off_loom  if a non-reversed bazaar exists
 *  on_loom   if assigned (piece_assign exists)
 *  not_started otherwise
 */
function pieceStatus(
  statuses: Rec<PieceStatusP>[],
  assign: Rec<PieceAssignP> | undefined,
  bazaar: Rec<BazaarP> | undefined,
  pieceId: string,
): PieceStatus {
  const latestStatus = latestFor(statuses, (r) => r.payload.pieceId === pieceId);
  if (latestStatus) {
    if (latestStatus.payload.status === 'on_hold') return 'on_hold';
    if (latestStatus.payload.status === 'delivered') return 'delivered';
    // 'resumed' falls through to the loom/bazaar derivation
  }
  if (bazaar) return 'off_loom';
  if (assign) return 'on_loom';
  return 'not_started';
}

/** Latest record (max at) in `arr` matching `pred`. */
function latestFor<T>(arr: Rec<T>[], pred: (r: Rec<T>) => boolean): Rec<T> | undefined {
  let best: Rec<T> | undefined;
  for (const r of arr) {
    if (!pred(r)) continue;
    if (!best || r.at >= best.at) best = r;
  }
  return best;
}

// ---------------- yarn balances ----------------

export interface YarnBalanceRow {
  holderKey: string;
  holder: Holder;
  shade: string;
  lot: string;
  grams: number; // issued - returned
  oldestIssueDay?: string;
}

function holderKey(h: Holder): string {
  return h.kind === 'loom' ? `loom:${h.loomId}` : `thekedar:${h.thekedarId}`;
}

/** Net yarn balance grouped by holder + shade + lot, with oldest issue day. */
export function yarnBalances(recs: Rec[]): YarnBalanceRow[] {
  const map = new Map<string, YarnBalanceRow>();
  const key = (h: Holder, shade: string, lot: string) => `${holderKey(h)}|${shade}|${lot}`;

  for (const r of recsOfType<YarnIssueP>(recs, 'yarn_issue')) {
    const p = r.payload;
    const k = key(p.holder, p.shade, p.lot);
    const row = map.get(k) ?? { holderKey: holderKey(p.holder), holder: p.holder, shade: p.shade, lot: p.lot, grams: 0 };
    row.grams += p.grams;
    if (row.oldestIssueDay === undefined || r.day < row.oldestIssueDay) row.oldestIssueDay = r.day;
    map.set(k, row);
  }
  for (const r of recsOfType<YarnReturnP>(recs, 'yarn_return')) {
    const p = r.payload;
    const k = key(p.holder, p.shade, p.lot);
    const row = map.get(k) ?? { holderKey: holderKey(p.holder), holder: p.holder, shade: p.shade, lot: p.lot, grams: 0 };
    row.grams -= p.grams;
    map.set(k, row);
  }
  return [...map.values()];
}

/** Total issued vs returned grams for a single piece (loom-held yarn). */
export function pieceYarn(recs: Rec[], pieceId: string): { issuedG: number; returnedG: number } {
  let issuedG = 0;
  let returnedG = 0;
  for (const r of recsOfType<YarnIssueP>(recs, 'yarn_issue')) {
    if (r.payload.holder.kind === 'loom' && r.payload.holder.pieceId === pieceId) issuedG += r.payload.grams;
  }
  for (const r of recsOfType<YarnReturnP>(recs, 'yarn_return')) {
    if (r.payload.holder.kind === 'loom' && r.payload.holder.pieceId === pieceId) returnedG += r.payload.grams;
  }
  return { issuedG, returnedG };
}
