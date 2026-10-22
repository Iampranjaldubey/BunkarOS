// Attendance projections (pure).
import type { Rec, AttendanceP, AttendanceStatus, PieceEntryP, SettingP } from '../db/types.ts';
import { recsOfType } from './records.ts';
import { monthDays, weekday } from './ids.ts';

export interface DayMark { recId: string; status: AttendanceStatus; otHours: number; note?: string; by: string; at: string; }

/** Latest active attendance per worker per day. */
export function attendanceIndex(recs: Rec[]): Map<string, DayMark> {
  const out = new Map<string, DayMark>();
  for (const r of recsOfType<AttendanceP>(recs, 'attendance')) {
    const key = `${r.payload.workerId}|${r.day}`;
    const prev = out.get(key);
    if (!prev || r.at > prev.at) out.set(key, { recId: r.id, status: r.payload.status, otHours: r.payload.otHours, note: r.payload.note, by: r.by, at: r.at });
  }
  return out;
}
export const markKey = (workerId: string, day: string) => `${workerId}|${day}`;

export interface MonthAttendance { present: number; half: number; absent: number; unmarked: number; otHours: number; days: Record<string, DayMark | undefined>; }

/**
 * Month summary for one worker. Unmarked = calendar days up to `uptoDay` that are
 * not holidays, not Sundays-as-holiday (if the unit lists them), and have no mark.
 */
export function monthAttendance(recs: Rec[], workerId: string, month: string, uptoDay: string, settings?: SettingP): MonthAttendance {
  const idx = attendanceIndex(recs);
  const holidays = new Set(settings?.holidays ?? []);
  const out: MonthAttendance = { present: 0, half: 0, absent: 0, unmarked: 0, otHours: 0, days: {} };
  for (const day of monthDays(month)) {
    const m = idx.get(markKey(workerId, day));
    out.days[day] = m;
    if (m) {
      if (m.status === 'present') out.present += 1; else if (m.status === 'half') out.half += 1; else out.absent += 1;
      out.otHours += m.otHours;
    } else if (day <= uptoDay && !holidays.has(day) && weekday(day) !== 0) {
      out.unmarked += 1;
    }
  }
  return out;
}

/** Pieces in a month for a worker: count and amount (paise). */
export function monthPieces(recs: Rec[], workerId: string, month: string): { count: number; amountPaise: number } {
  let count = 0; let amountPaise = 0;
  for (const r of recsOfType<PieceEntryP>(recs, 'piece_entry')) {
    if (r.payload.workerId !== workerId || !r.day.startsWith(month)) continue;
    count += r.payload.count; amountPaise += r.payload.count * r.payload.pieceRatePaise;
  }
  return { count, amountPaise };
}

/** Today's roll call: how many workers are marked / present / half / absent. */
export function dayRollCall(recs: Rec[], workerIds: string[], day: string) {
  const idx = attendanceIndex(recs);
  const out = { total: workerIds.length, marked: 0, present: 0, half: 0, absent: 0 };
  for (const w of workerIds) {
    const m = idx.get(markKey(w, day));
    if (!m) continue;
    out.marked += 1;
    if (m.status === 'present') out.present += 1; else if (m.status === 'half') out.half += 1; else out.absent += 1;
  }
  return out;
}
