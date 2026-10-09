import { describe, it, expect } from 'vitest';
import { computeWage, computeNet } from './wage.ts';

describe('wage', () => {
  it('sqft wage', () => {
    // 59.5 sqft @ ₹50.66/sqft = 5066 paise -> 59.5*5066 = 301427
    expect(computeWage({ areaSqft: 59.5, ratePaise: 5066, rateUnit: 'sqft' })).toBe(301427);
  });

  it('sqgaj wage = round(area/9 * rate)', () => {
    // 59.5 sqft -> /9 = 6.6111 sq gaj @ ₹456/gaj (45600 paise)
    // 59.5/9*45600 = 301466.67 -> 301467
    expect(computeWage({ areaSqft: 59.5, ratePaise: 45600, rateUnit: 'sqgaj' })).toBe(301467);
    // simple: 9 sqft @ 100 paise/gaj = 100
    expect(computeWage({ areaSqft: 9, ratePaise: 100, rateUnit: 'sqgaj' })).toBe(100);
  });

  it('wage rejects negatives', () => {
    expect(() => computeWage({ areaSqft: -1, ratePaise: 100, rateUnit: 'sqft' })).toThrow(RangeError);
    expect(() => computeWage({ areaSqft: 1, ratePaise: -1, rateUnit: 'sqft' })).toThrow(RangeError);
  });

  it('piece wage = flat rate, independent of area (SPEC-016 AC1)', () => {
    // ₹8,000 flat per carpet regardless of size.
    expect(computeWage({ areaSqft: 79.33, ratePaise: 800000, rateUnit: 'piece' })).toBe(800000);
    expect(computeWage({ areaSqft: 1, ratePaise: 800000, rateUnit: 'piece' })).toBe(800000);
    expect(computeWage({ areaSqft: 0, ratePaise: 800000, rateUnit: 'piece' })).toBe(800000);
  });

  it('weaving wage rejects kg/day units (RangeError)', () => {
    expect(() => computeWage({ areaSqft: 10, ratePaise: 100, rateUnit: 'kg' })).toThrow(RangeError);
    expect(() => computeWage({ areaSqft: 10, ratePaise: 100, rateUnit: 'day' })).toThrow(RangeError);
  });

  it('computeNet subtracts deductions and recovery', () => {
    expect(computeNet({ gross: 301454, deductions: 5000, peshgiRecovered: 100000 })).toBe(196454);
    expect(computeNet({ gross: 100000, deductions: 0, peshgiRecovered: 0 })).toBe(100000);
  });

  it('computeNet throws if recovery > gross - deductions', () => {
    expect(() => computeNet({ gross: 100000, deductions: 10000, peshgiRecovered: 95000 })).toThrow(RangeError);
    expect(() => computeNet({ gross: 100000, deductions: 110000, peshgiRecovered: 0 })).toThrow(RangeError);
  });

  it('computeNet allows recovery exactly equal to remainder', () => {
    expect(computeNet({ gross: 100000, deductions: 10000, peshgiRecovered: 90000 })).toBe(0);
  });
});
