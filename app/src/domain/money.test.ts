import { describe, it, expect } from 'vitest';
import { formatINR, rupeesToPaise, roundToRupee } from './money.ts';

describe('money', () => {
  it('formatINR whole rupees with Indian grouping', () => {
    expect(formatINR(301500)).toBe('₹3,015');
    expect(formatINR(195500)).toBe('₹1,955');
    expect(formatINR(10000000)).toBe('₹1,00,000');
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(100000000)).toBe('₹10,00,000');
  });

  it('formatINR with paise', () => {
    expect(formatINR(301454, { paise: true })).toBe('₹3,014.54');
    expect(formatINR(5, { paise: true })).toBe('₹0.05');
  });

  it('formatINR negatives', () => {
    expect(formatINR(-301500)).toBe('-₹3,015');
  });

  it('rupeesToPaise', () => {
    expect(rupeesToPaise(3015)).toBe(301500);
    expect(rupeesToPaise(30.14)).toBe(3014);
    expect(rupeesToPaise(30.145)).toBe(3015); // half-up on paise
  });

  it('roundToRupee half-up (D6 demo 195454 -> 195500, +46)', () => {
    expect(roundToRupee(195454)).toEqual({ paid: 195500, rounding: 46 });
    // exactly x.50 paise rounds up
    expect(roundToRupee(301450)).toEqual({ paid: 301500, rounding: 50 });
    // just below half rounds down
    expect(roundToRupee(301449)).toEqual({ paid: 301400, rounding: -49 });
    // already whole rupee
    expect(roundToRupee(301500)).toEqual({ paid: 301500, rounding: 0 });
    // 301454 -> down to 301400 (rem 54 >=50 -> up)
    expect(roundToRupee(301454)).toEqual({ paid: 301500, rounding: 46 });
  });
});
