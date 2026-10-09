// Bunkar OS — wage computation (pure). Money in integer paise.
import type { RateUnit } from '../db/types.ts';

/**
 * Gross wage in paise.
 * sqft: wage = round(areaSqft * ratePaise).
 * sqgaj: 1 sq gaj = 9 sq ft → wage = round(areaSqft / 9 * ratePaise).
 * piece: flat ratePaise per carpet, independent of area.
 * kg/day are ancillary job units, invalid for weaving → RangeError.
 */
export function computeWage(input: { areaSqft: number; ratePaise: number; rateUnit: RateUnit }): number {
  const { areaSqft, ratePaise, rateUnit } = input;
  if (ratePaise < 0) throw new RangeError('computeWage: ratePaise must be >= 0');
  if (rateUnit === 'kg' || rateUnit === 'day') {
    throw new RangeError(`computeWage: rateUnit '${rateUnit}' is not valid for weaving`);
  }
  if (rateUnit === 'piece') return ratePaise;
  if (areaSqft < 0) throw new RangeError('computeWage: areaSqft must be >= 0');
  const units = rateUnit === 'sqgaj' ? areaSqft / 9 : areaSqft;
  return Math.round(units * ratePaise);
}

/**
 * Net payable in paise after deductions and peshgi recovery.
 * computeNet throws RangeError if recovery exceeds (gross - deductions).
 */
export function computeNet(input: { gross: number; deductions: number; peshgiRecovered: number }): number {
  const { gross, deductions, peshgiRecovered } = input;
  if (gross < 0) throw new RangeError('computeNet: gross must be >= 0');
  if (deductions < 0) throw new RangeError('computeNet: deductions must be >= 0');
  if (peshgiRecovered < 0) throw new RangeError('computeNet: peshgiRecovered must be >= 0');
  const afterDeductions = gross - deductions;
  if (afterDeductions < 0) throw new RangeError('computeNet: deductions exceed gross');
  if (peshgiRecovered > afterDeductions) {
    throw new RangeError('computeNet: peshgi recovery exceeds net after deductions');
  }
  return afterDeductions - peshgiRecovered;
}
