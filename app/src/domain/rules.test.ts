// SPEC-M13 rules + SPEC-M02 AC5/AC6/AC8 + SPEC-M14: inputs and expected values from docs/wage-examples.md.
import { describe, it, expect } from 'vitest';
import type { Rec, SettingP, WorkerP, AttendanceP, AdvanceP, PieceEntryP, OffDayPolicy } from '../db/types';
import { unitRules, DEFAULT_SLIP_ON, SLIP_SECTIONS } from './settings';
import { wageInputsFor, computeGross, settle, liveView, paidView, buildSnapshot, overrideError } from './wage';
import { paidOffDays } from './attendance';

let n = 0;
const rec = <P,>(type: Rec['type'], payload: P, day: string, at?: string): Rec<P> =>
  ({ id: `x${n++}`, type, unitId: 'u', payload, by: 'owner', role: 'owner', device: 'd', at: at ?? `${day}T10:00:${String(n % 60).padStart(2, '0')}Z`, day, sync: 'synced' });
const base: SettingP = { entityId: 'unit', unitName: 'U', ownerPhone: '', lang: 'hi', workingDaysPerMonth: 26, photoRequiredAbovePaise: 200_000, holidays: [] };
const mark = (w: string, day: string, status: AttendanceP['status'], otHours = 0) => rec<AttendanceP>('attendance', { workerId: w, status, otHours }, day);

describe('SPEC-M13 AC1: a unit without the new fields gets the defaults', () => {
  it('overtime off, policy sundays_and_holidays, 8 slip sections, operator toggles per D-005', () => {
    const r = unitRules(base);
    expect(r.overtimeEnabled).toBe(false);
    expect(r.offDayPolicy).toBe('sundays_and_holidays');
    expect(SLIP_SECTIONS.filter((k) => r.slip[k])).toEqual(DEFAULT_SLIP_ON);
    expect(DEFAULT_SLIP_ON).toEqual(['businessName', 'workerName', 'month', 'gross', 'advance', 'deductions', 'net', 'signature']);
    expect(r.operatorPerms).toEqual({ addEntries: true, editPast: false, seeWages: true, seePrices: true, export: false });
  });
  it('fixed slip sections cannot be switched off; overtime section needs overtime on; see wages stays on (stage 1)', () => {
    const r = unitRules({ ...base, slipSections: { businessName: false, net: false, signature: false, overtime: true, attendance: true }, operatorPerms: { seeWages: false, export: true } });
    expect([r.slip.businessName, r.slip.net, r.slip.signature, r.slip.overtime, r.slip.attendance]).toEqual([true, true, false, false, true]);
    expect(r.operatorPerms.seeWages).toBe(true);
    expect(r.operatorPerms.export).toBe(true);
    expect(unitRules({ ...base, overtimeEnabled: true, slipSections: { overtime: true } }).slip.overtime).toBe(true);
  });
});

/** Example A: Rafiq, monthly ₹12,000, W 26, Oct 2026: absent 1–2 Oct, half 3 Oct, present + 3 h OT 5 Oct, advance ₹1,000. */
function exampleA(settings: SettingP) {
  const w: WorkerP = { entityId: 'rafiq', name: 'Rafiq', jobTitle: 'weaver', payType: 'monthly', salaryPaise: 1_200_000, otRatePaise: 5_800, joinedOn: '2026-10-01', active: true };
  const recs: Rec[] = [
    rec<AdvanceP>('advance', { workerId: 'rafiq', amountPaise: 100_000, mode: 'cash' }, '2026-10-01'),
    mark('rafiq', '2026-10-01', 'absent'), mark('rafiq', '2026-10-02', 'absent'), mark('rafiq', '2026-10-03', 'half'), mark('rafiq', '2026-10-05', 'present', 3),
  ];
  const i = wageInputsFor(recs, w, '2026-10', settings);
  const b = computeGross(i);
  return { i, b };
}

describe('Example A — SPEC-M02 AC1 (overtime on) and AC5 (overtime off, the default)', () => {
  it('AC1 overtime on → ot 17,400, paid ₹10,020', () => {
    const { b } = exampleA({ ...base, overtimeEnabled: true });
    const s = settle(b, [], 100_000);
    expect([b.perDayPaise, b.absentDeductPaise, b.halfDeductPaise, b.grossPaise, s.otPaise, s.netPaise, s.roundingPaise, s.paidPaise])
      .toEqual([46_154, 92_308, 23_077, 1_084_615, 17_400, 1_002_015, -15, 1_002_000]);
  });
  it('AC5 overtime off → the 3 h stay recorded but pay nothing: paid ₹9,846 (rounding −15)', () => {
    const { i, b } = exampleA(base);
    expect(i.otHours).toBe(0);
    const s = settle(b, [], 100_000);
    expect([s.grossPaise, s.otPaise, s.advanceRecoveredPaise, s.netPaise, s.roundingPaise, s.paidPaise]).toEqual([1_084_615, 0, 100_000, 984_615, -15, 984_600]);
    expect(liveView(i, b, s).lines.map((l) => l.kind)).toEqual(['base', 'absent', 'half', 'advance', 'rounding']); // no overtime line
  });
});

/** Example B: daily ₹400, Nov 2026 (Sundays 1, 8, 15, 22, 29), holiday 9 Nov, joined 5 Nov, 18 P, half 27 Nov, absent 22 Nov. */
const PRESENT = [5, 6, 7, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26].map((d) => `2026-11-${String(d).padStart(2, '0')}`);
function exampleB(worker: WorkerP, policy: OffDayPolicy, extra: Rec[] = []) {
  const recs: Rec[] = [...PRESENT.map((d) => mark(worker.entityId, d, 'present')), mark(worker.entityId, '2026-11-27', 'half'), mark(worker.entityId, '2026-11-22', 'absent'), ...extra];
  const settings: SettingP = { ...base, holidays: ['2026-11-09'], offDayPolicy: policy };
  const i = wageInputsFor(recs, worker, '2026-11', settings);
  return { recs, i, b: computeGross(i), settings };
}
const daily: WorkerP = { entityId: 'guddu', name: 'Guddu', jobTitle: 'helper', payType: 'daily', dailyRatePaise: 40_000, otRatePaise: 0, joinedOn: '2026-11-05', active: true };

describe('Example B — SPEC-M02 AC6 and AC8 (off-day policy)', () => {
  it.each([
    ['none', [], 740_000],
    ['sundays', ['2026-11-08', '2026-11-15', '2026-11-29'], 860_000],
    ['sundays_and_holidays', ['2026-11-08', '2026-11-09', '2026-11-15', '2026-11-29'], 900_000],
  ] as const)('policy %s → paid off days %j → gross %i', (policy, offDays, gross) => {
    const { recs, i, b, settings } = exampleB(daily, policy);
    expect(paidOffDays(recs, 'guddu', '2026-11', '2026-11-05', policy, settings.holidays)).toEqual(offDays);
    expect([i.present, i.half, i.offDays]).toEqual([18, 1, offDays.length]);
    const s = settle(b, [], 0);
    expect([b.daysPaise, b.offDaysPaise, s.grossPaise, s.roundingPaise, s.paidPaise]).toEqual([18 * 40_000 + 20_000, offDays.length * 40_000, gross, 0, gross]);
  });

  it('AC6: the same marks add nothing for a piece-rate worker; a monthly worker is unchanged by the policy', () => {
    const piece: WorkerP = { ...daily, entityId: 'meena', payType: 'piece', dailyRatePaise: undefined, pieceRatePaise: 1_500 };
    const pieces = [rec<PieceEntryP>('piece_entry', { workerId: 'meena', count: 120, pieceRatePaise: 1_500 }, '2026-11-20')];
    const monthly: WorkerP = { ...daily, entityId: 'rafiq', payType: 'monthly', dailyRatePaise: undefined, salaryPaise: 1_200_000, joinedOn: '2026-01-01' };
    for (const policy of ['none', 'sundays', 'sundays_and_holidays'] as const) {
      const p = exampleB(piece, policy, pieces);
      expect([p.i.offDays, settle(p.b, [], 0).paidPaise]).toEqual([0, 180_000]);
      const m = exampleB(monthly, policy);
      expect([m.i.offDays, m.b.grossPaise, settle(m.b, [], 0).paidPaise]).toEqual([0, 1_130_769, 1_130_800]);
    }
  });

  it('a paid off day is paid once when Present, Half or unmarked; an explicit Absent removes it', () => {
    // Change Example B: Present on Sunday 8, Half on holiday 9 (both still paid once), Absent on Sunday 15 (removed).
    const recs: Rec[] = [
      ...PRESENT.map((d) => mark('guddu', d, 'present')), mark('guddu', '2026-11-27', 'half'), mark('guddu', '2026-11-22', 'absent'),
      mark('guddu', '2026-11-08', 'present'), mark('guddu', '2026-11-09', 'half'), mark('guddu', '2026-11-15', 'absent'),
    ];
    const settings: SettingP = { ...base, holidays: ['2026-11-09'] };
    const i = wageInputsFor(recs, daily, '2026-11', settings);
    expect([i.present, i.half, i.offDays]).toEqual([18, 1, 3]); // off days 8, 9, 29; the marks on 8 and 9 are not added again
    expect(settle(computeGross(i), [], 0).grossPaise).toBe((18 + 3) * 40_000 + 20_000); // ₹8,600
    // With policy "none" the same Sunday/holiday marks are ordinary work days.
    const none = wageInputsFor(recs, daily, '2026-11', { ...settings, offDayPolicy: 'none' });
    expect([none.present, none.half, none.offDays]).toEqual([19, 2, 0]);
  });

  it('days before joining never count', () => {
    expect(paidOffDays([], 'g', '2026-11', '2026-11-16', 'sundays', [])).toEqual(['2026-11-22', '2026-11-29']);
  });
});

describe('Example C — SPEC-M14 AC1 owner override', () => {
  it('absence deduction ₹923.08 → ₹500 with a reason → gross ₹11,269.23, paid ₹10,269; snapshot keeps computed parts', () => {
    const { i, b } = exampleA(base);
    const reason = 'एक दिन की छुट्टी दी थी';
    const s = settle(b, [], 100_000, undefined, { absent_deduct: { finalPaise: 50_000, reason } });
    expect([s.grossPaise, s.otPaise, s.advanceRecoveredPaise, s.netPaise, s.roundingPaise, s.paidPaise]).toEqual([1_126_923, 0, 100_000, 1_026_923, -23, 1_026_900]);
    expect(s.overrides).toEqual([{ line: 'absent_deduct', computedPaise: 92_308, finalPaise: 50_000, reason }]);
    const snap = buildSnapshot(i, b, 100_000, s);
    expect(snap.parts).toMatchObject({ base: 1_200_000, absent_deduct: 92_308, half_deduct: 23_077, overtime: 0, advance_recovered: 100_000, rounding: -23 });
    // Paid view from the stored record shows ₹500 with the computed ₹923.08 and the reason.
    const v = paidView({ workerId: 'rafiq', month: '2026-10', grossPaise: s.grossPaise, otPaise: s.otPaise, deductions: [], advanceRecoveredPaise: s.advanceRecoveredPaise,
      netPaise: s.netPaise, paidPaise: s.paidPaise, roundingPaise: s.roundingPaise, mode: 'cash', snapshot: snap, overrides: s.overrides });
    expect(v.lines.find((l) => l.kind === 'absent')).toEqual({ kind: 'absent', key: 'absent_deduct', n: 2, amountPaise: -50_000, override: { computedPaise: -92_308, reason } });
    expect(v.paidPaise).toBe(1_026_900);
  });

  it('later lines are computed from overridden ones; an override can never make net negative; limits per line', () => {
    const { b } = exampleA(base);
    // Base cut to ₹1,000: gross 1,000 − 923.08 − 230.77 = −153.85 → advance recovery drops to 0, net negative → refused at pay.
    const s = settle(b, [], 100_000, undefined, { base: { finalPaise: 100_000, reason: 'x' } });
    expect(s.advanceRecoveredPaise).toBe(0);
    expect(s.netPaise).toBeLessThan(0);
    expect(overrideError('rounding', 60, 0)).toBe('rounding_limit');
    expect(overrideError('rounding', -50, 0)).toBe('');
    expect(overrideError('absent_deduct', -1, 0)).toBe('negative');
    expect(overrideError('advance_recovered', 150_000, 100_000)).toBe('over_outstanding');
    expect(overrideError('base', 12.5, 0)).toBe('not_integer');
  });

  it('an override for a line the pay type does not have is ignored', () => {
    const { b } = exampleA(base);
    expect(settle(b, [], 0, undefined, { off_days: { finalPaise: 1, reason: 'x' } }).overrides).toEqual([]);
  });
});
