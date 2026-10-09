// Bunkar OS — human-friendly dates (M1). Pure. Days are 'YYYY-MM-DD' in Asia/Kolkata.
import type { Lang } from '../db/types.ts';

const LOCALE: Record<Lang, string> = { hi: 'hi-IN', en: 'en-IN' };

function noonIST(day: string): Date {
  const d = new Date(`${day}T12:00:00+05:30`);
  if (Number.isNaN(d.getTime())) throw new RangeError('formatDay: invalid day');
  return d;
}

/** "शुक्रवार, 9 अक्टूबर 2026" / "Friday, 9 October 2026" (style 'long', default). */
export function formatDay(day: string, lang: Lang, style: 'long' | 'medium' | 'short' = 'long'): string {
  const opts: Intl.DateTimeFormatOptions =
    style === 'long' ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : style === 'medium' ? { day: 'numeric', month: 'long', year: 'numeric' }
        : { day: 'numeric', month: 'short' };
  return new Intl.DateTimeFormat(LOCALE[lang], { ...opts, timeZone: 'Asia/Kolkata' }).format(noonIST(day));
}

/** Time of an ISO instant in IST, e.g. "6:40 pm". */
export function formatTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new RangeError('formatTime: invalid instant');
  return new Intl.DateTimeFormat(LOCALE[lang], { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(d);
}
