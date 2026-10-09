import { describe, it, expect } from 'vitest';
import type { LoomP, OrderP, PieceAssignP, CheckinP, SettingP, YarnIssueP, NormP } from '../db/types.ts';
import { rec } from './_testutil.ts';
import { loomBoard } from './board.ts';

const settings: SettingP = {
  entityId: 'unit', unitName: 'U', ownerPhone: '9', lang: 'hi',
  photoRequiredAbovePaise: 200000, wastagePct: 3,
  idleYellowDays: 4, idleRedDays: 7,
  openingCashPaise: 0, openingCashDay: '2026-09-01',
};

function loom(id: string): LoomP {
  return { entityId: id, code: id.toUpperCase(), village: 'V', widthIn: 72, weaverIds: [], active: true };
}
function order(pieceId: string): OrderP {
  return { entityId: `ord-${pieceId}`, orderNo: pieceId, exporter: 'E', design: 'D', quality: 'Q', colour: 'C', lengthIn: 119, widthIn: 72, count: 1, pieces: [{ pieceId, seq: 1 }] };
}

const NOW = '2026-10-09T06:00:00Z'; // IST day 2026-10-09

/** A generous wool issue so a piece is NOT no_wool (used by the status tests). */
function wool(pieceId: string, loomId: string, grams = 30_000): YarnIssueP {
  return { holder: { kind: 'loom', loomId, pieceId }, shade: 'Red', lot: 'L', grams } as YarnIssueP;
}

describe('loomBoard (D9) thresholds', () => {
  it('free loom when no on_loom piece', () => {
    const recs = [rec<LoomP>('loom', loom('l1')), rec<SettingP>('setting', settings)];
    const board = loomBoard(recs, NOW);
    expect(board[0].status).toBe('free');
    expect(board[0].daysSinceProgress).toBeNull();
  });

  it('on_track below 4 days', () => {
    const recs = [
      rec<SettingP>('setting', settings),
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1')),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-10-01' }),
      rec<YarnIssueP>('yarn_issue', wool('P1', 'l1'), { day: '2026-10-01' }),
      rec<CheckinP>('checkin', { pieceId: 'P1', loomId: 'l1', wovenIn: 10 }, { day: '2026-10-06' }), // 3 days ago
    ];
    expect(loomBoard(recs, NOW)[0].status).toBe('on_track');
    expect(loomBoard(recs, NOW)[0].daysSinceProgress).toBe(3);
  });

  it('slow at exactly 4 days (yellow)', () => {
    const recs = [
      rec<SettingP>('setting', settings),
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1')),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-10-01' }),
      rec<YarnIssueP>('yarn_issue', wool('P1', 'l1'), { day: '2026-10-01' }),
      rec<CheckinP>('checkin', { pieceId: 'P1', loomId: 'l1', wovenIn: 10 }, { day: '2026-10-05' }), // 4 days ago
    ];
    expect(loomBoard(recs, NOW)[0].status).toBe('slow');
    expect(loomBoard(recs, NOW)[0].daysSinceProgress).toBe(4);
  });

  it('idle at exactly 7 days (red)', () => {
    const recs = [
      rec<SettingP>('setting', settings),
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1')),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-10-01' }),
      rec<YarnIssueP>('yarn_issue', wool('P1', 'l1'), { day: '2026-10-01' }),
      rec<CheckinP>('checkin', { pieceId: 'P1', loomId: 'l1', wovenIn: 10 }, { day: '2026-10-02' }), // 7 days ago
    ];
    expect(loomBoard(recs, NOW)[0].status).toBe('idle');
    expect(loomBoard(recs, NOW)[0].daysSinceProgress).toBe(7);
  });

  it('falls back to assignment day when no progress checkin', () => {
    const recs = [
      rec<SettingP>('setting', settings),
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1')),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-10-02' }), // 7 days ago
      rec<YarnIssueP>('yarn_issue', wool('P1', 'l1'), { day: '2026-10-02' }),
    ];
    expect(loomBoard(recs, NOW)[0].status).toBe('idle');
  });

  it('checkins with wovenIn 0 do not count as progress', () => {
    const recs = [
      rec<SettingP>('setting', settings),
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1')),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-10-01' }),
      rec<YarnIssueP>('yarn_issue', wool('P1', 'l1'), { day: '2026-10-01' }),
      rec<CheckinP>('checkin', { pieceId: 'P1', loomId: 'l1', wovenIn: 0 }, { day: '2026-10-09' }),
    ];
    // no progress since assignment 2026-10-01 -> 8 days -> idle
    expect(loomBoard(recs, NOW)[0].status).toBe('idle');
  });
});

describe('loomBoard no_wool status (SPEC-017)', () => {
  it('no_wool when an on_loom piece never had wool issued', () => {
    const recs = [
      rec<SettingP>('setting', settings),
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1')),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-10-08' }),
      // fresh check-in → would be on_track, but no wool was ever issued
      rec<CheckinP>('checkin', { pieceId: 'P1', loomId: 'l1', wovenIn: 10 }, { day: '2026-10-09' }),
    ];
    expect(loomBoard(recs, NOW)[0].status).toBe('no_wool');
  });

  it('no_wool takes precedence over idle', () => {
    const recs = [
      rec<SettingP>('setting', settings),
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1')),
      // assigned long ago, no check-in and no wool → idle AND no_wool → no_wool wins
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-10-01' }),
    ];
    expect(loomBoard(recs, NOW)[0].status).toBe('no_wool');
  });

  it('no_wool when estimated remaining wool <= 0 (norm x area x remaining fraction)', () => {
    // order P1 is 119 in long x 72 wide → area = 119*72/144 = 59.5 sqft.
    // norm 300 g/sqft → full carpet needs 300*59.5 = 17850 g.
    // woven 60 in of 119 → pctWoven 50% → remaining fraction 0.5 → remaining need 8925 g.
    // issued only 8000 g → remaining estimate (8000 - 8925) < 0 → no_wool.
    const recs = [
      rec<SettingP>('setting', settings),
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1')),
      rec<NormP>('norm', { entityId: 'n1', quality: 'Q', gramsPerSqft: 300 }, { day: '2026-09-01' }),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-10-01' }),
      rec<YarnIssueP>('yarn_issue', { holder: { kind: 'loom', loomId: 'l1', pieceId: 'P1' }, shade: 'R', lot: 'L', grams: 8000 } as YarnIssueP, { day: '2026-10-01' }),
      rec<CheckinP>('checkin', { pieceId: 'P1', loomId: 'l1', wovenIn: 60 }, { day: '2026-10-08' }), // 1 day ago → not idle
    ];
    expect(loomBoard(recs, NOW)[0].status).toBe('no_wool');
  });

  it('on_track when enough wool remains for the woven fraction', () => {
    // Same geometry but 30 kg issued → plenty remaining → stays on_track.
    const recs = [
      rec<SettingP>('setting', settings),
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1')),
      rec<NormP>('norm', { entityId: 'n1', quality: 'Q', gramsPerSqft: 300 }, { day: '2026-09-01' }),
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-10-01' }),
      rec<YarnIssueP>('yarn_issue', { holder: { kind: 'loom', loomId: 'l1', pieceId: 'P1' }, shade: 'R', lot: 'L', grams: 30_000 } as YarnIssueP, { day: '2026-10-01' }),
      rec<CheckinP>('checkin', { pieceId: 'P1', loomId: 'l1', wovenIn: 60 }, { day: '2026-10-08' }),
    ];
    expect(loomBoard(recs, NOW)[0].status).toBe('on_track');
  });

  it('no norm: only a total lack of wool triggers no_wool (cannot estimate remaining)', () => {
    const recs = [
      rec<SettingP>('setting', settings),
      rec<LoomP>('loom', loom('l1')),
      rec<OrderP>('order', order('P1')),
      // no norm; small wool issue, fresh check-in → cannot estimate remaining → on_track
      rec<PieceAssignP>('piece_assign', { pieceId: 'P1', loomId: 'l1' }, { day: '2026-10-01' }),
      rec<YarnIssueP>('yarn_issue', { holder: { kind: 'loom', loomId: 'l1', pieceId: 'P1' }, shade: 'R', lot: 'L', grams: 500 } as YarnIssueP, { day: '2026-10-01' }),
      rec<CheckinP>('checkin', { pieceId: 'P1', loomId: 'l1', wovenIn: 10 }, { day: '2026-10-08' }),
    ];
    expect(loomBoard(recs, NOW)[0].status).toBe('on_track');
  });
});
