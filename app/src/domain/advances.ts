// Advances (peshgi/kharcha) and their recovery (pure).
import type { Rec, AdvanceP, WagePaymentP } from '../db/types.ts';
import { recsOfType } from './records.ts';

export interface AdvanceRow { recId: string; day: string; amountPaise: number; mode: 'cash' | 'upi'; note?: string; by: string; }

export function advancesFor(recs: Rec[], workerId: string): AdvanceRow[] {
  return recsOfType<AdvanceP>(recs, 'advance').filter((r) => r.payload.workerId === workerId)
    .map((r) => ({ recId: r.id, day: r.day, amountPaise: r.payload.amountPaise, mode: r.payload.mode, note: r.payload.note, by: r.by }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
}
/** Outstanding = Σ advances − Σ recovered in payments (never negative). */
export function advanceBalance(recs: Rec[], workerId: string, uptoDay?: string): number {
  let given = 0; let recovered = 0;
  for (const r of recsOfType<AdvanceP>(recs, 'advance')) if (r.payload.workerId === workerId && (!uptoDay || r.day <= uptoDay)) given += r.payload.amountPaise;
  for (const r of recsOfType<WagePaymentP>(recs, 'wage_payment')) if (r.payload.workerId === workerId && (!uptoDay || r.day <= uptoDay)) recovered += r.payload.advanceRecoveredPaise;
  return Math.max(0, given - recovered);
}
export function allAdvanceBalances(recs: Rec[], workerIds: string[]): Map<string, number> {
  return new Map(workerIds.map((w) => [w, advanceBalance(recs, w)]));
}
export function lastPayment(recs: Rec[], workerId: string): Rec<WagePaymentP> | undefined {
  let best: Rec<WagePaymentP> | undefined;
  for (const r of recsOfType<WagePaymentP>(recs, 'wage_payment')) if (r.payload.workerId === workerId && (!best || r.payload.month > best.payload.month)) best = r;
  return best;
}
