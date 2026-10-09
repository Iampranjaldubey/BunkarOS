// Bunkar OS — money (integer paise). Indian grouping. Half-up rupee rounding (D6).

/**
 * Format paise as Indian-grouped INR.
 * Default shows whole rupees: "₹3,015". With {paise:true}: "₹3,014.54".
 */
export function formatINR(paise: number, opts?: { paise?: boolean }): string {
  const showPaise = opts?.paise === true;
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const grouped = groupIndian(rupees);
  let out = `₹${grouped}`;
  if (showPaise) {
    const p = abs % 100;
    out = `₹${grouped}.${String(p).padStart(2, '0')}`;
  }
  return negative ? `-${out}` : out;
}

/** Indian digit grouping for a non-negative integer rupee value. */
function groupIndian(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  // group the rest in pairs
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${grouped},${last3}`;
}

/** Rupees (number, may be fractional) → integer paise (rounded half-up). */
export function rupeesToPaise(n: number): number {
  return Math.round(n * 100);
}

/**
 * Round a paise amount up to the nearest whole rupee, half-up (D6).
 * Returns the rounded `paid` amount and the `rounding` delta (paid - paise).
 * Example: 195454 → { paid: 195500, rounding: 46 }.
 */
export function roundToRupee(paise: number): { paid: number; rounding: number } {
  const rem = ((paise % 100) + 100) % 100;
  let paid: number;
  if (rem === 0) paid = paise;
  else if (rem >= 50) paid = paise - rem + 100;
  else paid = paise - rem;
  return { paid, rounding: paid - paise };
}
