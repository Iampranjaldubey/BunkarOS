// Bunkar OS — desktop/tablet owner-page strings (SPEC-019), English.
// Merged into the English dictionary by src/i18n/index.ts via the `./*.en.ts` glob.
// Only used at lg+; the phone layout never reads these.
const en = {
  // Owner home aside rail
  'desktop.home.summary': "Today's summary",
  'desktop.home.boardTitle': 'Loom board',
  // Munshi home table columns
  'desktop.col.time': 'Time',
  'desktop.col.entry': 'Entry',
  // Digest two-column headings
  'desktop.digest.today': 'Today',
  'desktop.digest.month': 'This month',
  // Exporter table columns
  'desktop.col.piece': 'Piece',
  'desktop.col.status': 'Status',
  'desktop.col.loom': 'Loom',
  'desktop.col.woven': 'Woven',
  'desktop.col.lastCheckin': 'Last check-in',
  'desktop.exporter.pieceTable': 'Piece status',
  'desktop.exporter.noCheckin': '—',
} as const;

export default en;
