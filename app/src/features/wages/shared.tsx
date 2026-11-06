import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonth } from '../../domain/dates';
import { monthOf, prevMonth, nextMonth, todayIST } from '../../domain/ids';
import { useT } from '../../i18n';


/** ‹ अक्टूबर 2026 › month stepper (next disabled beyond the current month). */
export function MonthPicker({ month, onChange, lang: forceLang }: { month: string; onChange: (m: string) => void; lang?: 'hi' | 'hin' | 'en' }) {
  const { t, lang: uiLang } = useT();
  const lang = forceLang ?? uiLang;
  const cur = monthOf(todayIST());
  return (
    <div className="flex items-center gap-1 rounded-xl border border-line bg-surface" data-testid="month-picker">
      <button type="button" onClick={() => onChange(prevMonth(month))} aria-label={t('action.back')} className="tap-48 inline-flex items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"><ChevronLeft aria-hidden="true" strokeWidth={1.75} /></button>
      <span className="num min-w-36 text-center text-lg font-medium text-ink">{formatMonth(month, lang)}</span>
      <button type="button" onClick={() => onChange(nextMonth(month))} disabled={month >= cur} aria-label={t('action.next')} className="tap-48 inline-flex items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"><ChevronRight aria-hidden="true" strokeWidth={1.75} /></button>
    </div>
  );
}
