import { describe, it, expect } from 'vitest';
import { uuid, slipToken, istDay, daysBetween } from './ids.ts';

describe('ids', () => {
  it('uuid is a v4 uuid', () => {
    const u = uuid();
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuid()).not.toBe(uuid());
  });

  it('slipToken is 22-char base64url, 128-bit', () => {
    const t = slipToken();
    expect(t).toHaveLength(22);
    expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(slipToken()).not.toBe(slipToken());
  });

  it('istDay converts UTC to Asia/Kolkata day', () => {
    // 2026-10-08 20:00 UTC = 2026-10-09 01:30 IST
    expect(istDay('2026-10-08T20:00:00.000Z')).toBe('2026-10-09');
    // 2026-10-08 18:29 UTC = 2026-10-08 23:59 IST
    expect(istDay('2026-10-08T18:29:00.000Z')).toBe('2026-10-08');
    // 2026-10-08 18:30 UTC = 2026-10-09 00:00 IST
    expect(istDay('2026-10-08T18:30:00.000Z')).toBe('2026-10-09');
  });

  it('istDay throws on invalid', () => {
    expect(() => istDay('not-a-date')).toThrow(RangeError);
  });

  it('daysBetween', () => {
    expect(daysBetween('2026-10-01', '2026-10-08')).toBe(7);
    expect(daysBetween('2026-10-08', '2026-10-08')).toBe(0);
    expect(daysBetween('2026-10-08', '2026-10-04')).toBe(-4);
    expect(daysBetween('2026-10-01', '2026-10-05')).toBe(4);
  });
});
