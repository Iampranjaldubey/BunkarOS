// Bunkar OS — desktop/tablet page strings for login, setup, slip & rates
// (SPEC-019), Hindi. Merged into the base dictionary by src/i18n/index.ts via
// the `./*.hi.ts` glob. Only lg+ layouts read these; the phone layout is
// unchanged.
const hi = {
  // Rates — history column caption reused inside the desktop table rows.
  'rate.table.current': 'मौजूदा रेट',
  'rate.table.history': 'पुराने रेट',
} as const;

export default hi;
