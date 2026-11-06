// D14 / SPEC-M12: text colours meet WCAG AA (4.5:1) on their backgrounds in both themes.
import { describe, it, expect } from 'vitest';

// Vitest replaces CSS imports with empty modules, so read the file itself (Node; the app tsconfig has no Node types).
const fs = (await import('node:fs' as string)) as { readFileSync: (path: URL, enc: string) => string };
const css = fs.readFileSync(new URL('./index.css', import.meta.url), 'utf8');

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2].toLowerCase();
  return out;
}
const light = tokens(css.slice(css.indexOf('@theme'), css.indexOf('}', css.indexOf('@theme'))));
const darkStart = css.indexOf(":root[data-theme='dark']");
const dark = { ...light, ...tokens(css.slice(darkStart, css.indexOf('}', darkStart))) };

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// [text, background]
const PAIRS: [string, string][] = [
  ['ink', 'bg'], ['ink', 'surface'], ['ink', 'surface-2'], ['muted', 'surface'], ['muted', 'bg'], ['muted', 'surface-2'],
  ['ink-2', 'bg'], ['ink-2', 'surface'], ['ink-2', 'surface-2'],
  ['on-fill', 'primary'], ['on-fill', 'primary-dark'], ['on-fill', 'ok'], ['on-fill', 'given'], ['on-fill', 'received'],
  ['on-accent', 'accent'],
  ['primary', 'surface'], ['primary', 'bg'], ['primary', 'primary-soft'], ['given', 'surface'], ['received', 'surface'],
  ['accent-ink', 'surface'], ['accent-ink', 'accent-soft'], ['warn', 'warn-soft'], ['given', 'given-soft'], ['received', 'received-soft'],
  ['ink', 'primary-soft'], ['ink', 'accent-soft'],
];

describe('theme contrast (WCAG AA 4.5:1)', () => {
  for (const [name, t] of [['light', light], ['dark', dark]] as const) {
    it(`${name}: every text/background pair passes`, () => {
      const fails = PAIRS.map(([fg, bg]) => ({ pair: `${fg} on ${bg}`, ratio: Number(ratio(t[fg], t[bg]).toFixed(2)) })).filter((p) => p.ratio < 4.5);
      expect(fails).toEqual([]);
    });
  }
  it('the dark block defines on-fill (dark ink on light fills)', () => {
    expect(dark['on-fill']).toBe('#161411');
    expect(light['on-fill']).toBe('#ffffff');
  });
  it('every token is defined in both themes', () => {
    for (const [fg, bg] of PAIRS) { expect(light[fg], fg).toBeTruthy(); expect(light[bg], bg).toBeTruthy(); }
  });
});
