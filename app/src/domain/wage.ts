// Wage engine (pure, integer paise). See SPEC-M02 formulas.
import type { DeductionLine, PayType, Rec, WagePaymentP, WorkerP, SettingP } from '../db/types.ts';
import { monthAttendance, monthPieces } from './attendance.ts';
import { advanceBalance } from './advances.ts';
import { roundToRupee } from './money.ts';
import { recsOfType } from './records.ts';
import { monthDays } from './ids.ts';

export interface WageInputs {
  payType: PayType;
  ratePaise: number;        // salary / daily rate / piece rate
  workingDays: number;      // settings.workingDaysPerMonth
  present: number; half: number; absent: number;
  otHours: number; otRatePaise: number;
  pieces: number;           // piece count (piece workers)
  pieceAmountPaise?: number; // Σ count × rate at entry time (if entries carry their own rate)
}
export interface WageBreakdown {
  grossPaise: number; perDayPaise: number; absentDeductPaise: number; halfDeductPaise: number; otPaise: number;
}

export function computeGross(i: WageInputs): WageBreakdown {
  const otPaise = Math.round(i.otHours * i.otRatePaise);
  if (i.payType === 'monthly') {
    const perDayPaise = Math.round(i.ratePaise / i.workingDays);
    const absentDeductPaise = i.absent * perDayPaise;
    const halfDeductPaise = i.half * Math.round(perDayPaise / 2);
    return { grossPaise: i.ratePaise - absentDeductPaise - halfDeductPaise, perDayPaise, absentDeductPaise, halfDeductPaise, otPaise };
  }
  if (i.payType === 'daily') {
    const grossPaise = i.present * i.ratePaise + i.half * Math.round(i.ratePaise / 2);
    return { grossPaise, perDayPaise: i.ratePaise, absentDeductPaise: 0, halfDeductPaise: 0, otPaise };
  }
  const grossPaise = i.pieceAmountPaise ?? i.pieces * i.ratePaise;
  return { grossPaise, perDayPaise: 0, absentDeductPaise: 0, halfDeductPaise: 0, otPaise };
}

export interface Settlement {
  grossPaise: number; otPaise: number; deductions: DeductionLine[]; deductionsPaise: number;
  advanceOutstandingPaise: number; advanceRecoveredPaise: number; netPaise: number; paidPaise: number; roundingPaise: number;
}
/** Net the deductions and (by default all possible) advance recovery; pay rounded to ₹1 half-up. */
export function settle(b: WageBreakdown, deductions: DeductionLine[], advanceOutstandingPaise: number, recoverPaise?: number): Settlement {
  const deductionsPaise = deductions.reduce((s, d) => s + d.amountPaise, 0);
  const beforeAdvance = Math.max(0, b.grossPaise + b.otPaise - deductionsPaise);
  const maxRecover = Math.min(advanceOutstandingPaise, beforeAdvance);
  const advanceRecoveredPaise = Math.max(0, Math.min(recoverPaise ?? maxRecover, maxRecover));
  const netPaise = b.grossPaise + b.otPaise - deductionsPaise - advanceRecoveredPaise;
  const { paid, rounding } = roundToRupee(Math.max(0, netPaise));
  return { grossPaise: b.grossPaise, otPaise: b.otPaise, deductions, deductionsPaise, advanceOutstandingPaise, advanceRecoveredPaise, netPaise, paidPaise: paid, roundingPaise: rounding };
}

export const rateOf = (w: WorkerP) => (w.payType === 'monthly' ? w.salaryPaise : w.payType === 'daily' ? w.dailyRatePaise : w.pieceRatePaise) ?? 0;

/** Live inputs for a worker+month from the record stream (uses whole month so unmarked days do not count). */
export function wageInputsFor(recs: Rec[], w: WorkerP, month: string, settings: SettingP | undefined): WageInputs {
  const last = monthDays(month).at(-1)!;
  const a = monthAttendance(recs, w.entityId, month, last, settings);
  const p = monthPieces(recs, w.entityId, month);
  return { payType: w.payType, ratePaise: rateOf(w), workingDays: settings?.workingDaysPerMonth ?? 26, present: a.present, half: a.half, absent: a.absent, otHours: a.otHours, otRatePaise: w.otRatePaise, pieces: p.count, pieceAmountPaise: p.amountPaise };
}

export interface WageRow { worker: WorkerP; inputs: WageInputs; breakdown: WageBreakdown; outstanding: number; settlement: Settlement; payment?: Rec<WagePaymentP>; }
/** The month's wage sheet: one row per worker active that month, with payment if made. */
export function wageSheet(recs: Rec[], workers: WorkerP[], month: string, settings: SettingP | undefined): WageRow[] {
  const payments = new Map<string, Rec<WagePaymentP>>();
  for (const r of recsOfType<WagePaymentP>(recs, 'wage_payment')) if (r.payload.month === month) payments.set(r.payload.workerId, r);
  const last = monthDays(month).at(-1)!;
  return workers.filter((w) => w.joinedOn <= last).map((worker) => {
    const inputs = wageInputsFor(recs, worker, month, settings);
    const breakdown = computeGross(inputs);
    const payment = payments.get(worker.entityId);
    // Outstanding BEFORE this month's payment: if paid, add back what that payment recovered.
    const outstanding = advanceBalance(recs, worker.entityId) + (payment?.payload.advanceRecoveredPaise ?? 0);
    const settlement = settle(breakdown, payment?.payload.deductions ?? [], outstanding, payment?.payload.advanceRecoveredPaise);
    return { worker, inputs, breakdown, outstanding, settlement, payment };
  });
}

export function sheetTotals(rows: WageRow[]) {
  const t = { gross: 0, ot: 0, deductions: 0, advances: 0, net: 0, paid: 0, pending: 0, workers: rows.length, paidCount: 0 };
  for (const r of rows) {
    const s = r.payment ? { gross: r.payment.payload.grossPaise, ot: r.payment.payload.otPaise, ded: r.payment.payload.deductions.reduce((x, d) => x + d.amountPaise, 0), adv: r.payment.payload.advanceRecoveredPaise, net: r.payment.payload.netPaise, paid: r.payment.payload.paidPaise }
      : { gross: r.settlement.grossPaise, ot: r.settlement.otPaise, ded: r.settlement.deductionsPaise, adv: r.settlement.advanceRecoveredPaise, net: r.settlement.netPaise, paid: 0 };
    t.gross += s.gross; t.ot += s.ot; t.deductions += s.ded; t.advances += s.adv; t.net += s.net;
    if (r.payment) { t.paid += s.paid; t.paidCount += 1; } else t.pending += r.settlement.paidPaise;
  }
  return t;
}
