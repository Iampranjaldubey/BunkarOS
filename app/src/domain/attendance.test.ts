import { describe, it, expect } from 'vitest';
import type { Rec, AttendanceP } from '../db/types';
import { monthAttendance, dayRollCall, attendanceIndex } from './attendance';

const rec = (id: string, day: string, p: AttendanceP, at = `${day}T10:00:00Z`): Rec<AttendanceP> =>
  ({ id, type: 'attendance', unitId: 'u', payload: p, by: 'o', role: 'owner', device: 'd', at, day, sync: 'synced' });
const rev = (target: string, day: string): Rec => ({ id: 'r-' + target, type: 'reversal', unitId: 'u', payload: { targetId: target, reason: 'edited' }, by: 'o', role: 'owner', device: 'd', at: `${day}T11:00:00Z`, day, sync: 'synced' });

describe('attendance', () => {
  it('counts present/half/absent/OT and unmarked working days up to today', () => {
    const recs: Rec[] = [
      rec('a', '2026-10-01', { workerId: 'w', status: 'present', otHours: 2 }),
      rec('b', '2026-10-02', { workerId: 'w', status: 'half', otHours: 0 }),
      rec('c', '2026-10-03', { workerId: 'w', status: 'absent', otHours: 0 }),
    ];
    // 2026-10-04 is a Sunday → not counted as unmarked; 5th and 6th are unmarked.
    const m = monthAttendance(recs, 'w', '2026-10', '2026-10-06');
    expect([m.present, m.half, m.absent, m.otHours, m.unmarked]).toEqual([1, 1, 1, 2, 2]);
  });
  it('re-marking a day replaces the old mark (latest wins; reversed ignored)', () => {
    const recs: Rec[] = [
      rec('a', '2026-10-01', { workerId: 'w', status: 'absent', otHours: 0 }),
      rev('a', '2026-10-01'),
      rec('b', '2026-10-01', { workerId: 'w', status: 'present', otHours: 1 }, '2026-10-01T12:00:00Z'),
    ];
    expect(attendanceIndex(recs).get('w|2026-10-01')?.status).toBe('present');
    expect(monthAttendance(recs, 'w', '2026-10', '2026-10-01').present).toBe(1);
  });
  it('holidays reduce unmarked', () => {
    const m = monthAttendance([], 'w', '2026-10', '2026-10-02', { entityId: 'unit', unitName: '', ownerPhone: '', lang: 'hi', workingDaysPerMonth: 26, photoRequiredAbovePaise: 0, holidays: ['2026-10-02'] });
    expect(m.unmarked).toBe(1);
  });
  it('roll call for a day', () => {
    const recs: Rec[] = [rec('a', '2026-10-01', { workerId: 'w1', status: 'present', otHours: 0 }), rec('b', '2026-10-01', { workerId: 'w2', status: 'absent', otHours: 0 })];
    expect(dayRollCall(recs, ['w1', 'w2', 'w3'], '2026-10-01')).toEqual({ total: 3, marked: 2, present: 1, half: 0, absent: 1 });
  });
});
