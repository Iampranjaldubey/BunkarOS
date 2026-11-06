// SPEC-M17 knot states and their CSS classes (index.css), shared by the knot strip, the naksha grid and the month sheet.
export type KnotState = 'present' | 'half' | 'absent' | 'off' | 'paid' | 'unmarked' | 'future';
const KNOT_CLS: Record<KnotState, string> = {
  present: 'knot-p', half: 'knot-h', absent: 'knot-a', off: 'knot-off', paid: 'knot-paid', unmarked: 'knot-unmarked', future: 'knot-future',
};
export const knotClass = (s: KnotState) => KNOT_CLS[s];
