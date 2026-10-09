// Bunkar OS — unit conversions (pure).
// Lengths in INCHES (may be fractional). Area in SQ FT (2 dp). Weights in GRAMS (int).

/** Feet + inches → total inches. */
export function ftInToIn(ft: number, inch: number): number {
  return ft * 12 + inch;
}

/** Total inches → { ft, in } with 0 <= in < 12. Inches rounded to nearest whole inch. */
export function inToFtIn(inches: number): { ft: number; in: number } {
  const total = Math.round(inches);
  const ft = Math.floor(total / 12);
  return { ft, in: total - ft * 12 };
}

/** Total inches → human string like 8'0" (inches rounded to whole). */
export function formatFtIn(inches: number): string {
  const { ft, in: inch } = inToFtIn(inches);
  return `${ft}'${inch}"`;
}

/** Area in square feet (2 dp) from length & width in inches. */
export function areaSqft(lengthIn: number, widthIn: number): number {
  const sqft = (lengthIn * widthIn) / 144;
  return Math.round(sqft * 100) / 100;
}

/** Grams → kilograms string with exactly 3 decimals (D6), e.g. 12000 → "12.000". */
export function gramsToKgStr(g: number): string {
  return (g / 1000).toFixed(3);
}

/** Kg string (e.g. "12.000") → integer grams. */
export function kgStrToGrams(s: string): number {
  const kg = Number.parseFloat(s);
  if (Number.isNaN(kg)) throw new RangeError('kgStrToGrams: invalid number');
  return Math.round(kg * 1000);
}

/**
 * Parse a feet-inches string like 9'11", 8', 8'0", or 0 into total inches.
 * Accepts fractional inches ("9'11.5\""). Returns 0 for empty/zero width.
 */
export function parseFtIn(s: string): number {
  const trimmed = s.trim();
  if (trimmed === '' || trimmed === '0') return 0;
  const m = trimmed.match(/^(\d+(?:\.\d+)?)\s*'(?:\s*(\d+(?:\.\d+)?)\s*"?)?$/);
  if (m) {
    const ft = Number.parseFloat(m[1]);
    const inch = m[2] !== undefined ? Number.parseFloat(m[2]) : 0;
    return ft * 12 + inch;
  }
  // bare inches like 11" or 11
  const mi = trimmed.match(/^(\d+(?:\.\d+)?)\s*"?$/);
  if (mi) return Number.parseFloat(mi[1]);
  throw new RangeError(`parseFtIn: cannot parse "${s}"`);
}
