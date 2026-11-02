// Words, tones and signed amounts for wage lines (SPEC-M16): the same text on the pay screen, the slip and the worker page.
// Also the slip content (D-003, SPEC-M02): one list of rows used by the printed A4 slip and the WhatsApp text.
import { formatINR } from '../../domain/money';
import type { WageLine, WageView } from '../../domain/wage';
import type { PayMode, SlipSection, WageLineKey } from '../../db/types';

type T = (key: string, vars?: Record<string, string | number>) => string;
/** Words for one wage line (SPEC-M16: the same text on the pay screen, the slip and the worker page). */
export function wageLineText(l: WageLine, t: T): string {
  switch (l.kind) {
    case 'base': return t('wages.base');
    case 'absent': return t('wages.absentDeduct', { n: l.n });
    case 'half': return t('wages.halfDeduct', { n: l.n });
    case 'attendanceDeduct': return t('wages.attendanceDeduct');
    case 'days': return `${t('wages.daysWorked')}: ${l.present}${l.half ? ` + ${l.half}×½` : ''} × ${formatINR(l.ratePaise)}`;
    case 'offDays': return `${t('wages.offDays')}: ${l.n} × ${formatINR(l.ratePaise)}`;
    case 'pieces': return `${t('wages.pieces')}: ${l.pieces}`;
    case 'ot': return `${t('wages.ot')}: ${l.hours}h${l.ratePaise ? ` × ${formatINR(l.ratePaise)}` : ''}`;
    case 'deduction': return l.label;
    case 'advance': return t('wages.advances');
    case 'rounding': return t('wages.rounding');
  }
}
/** Short name of an overridable line (override sheet, entry log, slip "owner changes"). */
export function lineKeyName(k: WageLineKey, t: T): string { return t(`wages.line.${k}`); }

export function wageLineTone(l: WageLine): 'given' | 'received' | 'neutral' {
  if (l.kind === 'ot') return 'received';
  if (l.kind === 'rounding' || l.kind === 'base' || l.kind === 'days' || l.kind === 'pieces' || l.kind === 'offDays') return 'neutral';
  return l.amountPaise < 0 ? 'given' : 'neutral';
}
/** "−₹923.08" / "₹12,000": paise shown only when not whole rupees. */
export function signedINR(v: number): string { return `${v < 0 ? '−' : ''}${formatINR(Math.abs(v), { paise: v % 100 !== 0 })}`; }

export interface SlipRow { section: SlipSection | 'rounding'; label: string; value: string; strong?: boolean }
export interface SlipContent { business: string; worker: string; month: string; rows: SlipRow[]; signature: boolean }

/**
 * The slip's rows from a paid month's view and the owner's chosen sections (D-003).
 * Gross = gross pay + overtime. A Rounding row appears whenever rounding is not zero, so the rows add up to net pay.
 */
export function slipContent(input: {
  view: WageView; sections: Record<SlipSection, boolean>; t: T; overtimeEnabled: boolean;
  business: string; worker: string; month: string; payDay?: string; mode?: PayMode; payDayText?: string;
}): SlipContent {
  const { view: v, sections: on, t } = input;
  const rows: SlipRow[] = [];
  if (on.attendance) rows.push({ section: 'attendance', label: t('slip.sec.attendance'), value: `P ${v.present} · H ${v.half} · A ${v.absent}` });
  if (on.offDays && v.payType === 'daily') rows.push({ section: 'offDays', label: t('slip.sec.offDays'), value: String(v.offDays) });
  if (on.pieces && v.payType === 'piece') rows.push({ section: 'pieces', label: t('slip.sec.pieces'), value: String(v.pieces) });
  if (on.rate) rows.push({ section: 'rate', label: t('slip.sec.rate'), value: `${formatINR(v.ratePaise)} ${t(`slip.per.${v.payType}`)}` });
  if (on.gross) rows.push({ section: 'gross', label: t('slip.sec.gross'), value: signedINR(v.grossPaise + v.otPaise) });
  if (on.overtime && input.overtimeEnabled) rows.push({ section: 'overtime', label: t('slip.sec.overtime'), value: `${v.otHours}h · ${signedINR(v.otPaise)}` });
  if (on.deductions) {
    if (v.deductions.length === 0) rows.push({ section: 'deductions', label: t('slip.sec.deductions'), value: formatINR(0) });
    for (const d of v.deductions) rows.push({ section: 'deductions', label: `${t('slip.sec.deductions')}: ${d.label}`, value: signedINR(-d.amountPaise) });
  }
  if (on.advance) rows.push({ section: 'advance', label: t('slip.sec.advance'), value: signedINR(-v.advanceRecoveredPaise) });
  if (v.roundingPaise !== 0) rows.push({ section: 'rounding', label: t('wages.rounding'), value: signedINR(v.roundingPaise) });
  rows.push({ section: 'net', label: t('slip.sec.net'), value: formatINR(v.paidPaise), strong: true });
  if (on.ownerChanges) for (const o of v.overrides) rows.push({ section: 'ownerChanges', label: `${t('slip.sec.ownerChanges')}: ${lineKeyName(o.line, t)}`, value: `${signedINR(o.computedPaise)} → ${signedINR(o.finalPaise)} (${o.reason})` });
  if (on.advanceBalance && v.balanceAfterPaise !== undefined) rows.push({ section: 'advanceBalance', label: t('slip.sec.advanceBalance'), value: formatINR(v.balanceAfterPaise) });
  if (on.payment && input.payDayText) rows.push({ section: 'payment', label: t('slip.sec.payment'), value: `${input.payDayText}${input.mode ? ` · ${t(`common.${input.mode}`)}` : ''}` });
  return { business: input.business, worker: input.worker, month: input.month, rows, signature: on.signature };
}

/** WhatsApp text: the same fields as the printed slip, plus the link to the worker's own page. */
export function slipText(c: SlipContent, t: T, link?: string): string {
  const lines = [`*${c.business}*`, `${t('slip.title')} — ${c.month}`, `${t('slip.sec.workerName')}: ${c.worker}`, ...c.rows.map((r) => (r.strong ? `*${r.label}: ${r.value}*` : `${r.label}: ${r.value}`))];
  if (link) lines.push('', t('slip.link', { url: link }));
  return lines.join('\n');
}
