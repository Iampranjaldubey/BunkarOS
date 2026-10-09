// Bunkar OS — SPEC-016 ancillary job payments (kg / day / piece). Pure.
import { describe, it, expect } from 'vitest';
import type { RateP, JobP, Rec } from '../db/types.ts';
import { rec } from './_testutil.ts';
import { jobRateFor, computeJob, listJobs } from './jobs.ts';

function rateRec(
  p: Partial<RateP> & { unit: RateP['unit']; ratePaise: number; effectiveFrom: string },
  opts?: { at?: string; day?: string; sync?: Rec['sync']; id?: string },
): Rec<RateP> {
  return rec<RateP>(
    'rate',
    {
      entityId: p.entityId ?? `rate-${p.unit}-${p.ratePaise}`,
      quality: p.quality ?? '',
      unit: p.unit,
      ratePaise: p.ratePaise,
      effectiveFrom: p.effectiveFrom,
      work: p.work,
    },
    { at: opts?.at, day: opts?.day ?? p.effectiveFrom, sync: opts?.sync, id: opts?.id },
  );
}

describe('jobRateFor', () => {
  it('returns the latest non-reversed rate with matching work+unit, effectiveFrom <= onDay', () => {
    const recs = [
      rateRec({ work: 'straightening', unit: 'kg', ratePaise: 600, effectiveFrom: '2026-08-01' }, { at: '2026-08-01T10:00:00.000Z' }),
      rateRec({ work: 'straightening', unit: 'kg', ratePaise: 700, effectiveFrom: '2026-09-01' }, { at: '2026-09-01T10:00:00.000Z' }),
    ];
    const r = jobRateFor(recs, 'straightening', 'kg', '2026-10-01');
    expect(r?.ratePaise).toBe(700);
  });

  it('ignores rates whose effectiveFrom is after onDay', () => {
    const recs = [
      rateRec({ work: 'untying', unit: 'kg', ratePaise: 900, effectiveFrom: '2026-08-01' }, { at: '2026-08-01T10:00:00.000Z' }),
      rateRec({ work: 'untying', unit: 'kg', ratePaise: 1000, effectiveFrom: '2026-11-01' }, { at: '2026-11-01T10:00:00.000Z' }),
    ];
    const r = jobRateFor(recs, 'untying', 'kg', '2026-10-01');
    expect(r?.ratePaise).toBe(900);
  });

  it('does not match a different work or unit', () => {
    const recs = [rateRec({ work: 'helper', unit: 'day', ratePaise: 35000, effectiveFrom: '2026-08-01' })];
    expect(jobRateFor(recs, 'helper', 'piece', '2026-10-01')).toBeUndefined();
    expect(jobRateFor(recs, 'untying', 'day', '2026-10-01')).toBeUndefined();
  });

  it('treats a rate without `work` as weaving (never a job rate)', () => {
    const recs = [rateRec({ unit: 'kg', ratePaise: 700, effectiveFrom: '2026-08-01' })]; // no work
    expect(jobRateFor(recs, 'straightening', 'kg', '2026-10-01')).toBeUndefined();
  });

  it('ignores reversed/rejected rate records', () => {
    const recs = [
      rateRec({ work: 'straightening', unit: 'kg', ratePaise: 700, effectiveFrom: '2026-09-01', entityId: 'r1' }, { id: 'rate-rejected', sync: 'rejected' }),
      rateRec({ work: 'straightening', unit: 'kg', ratePaise: 600, effectiveFrom: '2026-08-01', entityId: 'r2' }, { at: '2026-08-01T10:00:00.000Z' }),
    ];
    const r = jobRateFor(recs, 'straightening', 'kg', '2026-10-01');
    expect(r?.ratePaise).toBe(600);
  });
});

describe('computeJob', () => {
  it('kg: amount = round(grams/1000 * rate), paid half-up, rounding = paid - amount (AC2)', () => {
    // 12.500 kg @ ₹7/kg (700 paise) = 8750 paise = ₹87.50 -> paid ₹88 (+₹0.50)
    const r = computeJob({ unit: 'kg', grams: 12500, ratePaise: 700 });
    expect(r.amountPaise).toBe(8750);
    expect(r.paidPaise).toBe(8800);
    expect(r.roundingPaise).toBe(50);
  });

  it('day: 1.5 days @ ₹350/day = ₹525 (AC3)', () => {
    const r = computeJob({ unit: 'day', days: 1.5, ratePaise: 35000 });
    expect(r.amountPaise).toBe(52500);
    expect(r.paidPaise).toBe(52500);
    expect(r.roundingPaise).toBe(0);
  });

  it('piece: count * rate', () => {
    const r = computeJob({ unit: 'piece', count: 3, ratePaise: 800000 });
    expect(r.amountPaise).toBe(2400000);
    expect(r.paidPaise).toBe(2400000);
    expect(r.roundingPaise).toBe(0);
  });

  it('kg requires an integer gram quantity > 0', () => {
    expect(() => computeJob({ unit: 'kg', grams: 0, ratePaise: 700 })).toThrow(RangeError);
    expect(() => computeJob({ unit: 'kg', grams: -1, ratePaise: 700 })).toThrow(RangeError);
    expect(() => computeJob({ unit: 'kg', grams: 12.5, ratePaise: 700 })).toThrow(RangeError);
    expect(() => computeJob({ unit: 'kg', ratePaise: 700 })).toThrow(RangeError);
  });

  it('day requires a multiple of 0.5 > 0', () => {
    expect(() => computeJob({ unit: 'day', days: 0, ratePaise: 35000 })).toThrow(RangeError);
    expect(() => computeJob({ unit: 'day', days: 1.25, ratePaise: 35000 })).toThrow(RangeError);
    expect(() => computeJob({ unit: 'day', days: -1, ratePaise: 35000 })).toThrow(RangeError);
  });

  it('piece requires an integer count >= 1', () => {
    expect(() => computeJob({ unit: 'piece', count: 0, ratePaise: 800000 })).toThrow(RangeError);
    expect(() => computeJob({ unit: 'piece', count: 1.5, ratePaise: 800000 })).toThrow(RangeError);
  });

  it('rejects a negative rate', () => {
    expect(() => computeJob({ unit: 'kg', grams: 1000, ratePaise: -1 })).toThrow(RangeError);
  });
});

describe('listJobs', () => {
  it('lists active job records, newest first, ignoring reversed/rejected', () => {
    const job = (id: string, day: string, p: Partial<JobP>): Rec<JobP> =>
      rec<JobP>('job', {
        workerKind: 'weaver', workerId: 'w1', work: 'straightening', unit: 'kg',
        grams: 12500, rateId: 'r1', ratePaise: 700, amountPaise: 8750, paidPaise: 8800, roundingPaise: 50,
        payment: { cashPaise: 8800, upiPaise: 0 }, ...p,
      }, { id, day, at: `${day}T10:00:00.000Z` });
    const recs: Rec[] = [
      job('j1', '2026-10-01', {}),
      job('j2', '2026-10-03', {}),
      job('jr', '2026-10-02', {}),
    ];
    // reverse j1
    recs.push(rec('reversal', { targetId: 'j1', reason: 'x' }, { day: '2026-10-03' }));
    const list = listJobs(recs);
    expect(list.map((j) => j.recId)).toEqual(['j2', 'jr']);
  });
});

/** Tiny deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rnd: () => number, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

describe('computeJob property invariants (500 random jobs, seed 54321)', () => {
  it('amount = round(qty*rate), paid whole-rupee, |rounding| < 50, paid consistent', () => {
    const rnd = mulberry32(54321);
    for (let i = 0; i < 500; i++) {
      const pick = randInt(rnd, 0, 2);
      const ratePaise = randInt(rnd, 100, 100000);
      let r;
      let expectedAmount: number;
      if (pick === 0) {
        const grams = randInt(rnd, 1, 50000);
        r = computeJob({ unit: 'kg', grams, ratePaise });
        expectedAmount = Math.round((grams / 1000) * ratePaise);
      } else if (pick === 1) {
        const days = randInt(rnd, 1, 20) * 0.5;
        r = computeJob({ unit: 'day', days, ratePaise });
        expectedAmount = Math.round(days * ratePaise);
      } else {
        const count = randInt(rnd, 1, 20);
        r = computeJob({ unit: 'piece', count, ratePaise });
        expectedAmount = Math.round(count * ratePaise);
      }
      expect(r.amountPaise).toBe(expectedAmount);
      expect(r.paidPaise % 100).toBe(0);
      expect(r.roundingPaise).toBe(r.paidPaise - r.amountPaise);
      // D6 half-up rounding: rounding delta is in [-49, +50] (ties round up).
      expect(r.roundingPaise).toBeGreaterThanOrEqual(-49);
      expect(r.roundingPaise).toBeLessThanOrEqual(50);
    }
  });
});
