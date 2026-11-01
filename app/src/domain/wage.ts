// Wage engine (pure, integer paise). See SPEC-M02 formulas.
import type { DeductionLine, PayType, Rec, WagePaymentP, WageSnapshot, WorkerP, SettingP } from '../db/types.ts';
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
/**
 * The month's wage sheet: one row per worker active that month, with payment if made.
 * A paid row's `inputs` (P/H/A/OT/pieces/rate) come from the payment's saved snapshot, never from today's data (SPEC-M16 §1).
 */
export function wageSheet(recs: Rec[], workers: WorkerP[], month: string, settings: SettingP | undefined): WageRow[] {
  const payments = new Map<string, Rec<WagePaymentP>>();
  for (const r of recsOfType<WagePaymentP>(recs, 'wage_payment')) if (r.payload.month === month) payments.set(r.payload.workerId, r);
  const last = monthDays(month).at(-1)!;
  return workers.filter((w) => w.joinedOn <= last).map((worker) => {
    const live = wageInputsFor(recs, worker, month, settings);
    const payment = payments.get(worker.entityId);
    const inputs = payment ? inputsFromSnapshot(payment.payload.snapshot, live) : live;
    const breakdown = computeGross(inputs);
    // Outstanding BEFORE this month's payment: the saved value, else today's balance plus what the payment recovered.
    const outstanding = payment?.payload.snapshot?.advanceOutstandingPaise ?? advanceBalance(recs, worker.entityId) + (payment?.payload.advanceRecoveredPaise ?? 0);
    const settlement = settle(breakdown, payment?.payload.deductions ?? [], outstanding, payment?.payload.advanceRecoveredPaise);
    return { worker, inputs, breakdown, outstanding, settlement, payment };
  });
}

// ---------- SPEC-M16 §1: a paid month is shown from the saved payment ----------

/** Snapshot saved with a new payment: everything the lines were computed from. */
export function buildSnapshot(i: WageInputs, b: WageBreakdown, advanceOutstandingPaise: number): WageSnapshot {
  return {
    present: i.present, half: i.half, absent: i.absent, otHours: i.otHours, pieces: i.pieces, payType: i.payType, ratePaise: i.ratePaise,
    workingDays: i.workingDays, perDayPaise: b.perDayPaise, absentDeductPaise: b.absentDeductPaise, halfDeductPaise: b.halfDeductPaise,
    otRatePaise: i.otRatePaise, advanceOutstandingPaise,
  };
}

/** Counts and rates of a paid month from its snapshot; any field an old snapshot lacks falls back to `live`. */
function inputsFromSnapshot(s: WageSnapshot | undefined, live: WageInputs): WageInputs {
  if (!s) return live;
  return {
    ...live,
    payType: s.payType ?? live.payType, ratePaise: s.ratePaise ?? live.ratePaise, workingDays: s.workingDays ?? live.workingDays,
    present: s.present ?? live.present, half: s.half ?? live.half, absent: s.absent ?? live.absent,
    otHours: s.otHours ?? live.otHours, otRatePaise: s.otRatePaise ?? live.otRatePaise, pieces: s.pieces ?? live.pieces,
    pieceAmountPaise: undefined,
  };
}

/** One line of a wage breakdown. The UI turns `kind` + numbers into words in the active language. */
export type WageLine =
  | { kind: 'base'; amountPaise: number }
  | { kind: 'absent'; n: number; amountPaise: number }
  | { kind: 'half'; n: number; amountPaise: number }
  | { kind: 'attendanceDeduct'; amountPaise: number }
  | { kind: 'days'; present: number; half: number; ratePaise: number; amountPaise: number }
  | { kind: 'pieces'; pieces: number; amountPaise: number }
  | { kind: 'ot'; hours: number; ratePaise?: number; amountPaise: number }
  | { kind: 'deduction'; label: string; amountPaise: number }
  | { kind: 'advance'; amountPaise: number }
  | { kind: 'rounding'; amountPaise: number };

/** Everything a pay screen, slip or worker page shows for one worker-month. Signed amounts: deductions are negative. */
export interface WageView {
  payType: PayType; present: number; half: number; absent: number; otHours: number; pieces: number;
  ratePaise: number; perDayPaise?: number;
  lines: WageLine[];
  grossPaise: number; otPaise: number; netPaise: number; paidPaise: number; roundingPaise: number; advanceRecoveredPaise: number;
  /** Advance still owed after this payment; undefined when an old payment did not save it. */
  balanceAfterPaise?: number;
}

function grossLines(payType: PayType, s: { present: number; half: number; absent: number; pieces: number; ratePaise: number },
  grossPaise: number, parts?: { absentDeductPaise?: number; halfDeductPaise?: number }): WageLine[] {
  if (payType === 'monthly') {
    const out: WageLine[] = [{ kind: 'base', amountPaise: s.ratePaise }];
    const a = parts?.absentDeductPaise; const h = parts?.halfDeductPaise;
    if (a !== undefined && h !== undefined && s.ratePaise - a - h === grossPaise) {
      if (a) out.push({ kind: 'absent', n: s.absent, amountPaise: -a });
      if (h) out.push({ kind: 'half', n: s.half, amountPaise: -h });
    } else if (s.ratePaise !== grossPaise) {
      // Older payment without the split: one combined line, still taken only from the stored record.
      out.push({ kind: 'attendanceDeduct', amountPaise: grossPaise - s.ratePaise });
    }
    return out;
  }
  if (payType === 'daily') return [{ kind: 'days', present: s.present, half: s.half, ratePaise: s.ratePaise, amountPaise: grossPaise }];
  return [{ kind: 'pieces', pieces: s.pieces, amountPaise: grossPaise }];
}

function tailLines(p: { otPaise: number; deductions: DeductionLine[]; advanceRecoveredPaise: number; roundingPaise: number }, hours: number, otRatePaise?: number): WageLine[] {
  const out: WageLine[] = [];
  if (p.otPaise) out.push({ kind: 'ot', hours, ratePaise: otRatePaise, amountPaise: p.otPaise });
  for (const d of p.deductions) out.push({ kind: 'deduction', label: d.label, amountPaise: -d.amountPaise });
  if (p.advanceRecoveredPaise) out.push({ kind: 'advance', amountPaise: -p.advanceRecoveredPaise });
  if (p.roundingPaise) out.push({ kind: 'rounding', amountPaise: p.roundingPaise });
  return out;
}

/** A paid month, built ONLY from the stored payment record (never from current rates or attendance). */
export function paidView(p: WagePaymentP): WageView {
  const s = p.snapshot ?? ({ present: 0, half: 0, absent: 0, otHours: 0, pieces: 0, payType: 'monthly', ratePaise: p.grossPaise } as WageSnapshot);
  return {
    payType: s.payType, present: s.present, half: s.half, absent: s.absent, otHours: s.otHours, pieces: s.pieces,
    ratePaise: s.ratePaise, perDayPaise: s.perDayPaise,
    lines: [...grossLines(s.payType, s, p.grossPaise, s), ...tailLines(p, s.otHours, s.otRatePaise)],
    grossPaise: p.grossPaise, otPaise: p.otPaise, netPaise: p.netPaise, paidPaise: p.paidPaise, roundingPaise: p.roundingPaise,
    advanceRecoveredPaise: p.advanceRecoveredPaise,
    balanceAfterPaise: s.advanceOutstandingPaise !== undefined ? Math.max(0, s.advanceOutstandingPaise - p.advanceRecoveredPaise) : undefined,
  };
}

/** A month not yet paid: today's suggestion from live inputs. */
export function liveView(i: WageInputs, b: WageBreakdown, s: Settlement): WageView {
  return {
    payType: i.payType, present: i.present, half: i.half, absent: i.absent, otHours: i.otHours, pieces: i.pieces,
    ratePaise: i.ratePaise, perDayPaise: i.payType === 'monthly' ? b.perDayPaise : undefined,
    lines: [...grossLines(i.payType, i, s.grossPaise, b), ...tailLines(s, i.otHours, i.otRatePaise)],
    grossPaise: s.grossPaise, otPaise: s.otPaise, netPaise: s.netPaise, paidPaise: s.paidPaise, roundingPaise: s.roundingPaise,
    advanceRecoveredPaise: s.advanceRecoveredPaise,
    balanceAfterPaise: Math.max(0, s.advanceOutstandingPaise - s.advanceRecoveredPaise),
  };
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
