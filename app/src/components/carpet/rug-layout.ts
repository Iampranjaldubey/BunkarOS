// SPEC-M17: which drawn-rug layout fits a design name.
export type RugLayout = 'medallion' | 'gul' | 'gabbeh';
export function rugLayout(design: string, seed: number): RugLayout {
  const d = design.toLowerCase();
  if (/gabb?eh|lori|loom ?knot|modern|plain/.test(d)) return 'gabbeh';
  if (/bokh?ara|bukh?ara|turk|afghan|gul|mori/.test(d)) return 'gul';
  if (/kashan|kashmir|tabriz|isfahan|medallion|persian|nain|qum|kerman/.test(d)) return 'medallion';
  return seed % 3 === 0 ? 'gul' : 'medallion';
}
