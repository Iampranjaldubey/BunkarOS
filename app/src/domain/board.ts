// Bunkar OS — loom board (D9, K2). Pure.
import type { Rec, CheckinP, PieceAssignP } from '../db/types.ts';
import { listLooms, listPieces, pieceYarn } from './pieces.ts';
import { getSettings } from './pieces.ts';
import { normFor } from './rates.ts';
import { areaSqft } from './units.ts';
import { recsOfType } from './records.ts';
import { istDay, daysBetween } from './ids.ts';

export type LoomStatus = 'on_track' | 'slow' | 'idle' | 'no_wool' | 'free';

export interface LoomBoardRow {
  loomId: string;
  code: string;
  status: LoomStatus;
  daysSinceProgress: number | null; // null when free
  pieceId?: string;
}

/**
 * D9 + SPEC-017 loomBoard:
 *  - loom with no on_loom piece → 'free'.
 *  - else if the on_loom piece has NO wool at all, or the estimated remaining
 *    wool is <= 0 (norm × area × remaining fraction) → 'no_wool'
 *    (precedence no_wool > idle > slow > on_track).
 *  - else by days since last checkin with wovenIn>0 (or since assignment):
 *      >= idleRedDays    → 'idle'
 *      >= idleYellowDays → 'slow'
 *      else              → 'on_track'
 * Thresholds come from settings (defaults 4 yellow / 7 red).
 */
export function loomBoard(recs: Rec[], nowISO: string): LoomBoardRow[] {
  const settings = getSettings(recs);
  const yellow = settings?.idleYellowDays ?? 4;
  const red = settings?.idleRedDays ?? 7;
  const today = istDay(nowISO);

  const looms = listLooms(recs);
  const pieces = listPieces(recs);
  const checkins = recsOfType<CheckinP>(recs, 'checkin');
  const assigns = recsOfType<PieceAssignP>(recs, 'piece_assign');

  return looms.map((loom) => {
    const onLoomPiece = pieces.find((p) => p.loomId === loom.entityId && p.status === 'on_loom');
    if (!onLoomPiece) {
      return { loomId: loom.entityId, code: loom.code, status: 'free' as const, daysSinceProgress: null };
    }

    // last progress day for this piece
    let progressDay: string | undefined;
    for (const r of checkins) {
      if (r.payload.pieceId === onLoomPiece.pieceId && r.payload.wovenIn > 0) {
        if (progressDay === undefined || r.day > progressDay) progressDay = r.day;
      }
    }
    if (progressDay === undefined) {
      // fall back to the latest assignment day for the piece
      for (const r of assigns) {
        if (r.payload.pieceId === onLoomPiece.pieceId) {
          if (progressDay === undefined || r.day > progressDay) progressDay = r.day;
        }
      }
    }

    const days = progressDay === undefined ? 0 : daysBetween(progressDay, today);

    // SPEC-017: no_wool wins over every other busy status.
    if (pieceIsOutOfWool(recs, onLoomPiece)) {
      return {
        loomId: loom.entityId,
        code: loom.code,
        status: 'no_wool',
        daysSinceProgress: days,
        pieceId: onLoomPiece.pieceId,
      };
    }

    let status: LoomStatus;
    if (days >= red) status = 'idle';
    else if (days >= yellow) status = 'slow';
    else status = 'on_track';

    return {
      loomId: loom.entityId,
      code: loom.code,
      status,
      daysSinceProgress: days,
      pieceId: onLoomPiece.pieceId,
    };
  });
}

/**
 * SPEC-017 no_wool test for an on_loom piece:
 *  - no wool ever issued to the piece → true; OR
 *  - a norm exists and the estimated remaining wool is <= 0:
 *      need(full)      = norm(g/sqft) × area(sqft)
 *      need(remaining) = need(full) × (1 − pctWoven/100)
 *      remaining wool  = max(0, issued − returned) − need(remaining)  ... <= 0 → true.
 * Without a norm the remaining cannot be estimated, so only a total lack of
 * wool triggers no_wool.
 */
function pieceIsOutOfWool(
  recs: Rec[],
  piece: { pieceId: string; quality: string; lengthIn: number; widthIn: number; pctWoven: number },
): boolean {
  const { issuedG, returnedG } = pieceYarn(recs, piece.pieceId);
  const have = Math.max(0, issuedG - returnedG);
  if (issuedG <= 0) return true;

  const norm = normFor(recs, piece.quality);
  if (norm === undefined) return false;

  const area = areaSqft(piece.lengthIn, piece.widthIn);
  const remainingFraction = Math.max(0, 1 - piece.pctWoven / 100);
  const needRemaining = norm * area * remainingFraction;
  return have - needRemaining <= 0;
}
