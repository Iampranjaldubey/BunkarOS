import type { MonthAttendance } from '../../domain/attendance';
import { weekday } from '../../domain/ids';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';
import { Knot } from '../../components/carpet/Carpet';
import { knotClass, type KnotState } from '../../components/carpet/knots';

/**
 * SPEC-M17 naksha: one month of marks as knot cells, like the chart a weaver knots from.
 * Present = filled, half = filled on the diagonal, absent = empty with a mark, Sunday / holiday = hatched,
 * paid off day of a daily-rate worker = hatched green with "₹" (D-002), unmarked past day = dashed "?", future = blank.
 * Letters stay in every cell so the grid reads without colour. Overtime only while the unit has it on.
 */
export function MonthGrid({ att, today, holidays = [], showOt = true, paidOff = [] }: { att: MonthAttendance; today: string; holidays?: string[]; showOt?: boolean; paidOff?: string[] }) {
  const { t } = useT();
  const hol = new Set(holidays);
  const paid = new Set(paidOff);
  const days = Object.keys(att.days);
  // Monday-first week rows so Sundays line up in the last column, as on a wall calendar.
  const lead = days.length ? (weekday(days[0]) + 6) % 7 : 0;
  const stateOf = (day: string): KnotState => {
    const m = att.days[day];
    if (paid.has(day)) return 'paid';
    if (m?.status === 'present') return 'present';
    if (m?.status === 'half') return 'half';
    if (m?.status === 'absent') return 'absent';
    if (weekday(day) === 0 || hol.has(day)) return 'off';
    if (day > today) return 'future';
    return 'unmarked';
  };
  const letter = (day: string, s: KnotState) => {
    const m = att.days[day];
    if (s === 'paid') return <><span>₹</span>{m?.status === 'present' && <span className="text-xs font-medium">P</span>}{m?.status === 'half' && <span className="text-xs font-medium">H</span>}</>;
    if (s === 'present') return <><span>P</span>{showOt && m && m.otHours > 0 && <span className="num text-xs font-medium">+{m.otHours}h</span>}</>;
    if (s === 'half') return <><span>H</span>{showOt && m && m.otHours > 0 && <span className="num text-xs font-medium">+{m.otHours}h</span>}</>;
    if (s === 'absent') return <span>A</span>;
    if (s === 'unmarked') return <span>?</span>;
    return null;
  };
  const weekLabels = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1.5" aria-hidden="true">
        {weekLabels.map((w) => <span key={w} className={cn('text-center text-xs', w === 0 ? 'text-given' : 'text-muted')}>{t(`week.${w}`)}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5" data-testid="month-grid">
        {Array.from({ length: lead }, (_, i) => <span key={`lead${i}`} aria-hidden="true" />)}
        {days.map((d, i) => {
          const s = stateOf(d);
          const row = Math.floor((i + lead) / 7);
          return (
            <div key={d} className="weave-row" style={{ ['--row' as string]: row }}>
              <div className={cn('knot h-11 w-full flex-col gap-0.5 text-sm', knotClass(s))}
                title={s === 'paid' ? t('att.paidOff') : undefined} {...(s === 'paid' ? { 'data-paid-off': d } : {})}>
                <span className={cn('num absolute left-1 top-0.5 text-xs font-normal leading-none', s === 'present' || s === 'half' ? 'opacity-80' : 'text-muted')}>{Number(d.slice(8))}</span>
                <span className="mt-2 flex flex-col items-center leading-none">{letter(d, s)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><Knot state="present" size={12} />P</span>
        <span className="inline-flex items-center gap-1"><Knot state="half" size={12} />H</span>
        <span className="inline-flex items-center gap-1"><Knot state="absent" size={12} />A</span>
        <span>{t('att.legend')}</span>
        {paid.size > 0 && <span className="inline-flex items-center gap-1"><Knot state="paid" size={12} />₹ {t('att.paidOff')}: {paid.size}</span>}
        {att.unmarked > 0 && <span>? {t('att.unmarked')}: {att.unmarked}</span>}
      </p>
    </div>
  );
}
