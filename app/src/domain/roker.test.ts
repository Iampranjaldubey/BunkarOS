import { describe, it, expect } from 'vitest';
import type { SettingP, RokerP, BazaarP, PeshgiP, TauliResult, JobP, WeaverP } from '../db/types.ts';
import { rec } from './_testutil.ts';
import { rokerDay } from './roker.ts';

const emptyTauli: TauliResult = {
  issuedG: 0, returnedG: 0, usedG: 0, wastagePct: 3, allowedG: 0, gapG: 0, shortG: 0, extraG: 0,
};

const settings: SettingP = {
  entityId: 'unit', unitName: 'U', ownerPhone: '9', lang: 'hi',
  photoRequiredAbovePaise: 200000, wastagePct: 3,
  idleYellowDays: 4, idleRedDays: 7,
  openingCashPaise: 1000000, openingCashDay: '2026-10-01',
};

function bazaarPay(cash: number, upi: number, recovered = 0): BazaarP {
  return {
    pieceId: 'P1', loomId: 'l1', weaverId: 'w1',
    lengthIn: 96, widthIn: 60, areaSqft: 40, carpetGrams: 8000,
    rateId: 'r1', ratePaise: 5000, rateUnit: 'sqft',
    grossPaise: cash + upi + recovered, deductions: [], peshgiRecoveredPaise: recovered,
    netPaise: cash + upi, paidPaise: cash + upi, roundingPaise: 0,
    payment: { cashPaise: cash, upiPaise: upi }, tauli: emptyTauli,
  };
}

describe('rokerDay (D7) carry-over across 3 days', () => {
  const recs = [
    rec<SettingP>('setting', settings, { day: '2026-10-01' }),
    // day 1: cash out 2000 (bazaar)
    rec<BazaarP>('bazaar', bazaarPay(200000, 0), { day: '2026-10-01' }),
    // day 2: peshgi cash 1000 out + roker receipt cash in 500
    rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w1', amountPaise: 100000, mode: 'cash' }, { day: '2026-10-02' }),
    rec<RokerP>('roker', { dir: 'in', mode: 'cash', amountPaise: 50000, head: 'receipt' }, { day: '2026-10-02' }),
    // day 3: upi out 3000 + peshgi recovery info only
    rec<BazaarP>('bazaar', bazaarPay(0, 300000, 50000), { day: '2026-10-03' }),
  ];

  it('day 1 opening = settings, closing reflects cash out', () => {
    const d1 = rokerDay(recs, '2026-10-01');
    expect(d1.openingCash).toBe(1000000);
    expect(d1.cashOut).toBe(200000);
    expect(d1.closingCash).toBe(800000);
  });

  it('day 2 opening = day 1 closing; nets cash in/out', () => {
    const d2 = rokerDay(recs, '2026-10-02');
    expect(d2.openingCash).toBe(800000);
    expect(d2.cashOut).toBe(100000);
    expect(d2.cashIn).toBe(50000);
    expect(d2.closingCash).toBe(750000);
  });

  it('day 3 opening = day 2 closing; upi out does not change cash; recovery is info', () => {
    const d3 = rokerDay(recs, '2026-10-03');
    expect(d3.openingCash).toBe(750000);
    expect(d3.upiOut).toBe(300000);
    expect(d3.cashOut).toBe(0);
    expect(d3.closingCash).toBe(750000);
    const adjusted = d3.entries.find((e) => e.kind === 'adjusted');
    expect(adjusted?.amountPaise).toBe(50000);
  });
});

describe('rokerDay posts job payments as auto out entries', () => {
  const base = rec<SettingP>('setting', settings, { day: '2026-10-01' });
  const weaver = rec<WeaverP>('weaver', {
    entityId: 'w1', name: 'रमेश', fatherName: 'सीताराम', village: 'V', phone: '9', phoneType: 'smartphone', active: true,
  }, { day: '2026-10-01' });

  function job(cash: number, upi: number, p: Partial<JobP> = {}): JobP {
    return {
      workerKind: 'weaver', workerId: 'w1', work: 'straightening', unit: 'kg', grams: 12500,
      rateId: 'r1', ratePaise: 700, amountPaise: 8750, paidPaise: cash + upi, roundingPaise: 50,
      payment: { cashPaise: cash, upiPaise: upi }, ...p,
    };
  }

  it('splits cash/upi, carries work + worker name/kind on the entry', () => {
    const recs = [
      base, weaver,
      rec<JobP>('job', job(8800, 0), { day: '2026-10-02' }),
      rec<JobP>('job', job(0, 52500, { work: 'helper', unit: 'day', days: 1.5, grams: undefined, workerKind: 'other', workerId: undefined, workerName: 'सोहन', ratePaise: 35000, amountPaise: 52500, roundingPaise: 0 }), { day: '2026-10-02' }),
    ];
    const d = rokerDay(recs, '2026-10-02');
    const jobCash = d.entries.find((e) => e.kind === 'job' && e.mode === 'cash');
    const jobUpi = d.entries.find((e) => e.kind === 'job' && e.mode === 'upi');
    expect(jobCash?.dir).toBe('out');
    expect(jobCash?.amountPaise).toBe(8800);
    expect(jobCash?.auto).toBe(true);
    expect(jobCash?.work).toBe('straightening');
    expect(jobCash?.workerName).toBe('रमेश'); // resolved from weaver master
    expect(jobUpi?.work).toBe('helper');
    expect(jobUpi?.workerName).toBe('सोहन'); // free-text 'other' name
    // cash out includes the ₹88 job, upi out includes the ₹525 job
    expect(d.cashOut).toBe(8800);
    expect(d.upiOut).toBe(52500);
  });
});
