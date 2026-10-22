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
    <div className="flex items-center gap-1" data-testid="month-picker">
      <button type="button" onClick={() => onChange(prevMonth(month))} aria-label={t('action.back')} className="tap-48 rounded-xl text-muted hover:bg-surface-2"><ChevronLeft aria-hidden="true" /></button>
      <span className="min-w-36 text-center text-lg font-medium text-ink">{formatMonth(month, lang)}</span>
      <button type="button" onClick={() => onChange(nextMonth(month))} disabled={month >= cur} aria-label={t('action.next')} className="tap-48 rounded-xl text-muted hover:bg-surface-2 disabled:opacity-30"><ChevronRight aria-hidden="true" /></button>
    </div>
  );
}
