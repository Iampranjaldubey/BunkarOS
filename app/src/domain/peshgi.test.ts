import { describe, it, expect } from 'vitest';
import type { PeshgiP, BazaarP, TauliResult } from '../db/types.ts';
import { rec } from './_testutil.ts';
import { peshgiBalance, peshgiLedger } from './peshgi.ts';

const emptyTauli: TauliResult = {
  issuedG: 0, returnedG: 0, usedG: 0, wastagePct: 3, allowedG: 0, gapG: 0, shortG: 0, extraG: 0,
};

function bazaar(weaverId: string, recovered: number): BazaarP {
  return {
    pieceId: 'P1', loomId: 'l1', weaverId,
    lengthIn: 96, widthIn: 60, areaSqft: 40, carpetGrams: 8000,
    rateId: 'r1', ratePaise: 5000, rateUnit: 'sqft',
    grossPaise: 200000, deductions: [], peshgiRecoveredPaise: recovered,
    netPaise: 200000 - recovered, paidPaise: 200000 - recovered, roundingPaise: 0,
    payment: { cashPaise: 200000 - recovered, upiPaise: 0 }, tauli: emptyTauli,
  };
}

describe('peshgi ledger & balance', () => {
  it('tracks multiple gives and recoveries chronologically', () => {
    const recs = [
      rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w1', amountPaise: 500000, mode: 'cash' }, { day: '2026-10-01', at: '2026-10-01T10:00:00Z' }),
      rec<BazaarP>('bazaar', bazaar('w1', 100000), { day: '2026-10-03', at: '2026-10-03T10:00:00Z' }),
      rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w1', amountPaise: 200000, mode: 'upi' }, { day: '2026-10-05', at: '2026-10-05T10:00:00Z' }),
      rec<BazaarP>('bazaar', bazaar('w1', 300000), { day: '2026-10-07', at: '2026-10-07T10:00:00Z' }),
    ];
    const ledger = peshgiLedger(recs, 'weaver', 'w1');
    expect(ledger.map((e) => e.balanceAfterPaise)).toEqual([500000, 400000, 600000, 300000]);
    expect(peshgiBalance(recs, 'weaver', 'w1')).toBe(300000);
  });

  it('isolates per person', () => {
    const recs = [
      rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w1', amountPaise: 500000, mode: 'cash' }),
      rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w2', amountPaise: 100000, mode: 'cash' }),
    ];
    expect(peshgiBalance(recs, 'weaver', 'w1')).toBe(500000);
    expect(peshgiBalance(recs, 'weaver', 'w2')).toBe(100000);
  });

  it('thekedar peshgi gives count, bazaar recoveries do not apply', () => {
    const recs = [
      rec<PeshgiP>('peshgi', { personKind: 'thekedar', personId: 't1', amountPaise: 300000, mode: 'cash' }),
      rec<BazaarP>('bazaar', { ...bazaar('t1', 100000) }),
    ];
    expect(peshgiBalance(recs, 'thekedar', 't1')).toBe(300000);
  });
});
