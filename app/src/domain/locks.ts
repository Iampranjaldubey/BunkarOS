import type { Rec, PeriodLockP } from '../db/types.ts';
import { recsOfType } from './records.ts';

/** Months currently locked (a lock is undone by reversing it). */
export function lockedMonths(recs: Rec[]): Set<string> {
  return new Set(recsOfType<PeriodLockP>(recs, 'period_lock').map((r) => r.payload.month));
}
export function isDayLocked(recs: Rec[], day: string): boolean {
  return lockedMonths(recs).has(day.slice(0, 7));
}
