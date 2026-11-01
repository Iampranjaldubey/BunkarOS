// Words, tones and signed amounts for wage lines (SPEC-M16): the same text on the pay screen, the slip and the worker page.
import { formatINR } from '../../domain/money';
import type { WageLine } from '../../domain/wage';

type T = (key: string, vars?: Record<string, string | number>) => string;
/** Words for one wage line (SPEC-M16: the same text on the pay screen, the slip and the worker page). */
export function wageLineText(l: WageLine, t: T): string {
  switch (l.kind) {
    case 'base': return t('wages.base');
    case 'absent': return t('wages.absentDeduct', { n: l.n });
    case 'half': return t('wages.halfDeduct', { n: l.n });
    case 'attendanceDeduct': return t('wages.attendanceDeduct');
    case 'days': return `${t('wages.daysWorked')}: ${l.present}${l.half ? ` + ${l.half}×½` : ''} × ${formatINR(l.ratePaise)}`;
    case 'pieces': return `${t('wages.pieces')}: ${l.pieces}`;
    case 'ot': return `${t('wages.ot')}: ${l.hours}h${l.ratePaise ? ` × ${formatINR(l.ratePaise)}` : ''}`;
    case 'deduction': return l.label;
    case 'advance': return t('wages.advances');
    case 'rounding': return t('wages.rounding');
  }
}
export function wageLineTone(l: WageLine): 'given' | 'received' | 'neutral' {
  if (l.kind === 'ot') return 'received';
  if (l.kind === 'rounding' || l.kind === 'base' || l.kind === 'days' || l.kind === 'pieces') return 'neutral';
  return l.amountPaise < 0 ? 'given' : 'neutral';
}
/** "−₹923.08" / "₹12,000": paise shown only when not whole rupees. */
export function signedINR(v: number): string { return `${v < 0 ? '−' : ''}${formatINR(Math.abs(v), { paise: v % 100 !== 0 })}`; }
