// Bunkar OS — desktop/tablet form strings (SPEC-019), Hindi.
// Merged into the base dictionary by src/i18n/index.ts via the `./*.hi.ts` glob.
// Only NEW desktop-only strings live here (the live-summary rail + a couple of
// desktop section titles); every existing phone string keeps its own key.
const hi = {
  // Bazaar wizard live-summary rail (lg+ only).
  'desktop.bazaar.summary': 'हिसाब',
  'desktop.bazaar.summaryHint': 'जैसे-जैसे आप भरते जाएँगे, यहाँ पूरा हिसाब बनता जाएगा।',
  'desktop.bazaar.carpet': 'कालीन',
  'desktop.bazaar.weaver': 'बुनकर',
  'desktop.bazaar.size': 'नाप',
  'desktop.bazaar.awaiting': 'अभी भरना बाकी',
  // Receipt page aside (lg+ only).
  'desktop.bazaar.receiptMain': 'रसीद',
  'desktop.bazaar.sideActions': 'पर्ची और कार्रवाई',
} as const;

export default hi;
