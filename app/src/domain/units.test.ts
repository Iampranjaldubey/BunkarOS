import { describe, it, expect } from 'vitest';
import { ftInToIn, inToFtIn, formatFtIn, areaSqft, gramsToKgStr, kgStrToGrams, parseFtIn } from './units.ts';

describe('units', () => {
  it('ftInToIn and inToFtIn round-trip', () => {
    expect(ftInToIn(8, 0)).toBe(96);
    expect(ftInToIn(9, 11)).toBe(119);
    expect(inToFtIn(96)).toEqual({ ft: 8, in: 0 });
    expect(inToFtIn(119)).toEqual({ ft: 9, in: 11 });
  });

  it('formatFtIn', () => {
    expect(formatFtIn(96)).toBe("8'0\"");
    expect(formatFtIn(119)).toBe("9'11\"");
    expect(formatFtIn(0)).toBe("0'0\"");
  });

  it('areaSqft 2dp', () => {
    // 119 x 72 in = 8568 sq in / 144 = 59.5 sq ft
    expect(areaSqft(119, 72)).toBe(59.5);
    // 96 x 60 = 5760/144 = 40
    expect(areaSqft(96, 60)).toBe(40);
    // rounding to 2dp
    expect(areaSqft(100, 50)).toBe(34.72);
  });

  it('zero width area is 0', () => {
    expect(areaSqft(119, 0)).toBe(0);
  });

  it('grams <-> kg string with 3 dp', () => {
    expect(gramsToKgStr(12000)).toBe('12.000');
    expect(gramsToKgStr(12345)).toBe('12.345');
    expect(kgStrToGrams('12.000')).toBe(12000);
    expect(kgStrToGrams('12.345')).toBe(12345);
  });

  it('parseFtIn handles common formats', () => {
    expect(parseFtIn("9'11\"")).toBe(119);
    expect(parseFtIn("8'")).toBe(96);
    expect(parseFtIn("8'0\"")).toBe(96);
    expect(parseFtIn('0')).toBe(0);
    expect(parseFtIn('')).toBe(0);
    expect(parseFtIn('11"')).toBe(11);
    expect(parseFtIn("9'11.5\"")).toBe(119.5);
  });

  it('parseFtIn throws on garbage', () => {
    expect(() => parseFtIn('abc')).toThrow(RangeError);
  });
});
