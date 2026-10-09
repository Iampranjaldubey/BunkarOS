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
  // Live-summary section headings + rows (lg+ only).
  'desktop.bazaar.sumMeasure': 'नाप',
  'desktop.bazaar.sumWool': 'ऊन (तौली)',
  'desktop.bazaar.sumWage': 'मज़दूरी',
  'desktop.bazaar.sumPayment': 'भुगतान',
  'desktop.bazaar.area': 'क्षेत्रफल',
  'desktop.bazaar.woolIssued': 'दिया',
  'desktop.bazaar.woolReturned': 'वापस',
  'desktop.bazaar.woolUsed': 'इस्तेमाल',
  'desktop.bazaar.woolAllowed': 'छूट',
  'desktop.bazaar.woolShort': 'कम',
  'desktop.bazaar.gross': 'कुल मज़दूरी',
  'desktop.bazaar.deductions': 'कटौती',
  'desktop.bazaar.peshgi': 'पेशगी वसूली',
  'desktop.bazaar.net': 'शुद्ध',
  'desktop.bazaar.rounding': 'राउंडिंग',
  'desktop.bazaar.paid': 'दिया गया',
  'desktop.bazaar.cash': 'नकद',
  'desktop.bazaar.upi': 'UPI',
  // Receipt page aside (lg+ only).
  'desktop.bazaar.receiptMain': 'रसीद',
  'desktop.bazaar.sideActions': 'पर्ची और कार्रवाई',
} as const;

export default hi;
