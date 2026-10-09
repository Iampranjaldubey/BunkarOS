// Bunkar OS — weaverPassbook includes job payments for weaver workers (SPEC-016).
import { describe, it, expect } from 'vitest';
import type { BazaarP, JobP, TauliResult } from '../db/types.ts';
import { rec } from './_testutil.ts';
import { weaverPassbook, listJobs, computeJob, jobRateFor } from './projections.ts';

const emptyTauli: TauliResult = {
  issuedG: 0, returnedG: 0, usedG: 0, wastagePct: 3, allowedG: 0, gapG: 0, shortG: 0, extraG: 0,
};

function bazaar(weaverId: string, paid: number, day: string) {
  return rec<BazaarP>('bazaar', {
    pieceId: 'P1', loomId: 'l1', weaverId,
    lengthIn: 96, widthIn: 60, areaSqft: 40, carpetGrams: 8000,
    rateId: 'r1', ratePaise: 5000, rateUnit: 'sqft',
    grossPaise: paid, deductions: [], peshgiRecoveredPaise: 0,
    netPaise: paid, paidPaise: paid, roundingPaise: 0,
    payment: { cashPaise: paid, upiPaise: 0 }, tauli: emptyTauli,
  }, { day, at: `${day}T10:00:00.000Z` });
}

function jobRec(weaverId: string | undefined, kind: JobP['workerKind'], paid: number, day: string) {
  return rec<JobP>('job', {
    workerKind: kind, workerId: weaverId, work: 'straightening', unit: 'kg', grams: 12500,
    rateId: 'r1', ratePaise: 700, amountPaise: 8750, paidPaise: paid, roundingPaise: 50,
    payment: { cashPaise: paid, upiPaise: 0 },
  }, { day, at: `${day}T11:00:00.000Z` });
}

describe('weaverPassbook includes job payments', () => {
  it('shows a weaver job payment as a passbook line', () => {
    const recs = [
      bazaar('w1', 195500, '2026-10-01'),
      jobRec('w1', 'weaver', 8800, '2026-10-02'),
      jobRec('w2', 'weaver', 8800, '2026-10-02'), // other weaver, excluded
      jobRec(undefined, 'other', 8800, '2026-10-02'), // 'other' worker, excluded
    ];
    const pb = weaverPassbook(recs, 'w1');
    const jobLine = pb.find((e) => e.kind === 'job');
    expect(jobLine).toBeDefined();
    expect(jobLine?.amountPaise).toBe(8800);
    // only w1's bazaar + w1's job
    expect(pb.length).toBe(2);
  });
});

describe('projections barrel re-exports job helpers', () => {
  it('exposes listJobs, computeJob, jobRateFor', () => {
    expect(typeof listJobs).toBe('function');
    expect(typeof computeJob).toBe('function');
    expect(typeof jobRateFor).toBe('function');
  });
});
