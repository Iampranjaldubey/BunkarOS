// SPEC-M16 §1: a paid month is shown from the saved payment, and does not move when rates or attendance change later.
import { describe, it, expect } from 'vitest';
import type { Rec, WagePaymentP, WorkerP, SettingP, AttendanceP, AdvanceP } from '../db/types';
import { wageInputsFor, computeGross, settle, buildSnapshot, paidView, liveView, wageSheet } from './wage';
import { isRecordLocked } from './locks';

// Example A as AC1: the unit has overtime on (D-001 default is off).
const settings: SettingP = { entityId: 'unit', unitName: 'U', ownerPhone: '', lang: 'hi', workingDaysPerMonth: 26, photoRequiredAbovePaise: 200_000, holidays: [], overtimeEnabled: true };
let seq = 0;
const rec = <P,>(type: Rec['type'], payload: P, day: string, at = `${day}T10:00:${String(seq++ % 60).padStart(2, '0')}Z`): Rec<P> =>
  ({ id: `r${seq++}`, type, unitId: 'u', payload, by: 'owner', role: 'owner', device: 'd', at, day, sync: 'synced' });
const rafiq = (salaryPaise: number): WorkerP => ({ entityId: 'w1', name: 'Rafiq', jobTitle: 'weaver', payType: 'monthly', salaryPaise, otRatePaise: 5_800, joinedOn: '2026-10-01', active: true });
const mark = (day: string, status: AttendanceP['status'], otHours = 0) => rec<AttendanceP>('attendance', { workerId: 'w1', status, otHours }, day);

/** docs/wage-examples.md Example A (AC1, overtime counted): paid ₹10,020. */
function exampleA() {
  const recs: Rec[] = [
    rec('worker', rafiq(1_200_000), '2026-10-01', '2026-10-01T09:00:00Z'),
    rec<AdvanceP>('advance', { workerId: 'w1', amountPaise: 100_000, mode: 'cash' }, '2026-10-01'),
    mark('2026-10-01', 'absent'), mark('2026-10-02', 'absent'), mark('2026-10-03', 'half'), mark('2026-10-05', 'present', 3),
  ];
  const w = rafiq(1_200_000);
  const inputs = wageInputsFor(recs, w, '2026-10', settings);
  const b = computeGross(inputs);
  const s = settle(b, [], 100_000);
  const payment: WagePaymentP = {
    workerId: 'w1', month: '2026-10', grossPaise: s.grossPaise, otPaise: s.otPaise, deductions: [], advanceRecoveredPaise: s.advanceRecoveredPaise,
    netPaise: s.netPaise, paidPaise: s.paidPaise, roundingPaise: s.roundingPaise, mode: 'cash', snapshot: buildSnapshot(inputs, b, 100_000, s),
  };
  return { recs: [...recs, rec<WagePaymentP>('wage_payment', payment, '2026-10-31')], payment, inputs, b, s };
}

describe('SPEC-M16 §1 paid month from the saved payment', () => {
  it('the snapshot keeps every input the lines need', () => {
    const { payment } = exampleA();
    expect(payment.paidPaise).toBe(1_002_000);
    expect(payment.snapshot).toMatchObject({ present: 1, half: 1, absent: 2, otHours: 3, payType: 'monthly', ratePaise: 1_200_000,
      workingDays: 26, perDayPaise: 46_154, absentDeductPaise: 92_308, halfDeductPaise: 23_077, otRatePaise: 5_800, advanceOutstandingPaise: 100_000 });
  });

  it('paidView = the pay screen lines at the time of payment', () => {
    const { payment, inputs, b, s } = exampleA();
    const v = paidView(payment);
    expect(v).toEqual(liveView(inputs, b, s)); // identical to what the owner saw before confirming
    expect(v.lines).toEqual([
      { kind: 'base', key: 'base', amountPaise: 1_200_000 },
      { kind: 'absent', key: 'absent_deduct', n: 2, amountPaise: -92_308 },
      { kind: 'half', key: 'half_deduct', n: 1, amountPaise: -23_077 },
      { kind: 'ot', key: 'overtime', hours: 3, ratePaise: 5_800, amountPaise: 17_400 },
      { kind: 'advance', key: 'advance_recovered', amountPaise: -100_000 },
      { kind: 'rounding', key: 'rounding', amountPaise: -15 },
    ]);
    expect([v.paidPaise, v.balanceAfterPaise, v.present, v.half, v.absent, v.otHours]).toEqual([1_002_000, 0, 1, 1, 2, 3]);
  });

  it('a later salary change and a later attendance mark change nothing in the paid month', () => {
    const { recs, payment } = exampleA();
    const before = paidView(payment);
    // Owner raises the salary to ₹15,000 and someone marks another absence in October afterwards.
    const later = [...recs, rec('worker', rafiq(1_500_000), '2026-11-02', '2026-11-02T09:00:00Z'), mark('2026-10-06', 'absent')];
    const stored = later.find((r) => r.type === 'wage_payment')!.payload as WagePaymentP;
    expect(paidView(stored)).toEqual(before);
    // The wage sheet's paid row uses the snapshot too, not the new salary or the new mark.
    const [row] = wageSheet(later, [rafiq(1_500_000)], '2026-10', settings);
    expect(row.payment?.payload.paidPaise).toBe(1_002_000);
    expect([row.inputs.ratePaise, row.inputs.absent, row.inputs.present]).toEqual([1_200_000, 2, 1]);
    // Today's live view of the same month would differ — that is what the paid view must not show.
    const live = computeGross(wageInputsFor(later, rafiq(1_500_000), '2026-10', settings));
    expect(live.grossPaise).not.toBe(stored.grossPaise);
  });

  it('an old payment without the new snapshot fields shows base and one combined deduction from the stored record', () => {
    const old: WagePaymentP = { workerId: 'w1', month: '2026-08', grossPaise: 1_084_615, otPaise: 0, deductions: [], advanceRecoveredPaise: 0,
      netPaise: 1_084_615, paidPaise: 1_084_600, roundingPaise: -15, mode: 'cash',
      snapshot: { present: 23, half: 1, absent: 2, otHours: 0, pieces: 0, payType: 'monthly', ratePaise: 1_200_000 } };
    const v = paidView(old);
    expect(v.lines).toEqual([{ kind: 'base', key: 'base', amountPaise: 1_200_000 }, { kind: 'attendanceDeduct', amountPaise: -115_385 }, { kind: 'rounding', key: 'rounding', amountPaise: -15 }]);
    expect(v.lines.reduce((sum, l) => sum + l.amountPaise, 0)).toBe(v.paidPaise);
    expect(v.balanceAfterPaise).toBeUndefined();
  });

  it('lines always add up to the amount paid (daily worker)', () => {
    const daily: WagePaymentP = { workerId: 'w2', month: '2026-11', grossPaise: 900_000, otPaise: 0, deductions: [{ label: 'tools', amountPaise: 10_000 }],
      advanceRecoveredPaise: 50_000, netPaise: 840_000, paidPaise: 840_000, roundingPaise: 0, mode: 'upi',
      snapshot: { present: 18, half: 1, absent: 1, otHours: 0, pieces: 0, payType: 'daily', ratePaise: 40_000, workingDays: 26, perDayPaise: 40_000, absentDeductPaise: 0, halfDeductPaise: 0, otRatePaise: 0, advanceOutstandingPaise: 80_000 } };
    const v = paidView(daily);
    expect(v.lines.map((l) => l.kind)).toEqual(['days', 'deduction', 'advance']);
    expect(v.lines.reduce((sum, l) => sum + l.amountPaise, 0)).toBe(840_000);
    expect(v.balanceAfterPaise).toBe(30_000);
  });
});

describe('SPEC-M16 §2 locked entries', () => {
  const locked = new Set(['2026-10']);
  it('entries dated in a locked month, and payments for a locked month, are locked; the lock itself is not', () => {
    expect(isRecordLocked(locked, rec('attendance', {}, '2026-10-05'))).toBe(true);
    expect(isRecordLocked(locked, rec('attendance', {}, '2026-11-01'))).toBe(false);
    expect(isRecordLocked(locked, rec('wage_payment', { month: '2026-10' }, '2026-11-02'))).toBe(true);
    expect(isRecordLocked(locked, rec('period_lock', { month: '2026-10' }, '2026-10-31'))).toBe(false);
  });
});
