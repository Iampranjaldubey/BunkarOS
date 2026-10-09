import { describe, it, expect } from 'vitest';
import type { BazaarP, PeshgiP, JobP, TauliResult } from '../db/types.ts';
import { rec } from './_testutil.ts';
import { monthlySummary, monthlyTextHi, monthlyTextEn } from './monthly.ts';

function tauli(usedG: number, shortG: number): TauliResult {
  return { issuedG: usedG, returnedG: 0, usedG, wastagePct: 3, allowedG: 0, gapG: 0, shortG, extraG: 0 };
}

function bazaar(opts: Partial<BazaarP> & { areaSqft: number; grossPaise: number; paidPaise: number; tauli: TauliResult }): BazaarP {
  return {
    pieceId: 'P', loomId: 'l', weaverId: 'w', lengthIn: 96, widthIn: 119,
    carpetGrams: 8000, rateId: 'r', ratePaise: 3800, rateUnit: 'sqft', deductions: [],
    peshgiRecoveredPaise: 0, netPaise: opts.paidPaise, roundingPaise: 0,
    payment: { cashPaise: 0, upiPaise: opts.paidPaise }, ...opts,
  } as BazaarP;
}

describe('monthlySummary (SPEC-018)', () => {
  it('AC1: aggregates the demo month incl. the live bazaar (79.33 sqft, ₹3,014.54 gross, 0.613 kg short)', () => {
    const recs = [
      // the live demo bazaar: area 79.33, gross 301454 paise, used 22900 g, short 613 g
      rec<BazaarP>('bazaar', bazaar({
        areaSqft: 79.33, grossPaise: 301454, paidPaise: 195500,
        peshgiRecoveredPaise: 100000, tauli: tauli(22900, 613),
      }), { day: '2026-10-09' }),
      // a job payment this month: straightening ₹88 paid
      rec<JobP>('job', {
        workerKind: 'weaver', workerId: 'w', work: 'straightening', unit: 'kg', grams: 12500,
        rateId: 'r', ratePaise: 700, amountPaise: 8750, paidPaise: 8800, roundingPaise: 50,
        payment: { cashPaise: 8800, upiPaise: 0 },
      }, { day: '2026-10-05' }),
      // a peshgi given this month
      rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w', amountPaise: 500000, mode: 'cash' }, { day: '2026-10-02' }),
    ];
    const m = monthlySummary(recs, '2026-10');
    expect(m.month).toBe('2026-10');
    expect(m.bazaarCount).toBe(1);
    expect(m.sqftWoven).toBeCloseTo(79.33, 2);
    expect(m.wageBillPaise).toBe(301454 + 8750); // bazaar gross + job amount
    expect(m.paidPaise).toBe(195500 + 8800);       // bazaar paid + job paid
    expect(m.peshgiGivenPaise).toBe(500000);
    expect(m.peshgiRecoveredPaise).toBe(100000);
    expect(m.woolUsedG).toBe(22900);
    expect(m.woolShortG).toBe(613);
    // loss % = 613 / 22900 * 100 = 2.676... → 2.7 (1 dp)
    expect(m.yarnLossPct).toBe(2.7);
  });

  it('AC2: a reversed bazaar is excluded from the month', () => {
    const b = rec<BazaarP>('bazaar', bazaar({
      areaSqft: 50, grossPaise: 200000, paidPaise: 200000, tauli: tauli(10000, 300),
    }), { id: 'bz1', day: '2026-10-09' });
    const recs = [
      b,
      rec('reversal', { targetId: 'bz1', reason: 'wrong' }, { day: '2026-10-09' }),
    ];
    const m = monthlySummary(recs, '2026-10');
    expect(m.bazaarCount).toBe(0);
    expect(m.sqftWoven).toBe(0);
    expect(m.woolUsedG).toBe(0);
    expect(m.yarnLossPct).toBeNull();
  });

  it('only includes records within the month', () => {
    const recs = [
      rec<BazaarP>('bazaar', bazaar({ areaSqft: 10, grossPaise: 1000, paidPaise: 1000, tauli: tauli(100, 0) }), { day: '2026-09-30' }),
      rec<BazaarP>('bazaar', bazaar({ areaSqft: 20, grossPaise: 2000, paidPaise: 2000, tauli: tauli(200, 0) }), { day: '2026-11-01' }),
    ];
    const m = monthlySummary(recs, '2026-10');
    expect(m.bazaarCount).toBe(0);
    expect(m.sqftWoven).toBe(0);
  });

  it('yarnLossPct is null when no wool used', () => {
    const m = monthlySummary([], '2026-10');
    expect(m.woolUsedG).toBe(0);
    expect(m.yarnLossPct).toBeNull();
  });
});

describe('monthly text builders (SPEC-018 AC3)', () => {
  const recs = [
    rec<BazaarP>('bazaar', bazaar({
      areaSqft: 79.33, grossPaise: 301454, paidPaise: 195500, tauli: tauli(22900, 613),
    }), { day: '2026-10-09' }),
  ];
  const m = monthlySummary(recs, '2026-10');

  it('Hindi text uses a human month, one fact per line, and the rejects placeholder', () => {
    const hi = monthlyTextHi(m);
    expect(hi).toContain('अक्टूबर 2026');
    expect(hi).toContain('रिजेक्ट: — (अभी दर्ज नहीं)');
    expect(hi.split('\n').length).toBeGreaterThan(4);
    // area on its own line
    expect(hi).toContain('79.33');
  });

  it('English text uses a human month and one fact per line', () => {
    const en = monthlyTextEn(m);
    expect(en).toContain('October 2026');
    expect(en.split('\n').length).toBeGreaterThan(4);
  });
});
