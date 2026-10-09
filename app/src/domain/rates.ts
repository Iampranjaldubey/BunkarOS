// Bunkar OS — rate & norm resolution (D2). Pure.
import type { Rec, RateP, NormP, OrderP, YarnIssueP } from '../db/types.ts';
import { activeRecords, recsOfType, latestEntities } from './records.ts';

/**
 * D2 rateForPiece: the rate record for the piece's quality whose `effectiveFrom`
 * is <= the day of the FIRST non-reversed yarn_issue whose holder.pieceId equals
 * the piece. If there is no such issue, use `onDay`. Returns the latest matching
 * rate (by effectiveFrom, ties by `at`). undefined if none applies.
 */
export function rateForPiece(recs: Rec[], pieceId: string, onDay: string): RateP | undefined {
  const quality = pieceQuality(recs, pieceId);
  if (quality === undefined) return undefined;

  const anchorDay = firstYarnIssueDay(recs, pieceId) ?? onDay;

  const active = activeRecords(recs);
  const rateRecs = active
    .filter((r) => r.type === 'rate')
    .map((r) => ({ at: r.at, p: r.payload as RateP }))
    .filter((x) => x.p.quality === quality && x.p.effectiveFrom <= anchorDay);

  if (rateRecs.length === 0) return undefined;
  rateRecs.sort((a, b) =>
    a.p.effectiveFrom === b.p.effectiveFrom
      ? a.at.localeCompare(b.at)
      : a.p.effectiveFrom.localeCompare(b.p.effectiveFrom),
  );
  return rateRecs[rateRecs.length - 1].p;
}

/** Latest norm (grams per sqft) for a quality, or undefined. */
export function normFor(recs: Rec[], quality: string): number | undefined {
  const norms = latestEntities<NormP>(recs, 'norm').filter((n) => n.quality === quality);
  if (norms.length === 0) return undefined;
  // latestEntities already dedupes by entityId; pick any (there may be multiple
  // norm entities for a quality — take the last defined).
  return norms[norms.length - 1].gramsPerSqft;
}

/** Day of the first non-reversed yarn issue whose holder is this piece. */
function firstYarnIssueDay(recs: Rec[], pieceId: string): string | undefined {
  const issues = recsOfType<YarnIssueP>(recs, 'yarn_issue').filter(
    (r) => r.payload.holder.kind === 'loom' && r.payload.holder.pieceId === pieceId,
  );
  if (issues.length === 0) return undefined;
  let earliest = issues[0].day;
  for (const r of issues) if (r.day < earliest) earliest = r.day;
  return earliest;
}

/** Quality of a piece via its order master. */
export function pieceQuality(recs: Rec[], pieceId: string): string | undefined {
  const orders = latestEntities<OrderP>(recs, 'order');
  for (const o of orders) {
    if (o.pieces.some((pc) => pc.pieceId === pieceId)) return o.quality;
  }
  return undefined;
}
