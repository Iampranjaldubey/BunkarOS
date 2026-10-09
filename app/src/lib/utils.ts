import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format paise as Indian-grouped rupees, e.g. 301500 -> "₹3,015".
 * `withPaise` keeps the two decimal places. This is a UI fallback; the domain
 * agent owns the canonical `formatINR` in src/domain/money.ts.
 */
export function formatINR(paise: number, opts: { paise?: boolean } = {}): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const grouped = rupees.toLocaleString('en-IN');
  const body = opts.paise ? `${grouped}.${String(abs % 100).padStart(2, '0')}` : grouped;
  return `${neg ? '-' : ''}₹${body}`;
}

/** Grams (integer) -> kilogram string with 3 decimals, e.g. 12000 -> "12.000". */
export function gramsToKgStr(grams: number): string {
  return (grams / 1000).toFixed(3);
}
