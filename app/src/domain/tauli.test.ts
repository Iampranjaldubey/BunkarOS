import { describe, it, expect } from 'vitest';
import { computeTauli } from './tauli.ts';

describe('tauli (D1)', () => {
  it('PRD demo: 24.000 issued, 1.100 returned, 21.600 carpet -> short 0.613 kg', () => {
    const r = computeTauli({ issuedG: 24000, returnedG: 1100, carpetG: 21600, wastagePct: 3, areaSqft: 79.33 });
    expect(r.usedG).toBe(22900);
    expect(r.allowedG).toBe(687);
    expect(r.gapG).toBe(1300);
    expect(r.shortG).toBe(613);
    expect(r.extraG).toBe(0);
  });

  it('short case: used > carpet beyond allowed wastage', () => {
    // issued 10000, returned 1000 -> used 9000; carpet 8500; pct 3 -> allowed 270
    // gap = 9000-8500 = 500; short = max(0, 500-270) = 230
    const r = computeTauli({ issuedG: 10000, returnedG: 1000, carpetG: 8500, wastagePct: 3, areaSqft: 59.5 });
    expect(r.usedG).toBe(9000);
    expect(r.allowedG).toBe(270);
    expect(r.gapG).toBe(500);
    expect(r.shortG).toBe(230);
    expect(r.extraG).toBe(0);
  });

  it('within allowance: no short', () => {
    // used 9000, carpet 8800 -> gap 200 <= allowed 270 -> short 0
    const r = computeTauli({ issuedG: 10000, returnedG: 1000, carpetG: 8800, wastagePct: 3, areaSqft: 59.5 });
    expect(r.gapG).toBe(200);
    expect(r.shortG).toBe(0);
    expect(r.extraG).toBe(0);
  });

  it('extra weight: carpet heavier than used', () => {
    // used 9000, carpet 9200 -> extra 200, gap -200 -> short 0
    const r = computeTauli({ issuedG: 10000, returnedG: 1000, carpetG: 9200, wastagePct: 3, areaSqft: 59.5 });
    expect(r.extraG).toBe(200);
    expect(r.shortG).toBe(0);
    expect(r.gapG).toBe(-200);
  });

  it('expectedG when norm known = round(area*norm)', () => {
    const r = computeTauli({ issuedG: 10000, returnedG: 1000, carpetG: 8500, wastagePct: 3, areaSqft: 59.5, normGPerSqft: 150 });
    expect(r.expectedG).toBe(Math.round(59.5 * 150)); // 8925
    expect(r.normGPerSqft).toBe(150);
  });

  it('allowed rounding uses round()', () => {
    // used 100, pct 3 -> 3.0 -> 3 ; used 150 pct 3 -> 4.5 -> round 5
    expect(computeTauli({ issuedG: 100, returnedG: 0, carpetG: 100, wastagePct: 3, areaSqft: 1 }).allowedG).toBe(3);
    expect(computeTauli({ issuedG: 150, returnedG: 0, carpetG: 150, wastagePct: 3, areaSqft: 1 }).allowedG).toBe(5);
  });

  it('rejects negative weights', () => {
    expect(() => computeTauli({ issuedG: -1, returnedG: 0, carpetG: 0, wastagePct: 3, areaSqft: 1 })).toThrow(RangeError);
  });
});
