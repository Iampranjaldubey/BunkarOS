import { describe, it, expect } from 'vitest';
import { computeGross, settle } from './wage';

describe('wage engine', () => {
  it('SPEC-M02 AC1: ₹12,000 salary, W=26, 2 absent, 1 half, 3h OT @ ₹58 → paid ₹10,020 after ₹1,000 advance', () => {
    const b = computeGross({ payType: 'monthly', ratePaise: 1_200_000, workingDays: 26, present: 23, half: 1, absent: 2, otHours: 3, otRatePaise: 5_800, pieces: 0 });
    expect(b.perDayPaise).toBe(46_154);
    expect(b.absentDeductPaise).toBe(92_308);
    expect(b.halfDeductPaise).toBe(23_077);
    expect(b.grossPaise).toBe(1_084_615);
    expect(b.otPaise).toBe(17_400);
    const s = settle(b, [], 100_000);
    expect(s.advanceRecoveredPaise).toBe(100_000);
    expect(s.netPaise).toBe(1_002_015);
    expect(s.paidPaise).toBe(1_002_000);
    expect(s.roundingPaise).toBe(-15);
  });
  it('daily: present × rate + half × rate/2', () => {
    const b = computeGross({ payType: 'daily', ratePaise: 40_000, workingDays: 26, present: 20, half: 2, absent: 4, otHours: 0, otRatePaise: 0, pieces: 0 });
    expect(b.grossPaise).toBe(840_000);
  });
  it('piece: Σ entries', () => {
    const b = computeGross({ payType: 'piece', ratePaise: 1_500, workingDays: 26, present: 0, half: 0, absent: 0, otHours: 0, otRatePaise: 0, pieces: 40, pieceAmountPaise: 61_000 });
    expect(b.grossPaise).toBe(61_000);
  });
  it('advance recovery is capped by what is payable and by the balance; user may lower it', () => {
    const b = computeGross({ payType: 'daily', ratePaise: 30_000, workingDays: 26, present: 2, half: 0, absent: 0, otHours: 0, otRatePaise: 0, pieces: 0 });
    expect(settle(b, [], 500_000).advanceRecoveredPaise).toBe(60_000);
    expect(settle(b, [{ label: 'x', amountPaise: 10_000 }], 500_000).advanceRecoveredPaise).toBe(50_000);
    expect(settle(b, [], 20_000, 5_000).advanceRecoveredPaise).toBe(5_000);
    expect(settle(b, [], 20_000, 99_999).advanceRecoveredPaise).toBe(20_000);
  });
  it('net never pays negative', () => {
    const b = computeGross({ payType: 'monthly', ratePaise: 100_000, workingDays: 26, present: 0, half: 0, absent: 26, otHours: 0, otRatePaise: 0, pieces: 0 });
    const s = settle(b, [{ label: 'd', amountPaise: 50_000 }], 0);
    expect(s.paidPaise).toBe(0);
  });
});
