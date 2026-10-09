// Bunkar OS — property-style invariants for tauli (weighment, D1).
// Kept in-repo per the round-2 audit (imports the REAL domain module, no mocks).
// Mirrors /tmp/bunkar-audit over 500 random cases with a deterministic seed.
import { describe, it, expect } from 'vitest';
import { computeTauli } from './tauli';
import { areaSqft } from './units';

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

describe('tauli property invariants (500 random cases, seed 999)', () => {
  it('used/allowed/gap/short/extra consistent; short & extra never both > 0', () => {
    const rnd = mulberry32(999);
    for (let i = 0; i < N; i++) {
      const issuedG = randInt(rnd, 0, 40000);
      const returnedG = randInt(rnd, 0, issuedG); // never return more than issued
      const carpetG = randInt(rnd, 0, 30000);
      const wastagePct = randInt(rnd, 0, 10);
      const area = areaSqft(randInt(rnd, 24, 240), randInt(rnd, 24, 240));

      const r = computeTauli({ issuedG, returnedG, carpetG, wastagePct, areaSqft: area });

      expect(r.usedG).toBe(issuedG - returnedG);
      expect(r.allowedG).toBe(Math.round((r.usedG * wastagePct) / 100));
      expect(r.gapG).toBe(r.usedG - carpetG);
      expect(r.shortG).toBe(Math.max(0, r.gapG - r.allowedG));
      expect(r.extraG).toBe(Math.max(0, carpetG - r.usedG));
      expect(r.shortG).toBeGreaterThanOrEqual(0);
      expect(r.extraG).toBeGreaterThanOrEqual(0);
      // Mutually exclusive by construction.
      expect(r.shortG > 0 && r.extraG > 0).toBe(false);
    }
  });

  it('canonical demo tauli locks in (24000/1100/21600 @ 3%)', () => {
    const r = computeTauli({
      issuedG: 24000,
      returnedG: 1100,
      carpetG: 21600,
      wastagePct: 3,
      areaSqft: 79.33,
    });
    expect(r.usedG).toBe(22900);
    expect(r.allowedG).toBe(687);
    expect(r.gapG).toBe(1300);
    expect(r.shortG).toBe(613);
    expect(r.extraG).toBe(0);
  });
});
