// Bunkar OS — record filtering helpers (pure). Shared by all projections.
import type { Rec, RecordType, ReversalP } from '../db/types.ts';

/**
 * Records that count toward business projections:
 *  - exclude records rejected by the server (sync === 'rejected'),
 *  - exclude reversal records themselves,
 *  - exclude any record targeted by a (non-rejected) reversal.
 */
export function activeRecords(recs: Rec[]): Rec[] {
  const reversedTargets = new Set<string>();
  for (const r of recs) {
    if (r.type === 'reversal' && r.sync !== 'rejected') {
      const p = r.payload as ReversalP;
      if (p && typeof p.targetId === 'string') reversedTargets.add(p.targetId);
    }
  }
  return recs.filter(
    (r) => r.sync !== 'rejected' && r.type !== 'reversal' && !reversedTargets.has(r.id),
  );
}

/**
 * Latest version per entityId for a versioned master type.
 * "Latest" = max `at` (ties broken by later position in the array).
 * Operates on active records only.
 */
export function latestEntities<P extends { entityId: string }>(
  recs: Rec[],
  type: RecordType,
): P[] {
  const active = activeRecords(recs).filter((r) => r.type === type);
  const byEntity = new Map<string, Rec>();
  for (const r of active) {
    const prev = byEntity.get((r.payload as P).entityId);
    if (!prev || r.at >= prev.at) byEntity.set((r.payload as P).entityId, r);
  }
  return [...byEntity.values()].map((r) => r.payload as P);
}

/** All active records of a given type, in input order. */
export function recsOfType<P>(recs: Rec[], type: RecordType): Rec<P>[] {
  return activeRecords(recs).filter((r) => r.type === type) as Rec<P>[];
}
