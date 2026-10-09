import { describe, it, expect } from 'vitest';
import type { OrderP, PieceAssignP, PieceStatusP, BazaarP, CheckinP, TauliResult } from '../db/types.ts';
import { rec } from './_testutil.ts';
import { listPieces, pieceYarn, yarnBalances } from './pieces.ts';
import type { YarnIssueP, YarnReturnP } from '../db/types.ts';

const emptyTauli: TauliResult = {
  issuedG: 0, returnedG: 0, usedG: 0, wastagePct: 3, allowedG: 0, gapG: 0, shortG: 0, extraG: 0,
};

function order(): OrderP {
  return { entityId: 'o1', orderNo: 'EX-1', exporter: 'E', design: 'D', quality: 'Q', colour: 'C', lengthIn: 100, widthIn: 72, count: 1, pieces: [{ pieceId: 'EX-1/01', seq: 1 }] };
}

describe('listPieces status (D5)', () => {
  it('not_started with no records', () => {
    expect(listPieces([rec<OrderP>('order', order())])[0].status).toBe('not_started');
  });

  it('on_loom when assigned', () => {
    const recs = [rec<OrderP>('order', order()), rec<PieceAssignP>('piece_assign', { pieceId: 'EX-1/01', loomId: 'l1', weaverId: 'w1' })];
    const p = listPieces(recs)[0];
    expect(p.status).toBe('on_loom');
    expect(p.loomId).toBe('l1');
    expect(p.weaverId).toBe('w1');
  });

  it('off_loom when bazaar exists', () => {
    const bz: BazaarP = {
      pieceId: 'EX-1/01', loomId: 'l1', weaverId: 'w1', lengthIn: 100, widthIn: 72, areaSqft: 50, carpetGrams: 8000,
      rateId: 'r', ratePaise: 5000, rateUnit: 'sqft', grossPaise: 250000, deductions: [], peshgiRecoveredPaise: 0,
      netPaise: 250000, paidPaise: 250000, roundingPaise: 0, payment: { cashPaise: 250000, upiPaise: 0 }, tauli: emptyTauli,
    };
    const recs = [rec<OrderP>('order', order()), rec<PieceAssignP>('piece_assign', { pieceId: 'EX-1/01', loomId: 'l1' }), rec<BazaarP>('bazaar', bz)];
    expect(listPieces(recs)[0].status).toBe('off_loom');
  });

  it('on_hold overrides, resumed clears', () => {
    const base = [rec<OrderP>('order', order()), rec<PieceAssignP>('piece_assign', { pieceId: 'EX-1/01', loomId: 'l1' })];
    const held = [...base, rec<PieceStatusP>('piece_status', { pieceId: 'EX-1/01', status: 'on_hold' }, { at: '2026-10-02T10:00:00Z' })];
    expect(listPieces(held)[0].status).toBe('on_hold');
    const resumed = [...held, rec<PieceStatusP>('piece_status', { pieceId: 'EX-1/01', status: 'resumed' }, { at: '2026-10-03T10:00:00Z' })];
    expect(listPieces(resumed)[0].status).toBe('on_loom');
  });

  it('delivered status', () => {
    const recs = [rec<OrderP>('order', order()), rec<PieceStatusP>('piece_status', { pieceId: 'EX-1/01', status: 'delivered' })];
    expect(listPieces(recs)[0].status).toBe('delivered');
  });

  it('pctWoven capped at 100', () => {
    const recs = [
      rec<OrderP>('order', order()),
      rec<PieceAssignP>('piece_assign', { pieceId: 'EX-1/01', loomId: 'l1' }),
      rec<CheckinP>('checkin', { pieceId: 'EX-1/01', loomId: 'l1', wovenIn: 60 }),
      rec<CheckinP>('checkin', { pieceId: 'EX-1/01', loomId: 'l1', wovenIn: 60 }),
    ];
    const p = listPieces(recs)[0];
    expect(p.wovenIn).toBe(120);
    expect(p.pctWoven).toBe(100); // 120/100 -> capped
  });
});

describe('yarn balances', () => {
  it('pieceYarn and yarnBalances net issue - return', () => {
    const recs = [
      rec<YarnIssueP>('yarn_issue', { holder: { kind: 'loom', loomId: 'l1', pieceId: 'EX-1/01' }, shade: 'red', lot: 'A', grams: 10000 }, { day: '2026-10-01' }),
      rec<YarnReturnP>('yarn_return', { holder: { kind: 'loom', loomId: 'l1', pieceId: 'EX-1/01' }, shade: 'red', lot: 'A', grams: 1500 }, { day: '2026-10-05' }),
    ];
    expect(pieceYarn(recs, 'EX-1/01')).toEqual({ issuedG: 10000, returnedG: 1500 });
    const bal = yarnBalances(recs);
    expect(bal[0].grams).toBe(8500);
    expect(bal[0].oldestIssueDay).toBe('2026-10-01');
  });
});
