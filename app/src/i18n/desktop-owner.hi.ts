// Bunkar OS — desktop/tablet owner-page strings (SPEC-019), Hindi.
// Merged into the base dictionary by src/i18n/index.ts via the `./*.hi.ts` glob.
// Only used at lg+; the phone layout never reads these.
const hi = {
  // Owner home aside rail
  'desktop.home.summary': 'आज का सार',
  'desktop.home.boardTitle': 'करघा बोर्ड',
  // Munshi home table columns
  'desktop.col.time': 'समय',
  'desktop.col.entry': 'काम',
  // Digest two-column headings
  'desktop.digest.today': 'आज',
  'desktop.digest.month': 'इस महीने',
  // Exporter table columns
  'desktop.col.piece': 'पीस',
  'desktop.col.status': 'स्थिति',
  'desktop.col.loom': 'करघा',
  'desktop.col.woven': 'बुना',
  'desktop.col.lastCheckin': 'आख़िरी चेक-इन',
  'desktop.exporter.pieceTable': 'पीस की स्थिति',
  'desktop.exporter.noCheckin': '—',
} as const;

export default hi;
