import type { Rec, PeriodLockP } from '../db/types.ts';
import { recsOfType } from './records.ts';

/** Months currently locked (a lock is undone by reversing it). */
export function lockedMonths(recs: Rec[]): Set<string> {
  return new Set(recsOfType<PeriodLockP>(recs, 'period_lock').map((r) => r.payload.month));
}
export function isDayLocked(recs: Rec[], day: string): boolean {
  return lockedMonths(recs).has(day.slice(0, 7));
}
/**
 * SPEC-M16 §2 (same rule as server/rules.mjs): an entry belongs to a locked month when its day is in one,
 * or, for a wage payment, when the paid month is locked. Such entries cannot be reversed by anyone;
 * the lock itself can (that is the unlock).
 */
export function isRecordLocked(locked: Set<string>, r: Rec): boolean {
  if (r.type === 'period_lock') return false;
  if (locked.has(r.day.slice(0, 7))) return true;
  const month = r.type === 'wage_payment' ? (r.payload as { month?: string }).month : undefined;
  return typeof month === 'string' && locked.has(month);
}
