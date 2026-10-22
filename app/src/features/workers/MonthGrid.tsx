import type { MonthAttendance } from '../../domain/attendance';
import { weekday } from '../../domain/ids';
import { useT } from '../../i18n';

/** Calendar grid of one month's marks: P / H / A, overtime, Sundays and holidays dotted, future blank. */
export function MonthGrid({ att, today, holidays = [] }: { att: MonthAttendance; today: string; holidays?: string[] }) {
  const { t } = useT();
  const hol = new Set(holidays);
  const days = Object.keys(att.days);
  const cell = (day: string) => {
    const m = att.days[day];
    const off = weekday(day) === 0 || hol.has(day);
    const base = 'flex h-11 flex-col items-center justify-center rounded-lg text-xs font-semibold';
    if (m?.status === 'present') return <div className={`${base} bg-received-soft text-received`}><span>P</span>{m.otHours > 0 && <span className="num text-[10px] font-medium">+{m.otHours}h</span>}</div>;
    if (m?.status === 'half') return <div className={`${base} bg-accent-soft text-accent-ink`}><span>H</span>{m.otHours > 0 && <span className="num text-[10px] font-medium">+{m.otHours}h</span>}</div>;
    if (m?.status === 'absent') return <div className={`${base} bg-given-soft text-given`}><span>A</span></div>;
    if (off) return <div className={`${base} bg-surface-2 text-muted`}>·</div>;
    if (day > today) return <div className={`${base} text-line`}> </div>;
    return <div className={`${base} border border-dashed border-line text-muted`}>?</div>;
  };
  return (
    <div>
      <div className="grid grid-cols-7 gap-1" data-testid="month-grid">
        {days.map((d) => <div key={d}><p className={`num mb-0.5 text-center text-[10px] ${weekday(d) === 0 ? 'text-given' : 'text-muted'}`}>{Number(d.slice(8))}</p>{cell(d)}</div>)}
      </div>
      <p className="mt-2 text-xs text-muted">{t('att.legend')}{att.unmarked > 0 ? ` · ? ${t('att.unmarked')}: ${att.unmarked}` : ''}</p>
    </div>
  );
}
