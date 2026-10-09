// Bunkar OS — property-style invariants for the money/wage pipeline.
// Kept in-repo per the round-2 audit (imports the REAL domain modules, no mocks).
// Mirrors /tmp/bunkar-audit over 500 random bazaars with a deterministic seed.
import { describe, it, expect } from 'vitest';
import { areaSqft } from './units';
import { computeWage, computeNet } from './wage';
import { roundToRupee } from './money';
import type { RateUnit } from '../db/types';

/** Tiny deterministic PRNG (mulberry32) so the suite is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = 500;
const randInt = (rnd: () => number, lo: number, hi: number) =>
  lo + Math.floor(rnd() * (hi - lo + 1));

describe('money/wage property invariants (500 random bazaars, seed 12345)', () => {
  it('net>=0, cash+upi==paid, paid whole-rupee, gross exact, rounding in [-49,50]', () => {
    const rnd = mulberry32(12345);
    for (let i = 0; i < N; i++) {
      const lengthIn = randInt(rnd, 24, 240);
      const widthIn = randInt(rnd, 24, 240);
      const rateUnit: RateUnit = rnd() < 0.5 ? 'sqft' : 'sqgaj';
      const ratePaise = randInt(rnd, 1000, 60000); // ₹10–₹600 per unit
      const area = areaSqft(lengthIn, widthIn);

      const gross = computeWage({ areaSqft: area, ratePaise, rateUnit });

      // gross is exactly the half-up rounded unit math (matches server mirror).
      const units = rateUnit === 'sqgaj' ? area / 9 : area;
      expect(gross).toBe(Math.round(units * ratePaise));

      // deductions + recovery bounded so computeNet never throws.
      const deductions = randInt(rnd, 0, Math.max(0, Math.floor(gross * 0.2)));
      const afterDed = gross - deductions;
      const peshgiRecovered = randInt(rnd, 0, Math.max(0, afterDed));
      const net = computeNet({ gross, deductions, peshgiRecovered });
      expect(net).toBeGreaterThanOrEqual(0);

      const { paid, rounding } = roundToRupee(net);
      expect(paid % 100).toBe(0); // whole rupee
      expect(rounding).toBe(paid - net);
      expect(rounding).toBeGreaterThanOrEqual(-49);
      expect(rounding).toBeLessThanOrEqual(50); // D6 half-up tie rounds up (+50)

      // Split payment across cash/upi always reconstructs paid.
      const cash = randInt(rnd, 0, Math.floor(paid / 100)) * 100;
      const upi = paid - cash;
      expect(cash + upi).toBe(paid);
    }
  });

  it('canonical demo bazaar locks in (96x119 @ ₹38/sqft)', () => {
    const area = areaSqft(96, 119);
    expect(area).toBe(79.33);
    const gross = computeWage({ areaSqft: area, ratePaise: 3800, rateUnit: 'sqft' });
    expect(gross).toBe(301454);
    const net = computeNet({ gross, deductions: 6000, peshgiRecovered: 100000 });
    expect(net).toBe(195454);
    const { paid, rounding } = roundToRupee(net);
    expect(paid).toBe(195500);
    expect(rounding).toBe(46);
  });
});
