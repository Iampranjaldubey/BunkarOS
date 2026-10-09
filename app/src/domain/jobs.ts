// Bunkar OS — SPEC-016 ancillary job payments (kg / day / piece). Pure.
// Work paid independently of weaving: untying & straightening by kg, helpers by
// day, "other" by piece. amount = round(qty × rate); paid = half-up rupee.
import type { Rec, RateP, JobP, WorkKind } from '../db/types.ts';
import { activeRecords, recsOfType } from './records.ts';
import { roundToRupee } from './money.ts';

export type JobUnit = 'kg' | 'day' | 'piece';
export type JobWork = Exclude<WorkKind, 'weaving'>;

/**
 * Latest non-reversed/-rejected rate record whose `work` and `unit` match and
 * whose effectiveFrom <= onDay. Rates without `work` are weaving rates and are
 * never returned for a job. Ties on effectiveFrom broken by `at`.
 */
export function jobRateFor(recs: Rec[], work: JobWork, unit: JobUnit, onDay: string): RateP | undefined {
  const active = activeRecords(recs);
  const matches = active
    .filter((r) => r.type === 'rate')
    .map((r) => ({ at: r.at, p: r.payload as RateP }))
    .filter((x) => x.p.work === work && x.p.unit === unit && x.p.effectiveFrom <= onDay);
  if (matches.length === 0) return undefined;
  matches.sort((a, b) =>
    a.p.effectiveFrom === b.p.effectiveFrom
      ? a.at.localeCompare(b.at)
      : a.p.effectiveFrom.localeCompare(b.p.effectiveFrom),
  );
  return matches[matches.length - 1].p;
}

export interface JobAmount {
  amountPaise: number;
  paidPaise: number;
  roundingPaise: number;
}

/**
 * Compute a job's money from quantity + rate.
 * kg   → grams (integer > 0); qty = grams / 1000.
 * day  → days (multiple of 0.5, > 0).
 * piece→ count (integer ≥ 1).
 * amount = round(qty × ratePaise); paid = half-up rupee; rounding = paid - amount.
 */
export function computeJob(input: {
  unit: JobUnit;
  grams?: number;
  days?: number;
  count?: number;
  ratePaise: number;
}): JobAmount {
  const { unit, grams, days, count, ratePaise } = input;
  if (!Number.isFinite(ratePaise) || ratePaise < 0) {
    throw new RangeError('computeJob: ratePaise must be >= 0');
  }

  let qty: number;
  if (unit === 'kg') {
    if (grams === undefined || !Number.isInteger(grams) || grams <= 0) {
      throw new RangeError('computeJob: kg job needs an integer grams > 0');
    }
    qty = grams / 1000;
  } else if (unit === 'day') {
    if (days === undefined || !Number.isFinite(days) || days <= 0 || Math.round(days * 2) !== days * 2) {
      throw new RangeError('computeJob: day job needs a multiple of 0.5 > 0');
    }
    qty = days;
  } else if (unit === 'piece') {
    if (count === undefined || !Number.isInteger(count) || count < 1) {
      throw new RangeError('computeJob: piece job needs an integer count >= 1');
    }
    qty = count;
  } else {
    throw new RangeError(`computeJob: invalid unit '${unit as string}'`);
  }

  const amountPaise = Math.round(qty * ratePaise);
  const { paid, rounding } = roundToRupee(amountPaise);
  return { amountPaise, paidPaise: paid, roundingPaise: rounding };
}

export interface JobRow {
  recId: string;
  day: string;
  at: string;
  payload: JobP;
}

/** Active job records, newest first (reversed/rejected ignored). */
export function listJobs(recs: Rec[]): JobRow[] {
  const rows = recsOfType<JobP>(recs, 'job').map((r) => ({
    recId: r.id,
    day: r.day,
    at: r.at,
    payload: r.payload,
  }));
  rows.sort((a, b) => (a.day === b.day ? b.at.localeCompare(a.at) : b.day.localeCompare(a.day)));
  return rows;
}
