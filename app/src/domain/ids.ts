// ids & day helpers (pure). Days are 'YYYY-MM-DD' in Asia/Kolkata (UTC+5:30, no DST).
export function uuid(): string { return crypto.randomUUID(); }

const IST_MS = 5.5 * 60 * 60 * 1000;

export function istDay(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) throw new RangeError('istDay: invalid date');
  const s = new Date(d.getTime() + IST_MS);
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, '0')}-${String(s.getUTCDate()).padStart(2, '0')}`;
}
export function todayIST(): string { return istDay(new Date()); }

/** Whole days dayB − dayA. */
export function daysBetween(dayA: string, dayB: string): number {
  const a = Date.parse(`${dayA}T00:00:00Z`); const b = Date.parse(`${dayB}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) throw new RangeError('daysBetween: invalid day');
  return Math.round((b - a) / 86_400_000);
}
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** 'YYYY-MM' of a day. */
export function monthOf(day: string): string { return day.slice(0, 7); }
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
/** Every day of a month as 'YYYY-MM-DD'. */
export function monthDays(month: string): string[] {
  const n = daysInMonth(month);
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}
export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
/** 0 = Sunday … 6 = Saturday for a day string. */
export function weekday(day: string): number { return new Date(`${day}T00:00:00Z`).getUTCDay(); }
