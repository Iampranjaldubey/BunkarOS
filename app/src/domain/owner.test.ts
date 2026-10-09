import { describe, it, expect } from 'vitest';
import type {
  LoomP, OrderP, PieceAssignP, CheckinP, PeshgiP, BazaarP, WeaverP, ThekedarP,
  UserP, TauliResult,
} from '../db/types.ts';
import { rec } from './_testutil.ts';
import { loomsFreeSoon, peshgiOutstanding, todayEntriesByUser } from './owner.ts';

const NOW = '2026-10-09T06:00:00Z'; // IST day 2026-10-09

function loom(id: string, code = id.toUpperCase()): LoomP {
  return { entityId: id, code, village: 'V', widthIn: 72, weaverIds: [], active: true };
}
function order(pieceId: string, lengthIn = 100): OrderP {
  return {
    entityId: `ord-${pieceId}`, orderNo: pieceId, exporter: 'E', design: 'D', quality: 'Q', colour: 'C',
    lengthIn, widthIn: 72, count: 1, pieces: [{ pieceId, seq: 1 }],
  };
}

const okTauli: TauliResult = {
  issuedG: 0, returnedG: 0, usedG: 0, wastagePct: 3, allowedG: 0, gapG: 0, shortG: 0, extraG: 0,
};

describe('loomsFreeSoon (SPEC-017 AC3)', () => {
  it('pace 2 in/day with 20 in remaining → free in ~10 days', () => {
    // length 100, woven 80 → remaining 20. Assigned 40 days ago; last check-in
    // woven 80 by 2026-10-09 → pace 80/40 = 2 in/day → 10 more days.
    const recs = [
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1', 100)),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-08-30' }), // 40 days ago
      rec<CheckinP>('checkin', { pieceId: 'P1', loomId: 'l1', wovenIn: 80 }, { day: '2026-10-09' }),
    ];
    const rows = loomsFreeSoon(recs, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ loomId: 'l1', code: 'L1', pieceId: 'P1', daysLeft: 10, estimate: true });
    expect(rows[0].freeDay).toBe('2026-10-19'); // 2026-10-09 + 10 days
  });

  it('skips looms with pace 0 (no progress) and those beyond the window', () => {
    const recs = [
      // pace 0 → no check-in progress → skipped
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1', 100)),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-09-01' }),
      // far away: length 1000, woven 10 over 40 days → pace 0.25 → remaining 990 → ~3960 days
      rec<LoomP>('loom', loom('l2')),
      rec<OrderP>('order', order('P2', 1000)),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P2', loomId: 'l2' }, { day: '2026-08-30' }),
      rec<CheckinP>('checkin', { pieceId: 'P2', loomId: 'l2', wovenIn: 10 }, { day: '2026-10-09' }),
    ];
    expect(loomsFreeSoon(recs, NOW)).toHaveLength(0);
  });

  it('sorts by freeDay ascending', () => {
    const recs = [
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1', 100)),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-08-30' }),
      rec<CheckinP>('checkin', { pieceId: 'P1', loomId: 'l1', wovenIn: 80 }, { day: '2026-10-09' }), // 10 days

      rec<LoomP>('loom', loom('l2')),
      rec<OrderP>('order', order('P2', 100)),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P2', loomId: 'l2' }, { day: '2026-08-30' }),
      rec<CheckinP>('checkin', { pieceId: 'P2', loomId: 'l2', wovenIn: 90 }, { day: '2026-10-09' }), // pace 2.25 → remaining 10 → 5 days
    ];
    const rows = loomsFreeSoon(recs, NOW);
    expect(rows.map((r) => r.loomId)).toEqual(['l2', 'l1']);
  });

  it('an estimate that already elapsed is clamped to today (never negative days)', () => {
    // Assigned 70 days ago, 80 of 100 in woven by a check-in 35 days ago:
    // pace 80/70 ≈ 1.14 in/day → 20 in left → 18 days after the old check-in = 17 days ago.
    const recs = [
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1', 100)),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-07-31' }),
      rec<CheckinP>('checkin', { pieceId: 'P1', loomId: 'l1', wovenIn: 80 }, { day: '2026-09-04' }),
    ];
    const rows = loomsFreeSoon(recs, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].daysLeft).toBe(0);
    expect(rows[0].freeDay).toBe('2026-10-09');
  });
});

describe('peshgiOutstanding (SPEC-017 AC4)', () => {
  it('sums positive balances across weavers and thekedars with names', () => {
    const recs = [
      rec<WeaverP>('weaver', { entityId: 'w1', name: 'Rafiq', fatherName: 'F', village: 'V', phone: '9', phoneType: 'keypad', active: true }),
      rec<ThekedarP>('thekedar', { entityId: 't1', name: 'Shamim', phone: '9', village: 'V', active: true }),
      // weaver w1: +4000 given
      rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w1', amountPaise: 400000, mode: 'cash' }),
      // thekedar t1: +2000 given
      rec<PeshgiP>('peshgi', { personKind: 'thekedar', personId: 't1', amountPaise: 200000, mode: 'cash' }),
    ];
    const out = peshgiOutstanding(recs);
    expect(out.totalPaise).toBe(600000);
    expect(out.people).toHaveLength(2);
    expect(out.people.find((p) => p.id === 'w1')).toMatchObject({ kind: 'weaver', name: 'Rafiq', balancePaise: 400000 });
    expect(out.people.find((p) => p.id === 't1')).toMatchObject({ kind: 'thekedar', name: 'Shamim', balancePaise: 200000 });
  });

  it('excludes zero and negative balances (fully recovered)', () => {
    const recs = [
      rec<WeaverP>('weaver', { entityId: 'w1', name: 'Rafiq', fatherName: 'F', village: 'V', phone: '9', phoneType: 'keypad', active: true }),
      rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w1', amountPaise: 100000, mode: 'cash' }),
      // bazaar recovers the full 1000 → balance 0 → excluded
      rec<BazaarP>('bazaar', {
        pieceId: 'P', loomId: 'l', weaverId: 'w1', lengthIn: 96, widthIn: 60, areaSqft: 40, carpetGrams: 8000,
        rateId: 'r', ratePaise: 5000, rateUnit: 'sqft', grossPaise: 200000, deductions: [],
        peshgiRecoveredPaise: 100000, netPaise: 100000, paidPaise: 100000, roundingPaise: 0,
        payment: { cashPaise: 100000, upiPaise: 0 }, tauli: okTauli,
      }),
    ];
    const out = peshgiOutstanding(recs);
    expect(out.totalPaise).toBe(0);
    expect(out.people).toHaveLength(0);
  });
});

describe('todayEntriesByUser (SPEC-017 AC5)', () => {
  it('counts non-reversed records authored today per user, excluding weaver/system', () => {
    const recs = [
      rec<UserP>('user', { entityId: 'u-ramesh', name: 'Ramesh', phone: '9', role: 'munshi', pinHash: 'h', pinSalt: 's', active: true }),
      rec<UserP>('user', { entityId: 'u-owner', name: 'Malik', phone: '9', role: 'owner', pinHash: 'h', pinSalt: 's', active: true }),
      // 2 entries by Ramesh today
      rec<PeshgiP>('peshgi', { personKind: 'weaver', personId: 'w1', amountPaise: 100, mode: 'cash' }, { by: 'u-ramesh', role: 'munshi', day: '2026-10-09' }),
      rec<CheckinP>('checkin', { pieceId: 'P', loomId: 'l', wovenIn: 5 }, { by: 'u-ramesh', role: 'munshi', day: '2026-10-09' }),
      // 1 by owner today
      rec<CheckinP>('checkin', { pieceId: 'P', loomId: 'l', wovenIn: 5 }, { by: 'u-owner', role: 'owner', day: '2026-10-09' }),
      // yesterday → excluded
      rec<CheckinP>('checkin', { pieceId: 'P', loomId: 'l', wovenIn: 5 }, { by: 'u-ramesh', role: 'munshi', day: '2026-10-08' }),
      // weaver slip_response → excluded
      rec<CheckinP>('checkin', { pieceId: 'P', loomId: 'l', wovenIn: 5 }, { by: 'weaver:x', role: 'weaver', day: '2026-10-09' }),
    ];
    const rows = todayEntriesByUser(recs, '2026-10-09');
    expect(rows.find((r) => r.userId === 'u-ramesh')).toMatchObject({ name: 'Ramesh', role: 'munshi', count: 2 });
    expect(rows.find((r) => r.userId === 'u-owner')).toMatchObject({ name: 'Malik', role: 'owner', count: 1 });
    expect(rows.some((r) => r.role === 'weaver')).toBe(false);
  });
});
