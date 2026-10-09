import { describe, it, expect } from 'vitest';
import { formatDay, formatTime } from './dates.ts';

describe('dates (M1 human-friendly)', () => {
  it('formats a day in Hindi and English (IST)', () => {
    expect(formatDay('2026-10-09', 'hi')).toBe('शुक्रवार, 9 अक्टूबर 2026');
    expect(formatDay('2026-10-09', 'en')).toBe('Friday, 9 October 2026');
    expect(formatDay('2026-10-09', 'en', 'medium')).toBe('9 October 2026');
  });
  it('formats the time of an instant in IST', () => {
    // 13:10 UTC = 18:40 IST
    expect(formatTime('2026-04-04T13:10:00Z', 'en').toLowerCase()).toContain('6:40');
  });
  it('rejects invalid input', () => {
    expect(() => formatDay('nope', 'hi')).toThrow(RangeError);
    expect(() => formatTime('nope', 'hi')).toThrow(RangeError);
  });
});
