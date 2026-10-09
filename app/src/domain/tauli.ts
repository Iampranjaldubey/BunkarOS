// Bunkar OS — tauli (weighment) computation (D1). Weights in integer grams.
import type { TauliResult } from '../db/types.ts';

/**
 * D1 tauli:
 *   used    = issued - returned
 *   allowed = round(used * wastagePct / 100)
 *   gap     = used - carpet
 *   short   = max(0, gap - allowed)
 *   extra   = max(0, carpet - used)
 *   expectedG = round(area * norm)  when norm known (reference line)
 */
export function computeTauli(input: {
  issuedG: number;
  returnedG: number;
  carpetG: number;
  wastagePct: number;
  areaSqft: number;
  normGPerSqft?: number;
}): TauliResult {
  const { issuedG, returnedG, carpetG, wastagePct, areaSqft, normGPerSqft } = input;
  if (issuedG < 0 || returnedG < 0 || carpetG < 0) {
    throw new RangeError('computeTauli: weights must be >= 0');
  }
  const usedG = issuedG - returnedG;
  const allowedG = Math.round((usedG * wastagePct) / 100);
  const gapG = usedG - carpetG;
  const shortG = Math.max(0, gapG - allowedG);
  const extraG = Math.max(0, carpetG - usedG);
  const result: TauliResult = {
    issuedG,
    returnedG,
    usedG,
    wastagePct,
    allowedG,
    gapG,
    shortG,
    extraG,
  };
  if (normGPerSqft !== undefined) {
    result.normGPerSqft = normGPerSqft;
    result.expectedG = Math.round(areaSqft * normGPerSqft);
  }
  return result;
}
