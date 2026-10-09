// WCAG 2.x contrast-ratio checker for Bunkar OS colour tokens.
// Usage: node scripts/contrast.mjs
// Verifies the saffron-ink text token and status-tile text pairs meet AA (4.5:1).

function srgbToLin(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}
function ratio(fg, bg) {
  const L1 = luminance(fg);
  const L2 = luminance(bg);
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

// Tokens from src/index.css
const T = {
  saffron: '#c98a1c',       // old text/fill — fails
  saffronInk: '#8a5a0a',    // new accessible text/fill token
  white: '#ffffff',
  surface: '#ffffff',
  bg: '#f4f5f8',            // page bg
  ok: '#2f7d4a',            // on_track green
  madder: '#a8322a',        // idle red
  indigo: '#26406b',
  ink: '#1a2030',
  muted: '#5a6275',
  mutedDark: '#464d60',    // free-tile text (darker muted, 6.0:1 on line)
  line: '#d5dae4',          // free tile bg
};

const AA = 4.5;      // normal text
const AA_LARGE = 3;  // large/bold text & UI components (1.4.11)

const pairs = [
  ['saffron-ink TEXT on white/surface', T.saffronInk, T.surface, AA],
  ['saffron-ink TEXT on page bg', T.saffronInk, T.bg, AA],
  ['OLD saffron text on white (regression check)', T.saffron, T.surface, AA],
  ['slow tile: white on saffron-ink fill', T.white, T.saffronInk, AA],
  ['on_track tile: white on ok-green', T.white, T.ok, AA],
  ['idle tile: white on madder-red', T.white, T.madder, AA],
  ['free tile: muted-dark on line', T.mutedDark, T.line, AA],
  ['focus ring: saffron-ink vs white (non-text 3:1)', T.saffronInk, T.surface, AA_LARGE],
  ['indigo text on white', T.indigo, T.surface, AA],
];

let allPass = true;
for (const [name, fg, bg, min] of pairs) {
  const r = ratio(fg, bg);
  const pass = r >= min;
  // The OLD saffron pair is EXPECTED to fail — document the regression, don't gate on it.
  const expectedFail = name.startsWith('OLD');
  if (!pass && !expectedFail) allPass = false;
  const mark = pass ? 'PASS' : expectedFail ? 'FAIL (expected — pre-fix baseline)' : 'FAIL';
  console.log(`${r.toFixed(2)}:1  (need ${min}:1)  ${mark}  — ${name}`);
}
console.log(allPass ? '\nAll required pairs meet WCAG AA.' : '\nSome required pairs FAIL.');
process.exit(allPass ? 0 : 1);
