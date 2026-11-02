// Wage engine (pure, integer paise). See SPEC-M02 formulas, SPEC-M13 rules, SPEC-M14 overrides, SPEC-M16 paid view.
import type { DeductionLine, OffDayPolicy, PayType, Rec, WagePaymentP, WageSnapshot, WorkerP, SettingP, WageLineKey, WageOverride } from '../db/types.ts';
import { attendanceIndex, markKey, monthAttendance, monthPieces, paidOffDays } from './attendance.ts';
import { advanceBalance } from './advances.ts';
import { roundToRupee } from './money.ts';
import { recsOfType } from './records.ts';
import { monthDays } from './ids.ts';
import { unitRules } from './settings.ts';

export interface WageInputs {
  payType: PayType;
  ratePaise: number;        // salary / daily rate / piece rate
  workingDays: number;      // settings.workingDaysPerMonth
  /** Daily-rate workers: worked days that are not paid off days (an off day is paid once, D-002). */
  present: number; half: number; absent: number;
  /** Paid off days for daily-rate workers under the unit's off-day policy; 0 for others. */
  offDays: number;
  otHours: number; otRatePaise: number;
  pieces: number;           // piece count (piece workers)
  pieceAmountPaise?: number; // Σ count × rate at entry time (if entries carry their own rate)
  overtimeEnabled?: boolean; offDayPolicy?: OffDayPolicy;
}
export interface WageBreakdown {
  payType: PayType;
  grossPaise: number; perDayPaise: number; absentDeductPaise: number; halfDeductPaise: number; otPaise: number;
  basePaise: number; daysPaise: number; offDaysPaise: number; piecesPaise: number;
}

export function computeGross(i: WageInputs): WageBreakdown {
  const otPaise = Math.round(i.otHours * i.otRatePaise);
  const zero = { basePaise: 0, daysPaise: 0, offDaysPaise: 0, piecesPaise: 0, absentDeductPaise: 0, halfDeductPaise: 0 };
  if (i.payType === 'monthly') {
    const perDayPaise = Math.round(i.ratePaise / i.workingDays);
    const absentDeductPaise = i.absent * perDayPaise;
    const halfDeductPaise = i.half * Math.round(perDayPaise / 2);
    return { ...zero, payType: 'monthly', basePaise: i.ratePaise, grossPaise: i.ratePaise - absentDeductPaise - halfDeductPaise, perDayPaise, absentDeductPaise, halfDeductPaise, otPaise };
  }
  if (i.payType === 'daily') {
    const daysPaise = i.present * i.ratePaise + i.half * Math.round(i.ratePaise / 2);
    const offDaysPaise = (i.offDays ?? 0) * i.ratePaise;
    return { ...zero, payType: 'daily', daysPaise, offDaysPaise, grossPaise: daysPaise + offDaysPaise, perDayPaise: i.ratePaise, otPaise };
  }
  const piecesPaise = i.pieceAmountPaise ?? i.pieces * i.ratePaise;
  return { ...zero, payType: 'piece', piecesPaise, grossPaise: piecesPaise, perDayPaise: 0, otPaise };
}

/** Owner overrides keyed by line (SPEC-M14). */
export type OverrideMap = Partial<Record<WageLineKey, { finalPaise: number; reason: string }>>;
export const overrideMap = (list: WageOverride[] | undefined): OverrideMap =>
  Object.fromEntries((list ?? []).map((o) => [o.line, { finalPaise: o.finalPaise, reason: o.reason }])) as OverrideMap;

export interface Settlement {
  grossPaise: number; otPaise: number; deductions: DeductionLine[]; deductionsPaise: number;
  advanceOutstandingPaise: number; advanceRecoveredPaise: number; netPaise: number; paidPaise: number; roundingPaise: number;
  /** Computed amount of every line that applies, before overrides (positive; deductions are subtracted). */
  parts: Partial<Record<WageLineKey, number>>;
  /** Overrides that apply to this pay type, with the computed amount they replace. */
  overrides: WageOverride[];
}

/**
 * Net the deductions and (by default all possible) advance recovery; pay rounded to ₹1 half-up.
 * Overridden lines use the owner's final amount; later lines are computed from the final ones.
 */
export function settle(b: WageBreakdown, deductions: DeductionLine[], advanceOutstandingPaise: number, recoverPaise?: number, ov: OverrideMap = {}): Settlement {
  const parts: Partial<Record<WageLineKey, number>> = {};
  const f = (k: WageLineKey, computed: number) => { parts[k] = computed; return ov[k]?.finalPaise ?? computed; };
  let grossPaise: number;
  if (b.payType === 'monthly') grossPaise = f('base', b.basePaise) - f('absent_deduct', b.absentDeductPaise) - f('half_deduct', b.halfDeductPaise);
  else if (b.payType === 'daily') grossPaise = f('days', b.daysPaise) + f('off_days', b.offDaysPaise);
  else grossPaise = f('pieces', b.piecesPaise);
  const otPaise = f('overtime', b.otPaise);
  const deductionsPaise = deductions.reduce((s, d) => s + d.amountPaise, 0);
  const beforeAdvance = Math.max(0, grossPaise + otPaise - deductionsPaise);
  const maxRecover = Math.min(advanceOutstandingPaise, beforeAdvance);
  const advanceRecoveredPaise = f('advance_recovered', Math.max(0, Math.min(recoverPaise ?? maxRecover, maxRecover)));
  const netPaise = grossPaise + otPaise - deductionsPaise - advanceRecoveredPaise;
  const auto = roundToRupee(Math.max(0, netPaise));
  const roundingPaise = f('rounding', auto.rounding);
  const paidPaise = netPaise < 0 ? 0 : netPaise + roundingPaise;
  const overrides: WageOverride[] = (Object.keys(ov) as WageLineKey[])
    .filter((k) => k in parts && ov[k] !== undefined)
    .map((k) => ({ line: k, computedPaise: parts[k] ?? 0, finalPaise: ov[k]!.finalPaise, reason: ov[k]!.reason }));
  return { grossPaise, otPaise, deductions, deductionsPaise, advanceOutstandingPaise, advanceRecoveredPaise, netPaise, paidPaise, roundingPaise, parts, overrides };
}

/** Problems with an override amount, or '' when it may be saved (SPEC-M14; the server checks the same). */
export function overrideError(line: WageLineKey, finalPaise: number, advanceOutstandingPaise: number): '' | 'not_integer' | 'negative' | 'rounding_limit' | 'over_outstanding' {
  if (!Number.isInteger(finalPaise)) return 'not_integer';
  if (line === 'rounding') return Math.abs(finalPaise) > 50 ? 'rounding_limit' : '';
  if (finalPaise < 0) return 'negative';
  if (line === 'advance_recovered' && finalPaise > advanceOutstandingPaise) return 'over_outstanding';
  return '';
}

export const rateOf = (w: WorkerP) => (w.payType === 'monthly' ? w.salaryPaise : w.payType === 'daily' ? w.dailyRatePaise : w.pieceRatePaise) ?? 0;

/**
 * Live inputs for a worker+month from the record stream and the unit's rules:
 * overtime counts only while the unit has it on (D-001); daily-rate workers get the off days the policy pays (D-002).
 */
export function wageInputsFor(recs: Rec[], w: WorkerP, month: string, settings: SettingP | undefined): WageInputs {
  const rules = unitRules(settings);
  const last = monthDays(month).at(-1)!;
  const a = monthAttendance(recs, w.entityId, month, last, settings);
  const p = monthPieces(recs, w.entityId, month);
  let present = a.present; let half = a.half; let offDays = 0;
  if (w.payType === 'daily') {
    const off = new Set(paidOffDays(recs, w.entityId, month, w.joinedOn, rules.offDayPolicy, settings?.holidays));
    offDays = off.size;
    const idx = attendanceIndex(recs);
    present = 0; half = 0;
    for (const d of monthDays(month)) {
      if (off.has(d)) continue; // a mark on a paid off day adds nothing: the day is paid once
      const m = idx.get(markKey(w.entityId, d));
      if (m?.status === 'present') present += 1; else if (m?.status === 'half') half += 1;
    }
  }
  return {
    payType: w.payType, ratePaise: rateOf(w), workingDays: settings?.workingDaysPerMonth ?? 26,
    present, half, absent: a.absent, offDays,
    otHours: rules.overtimeEnabled ? a.otHours : 0, otRatePaise: w.otRatePaise,
    pieces: p.count, pieceAmountPaise: p.amountPaise, overtimeEnabled: rules.overtimeEnabled, offDayPolicy: rules.offDayPolicy,
  };
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
    const settlement = settle(breakdown, payment?.payload.deductions ?? [], outstanding, payment?.payload.advanceRecoveredPaise, overrideMap(payment?.payload.overrides));
    return { worker, inputs, breakdown, outstanding, settlement, payment };
  });
}

// ---------- SPEC-M16 §1: a paid month is shown from the saved payment ----------

/** Snapshot saved with a new payment: everything the lines were computed from, and the rules in force. */
export function buildSnapshot(i: WageInputs, b: WageBreakdown, advanceOutstandingPaise: number, s?: Settlement): WageSnapshot {
  return {
    present: i.present, half: i.half, absent: i.absent, otHours: i.otHours, pieces: i.pieces, payType: i.payType, ratePaise: i.ratePaise,
    workingDays: i.workingDays, perDayPaise: b.perDayPaise, absentDeductPaise: b.absentDeductPaise, halfDeductPaise: b.halfDeductPaise,
    otRatePaise: i.otRatePaise, advanceOutstandingPaise,
    offDays: i.offDays, offDayPolicy: i.offDayPolicy, overtimeEnabled: i.overtimeEnabled,
    ...(s ? { parts: s.parts } : {}),
  };
}

/** Counts and rates of a paid month from its snapshot; any field an old snapshot lacks falls back to `live`. */
function inputsFromSnapshot(s: WageSnapshot | undefined, live: WageInputs): WageInputs {
  if (!s) return live;
  return {
    ...live,
    payType: s.payType ?? live.payType, ratePaise: s.ratePaise ?? live.ratePaise, workingDays: s.workingDays ?? live.workingDays,
    present: s.present ?? live.present, half: s.half ?? live.half, absent: s.absent ?? live.absent, offDays: s.offDays ?? 0,
    otHours: s.otHours ?? live.otHours, otRatePaise: s.otRatePaise ?? live.otRatePaise, pieces: s.pieces ?? live.pieces,
    pieceAmountPaise: s.parts?.pieces, overtimeEnabled: s.overtimeEnabled, offDayPolicy: s.offDayPolicy,
  };
}

/** What an overridden line replaced: the computed amount (same sign as the line) and the owner's reason. */
export interface LineOverride { computedPaise: number; reason: string }

/** One line of a wage breakdown. The UI turns `kind` + numbers into words in the active language. */
export type WageLine =
  | { kind: 'base'; key: 'base'; amountPaise: number; override?: LineOverride }
  | { kind: 'absent'; key: 'absent_deduct'; n: number; amountPaise: number; override?: LineOverride }
  | { kind: 'half'; key: 'half_deduct'; n: number; amountPaise: number; override?: LineOverride }
  | { kind: 'attendanceDeduct'; amountPaise: number }
  | { kind: 'days'; key: 'days'; present: number; half: number; ratePaise: number; amountPaise: number; override?: LineOverride }
  | { kind: 'offDays'; key: 'off_days'; n: number; ratePaise: number; amountPaise: number; override?: LineOverride }
  | { kind: 'pieces'; key: 'pieces'; pieces: number; amountPaise: number; override?: LineOverride }
  | { kind: 'ot'; key: 'overtime'; hours: number; ratePaise?: number; amountPaise: number; override?: LineOverride }
  | { kind: 'deduction'; label: string; amountPaise: number }
  | { kind: 'advance'; key: 'advance_recovered'; amountPaise: number; override?: LineOverride }
  | { kind: 'rounding'; key: 'rounding'; amountPaise: number; override?: LineOverride };

/** Everything a pay screen, slip or worker page shows for one worker-month. Signed amounts: deductions are negative. */
export interface WageView {
  payType: PayType; present: number; half: number; absent: number; offDays: number; otHours: number; pieces: number;
  ratePaise: number; perDayPaise?: number;
  lines: WageLine[];
  grossPaise: number; otPaise: number; netPaise: number; paidPaise: number; roundingPaise: number; advanceRecoveredPaise: number;
  deductions: DeductionLine[];
  overrides: WageOverride[];
  /** Advance still owed after this payment; undefined when an old payment did not save it. */
  balanceAfterPaise?: number;
}

const SUBTRACTED: WageLineKey[] = ['absent_deduct', 'half_deduct', 'advance_recovered'];
const sign = (k: WageLineKey, v: number) => (SUBTRACTED.includes(k) ? -v : v);

interface LineInput {
  payType: PayType; present: number; half: number; absent: number; offDays: number; otHours: number; pieces: number;
  ratePaise: number; otRatePaise?: number;
  parts: Partial<Record<WageLineKey, number>>; ov: OverrideMap; final: Partial<Record<WageLineKey, number>>;
  deductions: DeductionLine[];
}
/** Lines from computed parts and their final amounts; an overridden line carries what it replaced. */
function linesFrom(x: LineInput): WageLine[] {
  const fin = (k: WageLineKey) => x.final[k] ?? x.ov[k]?.finalPaise ?? x.parts[k] ?? 0;
  const ovr = (k: WageLineKey): LineOverride | undefined => (x.ov[k] ? { computedPaise: sign(k, x.parts[k] ?? 0), reason: x.ov[k]!.reason } : undefined);
  const has = (k: WageLineKey) => Boolean(x.ov[k]) || (x.parts[k] ?? 0) !== 0 || fin(k) !== 0;
  const out: WageLine[] = [];
  if (x.payType === 'monthly') {
    out.push({ kind: 'base', key: 'base', amountPaise: fin('base'), override: ovr('base') });
    if (has('absent_deduct')) out.push({ kind: 'absent', key: 'absent_deduct', n: x.absent, amountPaise: -fin('absent_deduct'), override: ovr('absent_deduct') });
    if (has('half_deduct')) out.push({ kind: 'half', key: 'half_deduct', n: x.half, amountPaise: -fin('half_deduct'), override: ovr('half_deduct') });
  } else if (x.payType === 'daily') {
    out.push({ kind: 'days', key: 'days', present: x.present, half: x.half, ratePaise: x.ratePaise, amountPaise: fin('days'), override: ovr('days') });
    if (has('off_days') || x.offDays > 0) out.push({ kind: 'offDays', key: 'off_days', n: x.offDays, ratePaise: x.ratePaise, amountPaise: fin('off_days'), override: ovr('off_days') });
  } else {
    out.push({ kind: 'pieces', key: 'pieces', pieces: x.pieces, amountPaise: fin('pieces'), override: ovr('pieces') });
  }
  if (has('overtime')) out.push({ kind: 'ot', key: 'overtime', hours: x.otHours, ratePaise: x.otRatePaise, amountPaise: fin('overtime'), override: ovr('overtime') });
  for (const d of x.deductions) out.push({ kind: 'deduction', label: d.label, amountPaise: -d.amountPaise });
  if (has('advance_recovered')) out.push({ kind: 'advance', key: 'advance_recovered', amountPaise: -fin('advance_recovered'), override: ovr('advance_recovered') });
  if (has('rounding')) out.push({ kind: 'rounding', key: 'rounding', amountPaise: fin('rounding'), override: ovr('rounding') });
  return out;
}

/** Older payments (before line parts were saved): lines rebuilt only from the stored record. */
function legacyLines(p: WagePaymentP, s: WageSnapshot): WageLine[] {
  const out: WageLine[] = [];
  if (s.payType === 'monthly') {
    out.push({ kind: 'base', key: 'base', amountPaise: s.ratePaise });
    const a = s.absentDeductPaise; const h = s.halfDeductPaise;
    if (a !== undefined && h !== undefined && s.ratePaise - a - h === p.grossPaise) {
      if (a) out.push({ kind: 'absent', key: 'absent_deduct', n: s.absent, amountPaise: -a });
      if (h) out.push({ kind: 'half', key: 'half_deduct', n: s.half, amountPaise: -h });
    } else if (s.ratePaise !== p.grossPaise) {
      out.push({ kind: 'attendanceDeduct', amountPaise: p.grossPaise - s.ratePaise });
    }
  } else if (s.payType === 'daily') out.push({ kind: 'days', key: 'days', present: s.present, half: s.half, ratePaise: s.ratePaise, amountPaise: p.grossPaise });
  else out.push({ kind: 'pieces', key: 'pieces', pieces: s.pieces, amountPaise: p.grossPaise });
  if (p.otPaise) out.push({ kind: 'ot', key: 'overtime', hours: s.otHours, ratePaise: s.otRatePaise, amountPaise: p.otPaise });
  for (const d of p.deductions) out.push({ kind: 'deduction', label: d.label, amountPaise: -d.amountPaise });
  if (p.advanceRecoveredPaise) out.push({ kind: 'advance', key: 'advance_recovered', amountPaise: -p.advanceRecoveredPaise });
  if (p.roundingPaise) out.push({ kind: 'rounding', key: 'rounding', amountPaise: p.roundingPaise });
  return out;
}

/** A paid month, built ONLY from the stored payment record (never from current rates or attendance). */
export function paidView(p: WagePaymentP): WageView {
  const s = p.snapshot ?? ({ present: 0, half: 0, absent: 0, otHours: 0, pieces: 0, payType: 'monthly', ratePaise: p.grossPaise } as WageSnapshot);
  const ov = overrideMap(p.overrides);
  const lines = s.parts
    ? linesFrom({
      payType: s.payType, present: s.present, half: s.half, absent: s.absent, offDays: s.offDays ?? 0, otHours: s.otHours, pieces: s.pieces,
      ratePaise: s.ratePaise, otRatePaise: s.otRatePaise, parts: s.parts, ov, deductions: p.deductions,
      final: { overtime: p.otPaise, advance_recovered: p.advanceRecoveredPaise, rounding: p.roundingPaise },
    })
    : legacyLines(p, s);
  return {
    payType: s.payType, present: s.present, half: s.half, absent: s.absent, offDays: s.offDays ?? 0, otHours: s.otHours, pieces: s.pieces,
    ratePaise: s.ratePaise, perDayPaise: s.perDayPaise, lines,
    grossPaise: p.grossPaise, otPaise: p.otPaise, netPaise: p.netPaise, paidPaise: p.paidPaise, roundingPaise: p.roundingPaise,
    advanceRecoveredPaise: p.advanceRecoveredPaise, deductions: p.deductions, overrides: p.overrides ?? [],
    balanceAfterPaise: s.advanceOutstandingPaise !== undefined ? Math.max(0, s.advanceOutstandingPaise - p.advanceRecoveredPaise) : undefined,
  };
}

/** A month not yet paid: today's suggestion from live inputs, with any overrides the owner has entered. */
export function liveView(i: WageInputs, b: WageBreakdown, s: Settlement): WageView {
  const ov = overrideMap(s.overrides);
  return {
    payType: i.payType, present: i.present, half: i.half, absent: i.absent, offDays: i.offDays, otHours: i.otHours, pieces: i.pieces,
    ratePaise: i.ratePaise, perDayPaise: i.payType === 'monthly' ? b.perDayPaise : undefined,
    lines: linesFrom({
      payType: i.payType, present: i.present, half: i.half, absent: i.absent, offDays: i.offDays, otHours: i.otHours, pieces: i.pieces,
      ratePaise: i.ratePaise, otRatePaise: i.otRatePaise, parts: s.parts, ov, deductions: s.deductions,
      final: { overtime: s.otPaise, advance_recovered: s.advanceRecoveredPaise, rounding: s.roundingPaise },
    }),
    grossPaise: s.grossPaise, otPaise: s.otPaise, netPaise: s.netPaise, paidPaise: s.paidPaise, roundingPaise: s.roundingPaise,
    advanceRecoveredPaise: s.advanceRecoveredPaise, deductions: s.deductions, overrides: s.overrides,
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
