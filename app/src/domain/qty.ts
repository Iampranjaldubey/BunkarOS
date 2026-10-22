// Quantities are integer THOUSANDTHS of the item's unit (grams for kg, pcs×1000 for pieces).
import type { ItemUnit } from '../db/types.ts';

/** "12.500" for kg/litre/metre; "12" for pcs. */
export function formatQty(thousandths: number, unit: ItemUnit): string {
  const neg = thousandths < 0; const abs = Math.abs(thousandths);
  const whole = Math.floor(abs / 1000); const frac = abs % 1000;
  const s = unit === 'pcs' && frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(3, '0')}`;
  return neg ? `-${s}` : s;
}
/** Parse a user-typed quantity ("12.5", "12,500") into thousandths; null if invalid. */
export function parseQty(input: string): number | null {
  const s = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{0,3})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  return Number(w) * 1000 + Number((f + '000').slice(0, 3));
}
