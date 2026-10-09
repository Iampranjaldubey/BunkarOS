import { describe, it, expect } from 'vitest';
import type { BazaarP, YarnIssueP, YarnReturnP, PeshgiP, RokerP, SlipResponseP, TauliResult, LoomP, OrderP, PieceAssignP, SettingP, CheckinP } from '../db/types.ts';
import { rec } from './_testutil.ts';
import { digest, digestTextHi, digestTextEn } from './digest.ts';

const shortTauli: TauliResult = {
  issuedG: 10000, returnedG: 1000, usedG: 9000, wastagePct: 3, allowedG: 270, gapG: 500, shortG: 230, extraG: 0,
};
const okTauli: TauliResult = {
  issuedG: 0, returnedG: 0, usedG: 0, wastagePct: 3, allowedG: 0, gapG: 0, shortG: 0, extraG: 0,
};

function bazaar(loomId: string, areaSqft: number, cash: number, upi: number, tauli: TauliResult): BazaarP {
  return {
    pieceId: 'P', loomId, weaverId: 'w1', lengthIn: 96, widthIn: 60, areaSqft, carpetGrams: 8000,
    rateId: 'r1', ratePaise: 5000, rateUnit: 'sqft', grossPaise: cash + upi, deductions: [],
    peshgiRecoveredPaise: 0, netPaise: cash + upi, paidPaise: cash + upi, roundingPaise: 0,
    payment: { cashPaise: cash, upiPaise: upi }, tauli,
  };
}

const DAY = '2026-10-09';
const NOW = '2026-10-09T06:00:00Z';

describe('digest counts', () => {
  const recs = [
    rec<BazaarP>('bazaar', bazaar('l1', 40, 200000, 0, shortTauli), { day: DAY }),
    rec<BazaarP>('bazaar', bazaar('l2', 59.5, 0, 300000, okTauli), { day: DAY }),
    rec<BazaarP>('bazaar', bazaar('l3', 10, 0, 0, okTauli), { day: '2026-10-08' }), // other day, excluded
    rec<YarnIssueP>('yarn_issue', { holder: { kind: 'loom', loomId: 'l1', pieceId: 'P' }, shade: 'red', lot: 'A', grams: 10000 }, { day: DAY }),
    rec<YarnIssueP>('yarn_issue', { holder: { kind: 'thekedar', thekedarId: 't1' }, shade: 'blue', lot: 'B', grams: 5000 }, { day: DAY }),
    rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w1', amountPaise: 100000, mode: 'cash' }, { day: DAY }),
    rec<SlipResponseP>('slip_response', { token: 'tok', slipId: 's1', answer: 'dispute' }, { day: DAY }),
    rec<SlipResponseP>('slip_response', { token: 'tok2', slipId: 's2', answer: 'agree' }, { day: DAY }),
    rec<BazaarP>('bazaar', bazaar('l1', 1, 1, 0, okTauli), { day: DAY, sync: 'pending' }),
  ];

  it('aggregates the day correctly', () => {
    const d = digest(recs, DAY, NOW);
    expect(d.bazaarCount).toBe(3); // two + the pending one on DAY
    expect(d.bazaarSqft).toBeCloseTo(100.5, 2); // 40 + 59.5 + 1
    expect(d.woolIssuedG).toBe(15000);
    // K1: total wool held outside (loom l1/P 10 kg + thekedar t1 5 kg), not just today's thekedar issues
    expect(d.woolOutsideG).toBe(15000);
    // K1 "cash paid (from the roker)": bazaar cash 2,000.00 + pending bazaar 0.01 + cash peshgi 1,000.00
    expect(d.cashPaidPaise).toBe(300001);
    expect(d.upiPaidPaise).toBe(300000);
    expect(d.peshgiGivenPaise).toBe(100000);
    expect(d.tauliShortCount).toBe(1);
    expect(d.tauliShortLooms).toEqual(['l1']);
    expect(d.disputes).toBe(1);
    expect(d.pendingSync).toBe(1);
  });

  it('text builders use a human date, one fact per line', () => {
    const d = digest(recs, DAY, NOW);
    const hi = digestTextHi(d);
    expect(hi).toContain('9 अक्टूबर 2026');
    expect(hi).toContain('बाज़ार: 3 कालीन');
    expect(hi).toContain('बुनकर विवाद: 1');
    expect(hi.split('\n').length).toBeGreaterThan(4);
    const en = digestTextEn(d);
    expect(en).toContain('summary for Friday, 9 October 2026');
    expect(en).toContain('Cash spent: ₹3,000 · UPI: ₹3,000'); // summary shows whole rupees
  });

  it('reports idle looms', () => {
    const settings: SettingP = {
      entityId: 'unit', unitName: 'U', ownerPhone: '9', lang: 'hi',
      photoRequiredAbovePaise: 200000, wastagePct: 3, idleYellowDays: 4, idleRedDays: 7,
      openingCashPaise: 0, openingCashDay: '2026-09-01',
    };
    const r2 = [
      rec<SettingP>('setting', settings),
      rec<LoomP>('loom', { entityId: 'l9', code: 'L9', village: 'V', widthIn: 72, weaverIds: [], active: true }),
      rec<OrderP>('order', { entityId: 'o1', orderNo: 'P9', exporter: 'E', design: 'D', quality: 'Q', colour: 'C', lengthIn: 119, widthIn: 72, count: 1, pieces: [{ pieceId: 'P9', seq: 1 }] }),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P9', loomId: 'l9' }, { day: '2026-10-01' }),
      rec<YarnIssueP>('yarn_issue', { holder: { kind: 'loom', loomId: 'l9', pieceId: 'P9' }, shade: 'R', lot: 'L', grams: 30000 }, { day: '2026-10-01' }),
    ];
    const d = digest(r2, DAY, NOW);
    expect(d.idleLooms).toEqual(['l9']);
  });

  it('reports no-wool looms and lists them in the texts (SPEC-017)', () => {
    const settings: SettingP = {
      entityId: 'unit', unitName: 'U', ownerPhone: '9', lang: 'hi',
      photoRequiredAbovePaise: 200000, wastagePct: 3, idleYellowDays: 4, idleRedDays: 7,
      openingCashPaise: 0, openingCashDay: '2026-09-01',
    };
    const r3 = [
      rec<SettingP>('setting', settings),
      rec<LoomP>('loom', { entityId: 'l5', code: '05', village: 'V', widthIn: 72, weaverIds: [], active: true }),
      rec<OrderP>('order', { entityId: 'o5', orderNo: 'P5', exporter: 'E', design: 'D', quality: 'Q', colour: 'C', lengthIn: 119, widthIn: 72, count: 1, pieces: [{ pieceId: 'P5', seq: 1 }] }),
      // assigned + fresh check-in but NO wool issued → no_wool
      rec<PieceAssignP>('piece_assign', { pieceId: 'P5', loomId: 'l5' }, { day: '2026-10-08' }),
      rec<CheckinP>('checkin', { pieceId: 'P5', loomId: 'l5', wovenIn: 5 }, { day: '2026-10-09' }),
    ];
    const d = digest(r3, DAY, NOW);
    expect(d.noWoolLoomCodes).toEqual(['05']);
    expect(digestTextHi(d)).toContain('बिना ऊन के करघे: 1 (05)');
    expect(digestTextEn(d)).toContain('No-wool looms: 1 (05)');
  });
});

describe('digest K1 money, wool outside and orders at risk', () => {
  const settings: SettingP = {
    entityId: 'unit', unitName: 'U', ownerPhone: '9', lang: 'hi',
    photoRequiredAbovePaise: 200000, wastagePct: 3, idleYellowDays: 4, idleRedDays: 7,
    openingCashPaise: 4250000, openingCashDay: '2026-10-09',
  };
  const order = (id: string, no: string, due: string | undefined, n: number): OrderP => ({
    entityId: id, orderNo: no, exporter: 'E', design: 'D', quality: 'Q', colour: 'C', lengthIn: 96, widthIn: 120,
    count: n, dueDate: due, pieces: Array.from({ length: n }, (_, i) => ({ pieceId: `${no}/0${i + 1}`, seq: i + 1 })),
  });

  it('cash and UPI paid equal the roker day totals (PRD demo: ₹8,000 cash, ₹1,955 UPI)', () => {
    const r = [
      rec<SettingP>('setting', settings),
      rec<PeshgiP>('peshgi', { personKind: 'thekedar', personId: 't1', amountPaise: 200000, mode: 'cash' }),
      rec<RokerP>('roker', { dir: 'out', mode: 'cash', amountPaise: 600000, head: 'dyer' }),
      rec<RokerP>('roker', { dir: 'in', mode: 'cash', amountPaise: 50000, head: 'receipt' }), // money in is not "paid"
      rec<BazaarP>('bazaar', bazaar('l7', 79.33, 0, 195500, okTauli)),
    ];
    const d = digest(r, DAY, NOW);
    expect(d.cashPaidPaise).toBe(800000);
    expect(d.upiPaidPaise).toBe(195500);
    expect(d.peshgiGivenPaise).toBe(200000);
  });

  it('wool outside is the balance as of the end of the day', () => {
    const r = [
      rec<YarnIssueP>('yarn_issue', { holder: { kind: 'loom', loomId: 'l1', pieceId: 'P1' }, shade: 'red', lot: 'L', grams: 10000 }, { day: '2026-09-01' }),
      rec<YarnReturnP>('yarn_return', { holder: { kind: 'loom', loomId: 'l1', pieceId: 'P1' }, shade: 'red', lot: 'L', grams: 1000 }, { day: '2026-09-20' }),
      rec<YarnIssueP>('yarn_issue', { holder: { kind: 'thekedar', thekedarId: 't1' }, shade: 'blue', lot: 'B', grams: 2000 }, { day: DAY }),
      rec<YarnIssueP>('yarn_issue', { holder: { kind: 'thekedar', thekedarId: 't1' }, shade: 'blue', lot: 'B', grams: 7000 }, { day: '2026-10-10' }),
    ];
    const d = digest(r, DAY, NOW);
    expect(d.woolIssuedG).toBe(2000);
    expect(d.woolOutsideG).toBe(11000); // 10 − 1 + 2; tomorrow's 7 kg not counted
  });

  it('flags overdue, due-soon and idle-loom orders; finished orders are never at risk', () => {
    const r = [
      rec<SettingP>('setting', settings),
      rec<LoomP>('loom', { entityId: 'l9', code: '09', village: 'V', widthIn: 72, weaverIds: [], active: true }),
      rec<OrderP>('order', order('o1', 'EX-101', '2026-10-01', 1)),             // overdue
      rec<OrderP>('order', order('o2', 'EX-102', '2026-10-20', 1)),             // due in 11 days
      rec<OrderP>('order', order('o3', 'EX-103', '2026-12-31', 1)),             // piece on idle loom
      rec<OrderP>('order', order('o4', 'EX-104', '2026-12-31', 1)),             // not started, far due: fine
      rec<OrderP>('order', order('o5', 'EX-105', '2026-10-01', 1)),             // overdue but finished
      rec<PieceAssignP>('piece_assign', { pieceId: 'EX-103/01', loomId: 'l9' }, { day: '2026-09-25' }),
      rec<YarnIssueP>('yarn_issue', { holder: { kind: 'loom', loomId: 'l9', pieceId: 'EX-103/01' }, shade: 'R', lot: 'L', grams: 30000 }, { day: '2026-09-25' }),
      rec<BazaarP>('bazaar', { ...bazaar('l5', 50, 0, 0, okTauli), pieceId: 'EX-105/01' }, { day: '2026-09-30' }),
    ];
    const d = digest(r, DAY, NOW);
    expect(d.idleLoomCodes).toEqual(['09']);
    expect(d.ordersAtRisk.map((o) => [o.orderNo, o.reason])).toEqual([
      ['EX-101', 'overdue'], ['EX-102', 'due_soon'], ['EX-103', 'idle_loom'],
    ]);
    expect(digestTextHi(d)).toContain('खतरे में ऑर्डर: EX-101, EX-102, EX-103');
    expect(digestTextEn(d)).toContain('Idle looms: 1 (09)');
  });
});
