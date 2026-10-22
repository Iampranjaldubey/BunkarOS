const d = {
  'wages.title': 'पगार', 'wages.sheet': 'पगार शीट', 'wages.gross': 'कुल कमाई', 'wages.ot': 'ओवरटाइम', 'wages.deductions': 'कटौती',
  'wages.advances': 'एडवांस काटा', 'wages.net': 'देने हैं', 'wages.paid': 'दे दिया', 'wages.pending': 'बाकी', 'wages.pay': 'पगार दें',
  'wages.paidOn': '{date} को दिया', 'wages.lock': 'महीना लॉक करें', 'wages.unlock': 'महीना खोलें', 'wages.locked': 'महीना लॉक है',
  'wages.lockHint': 'लॉक के बाद इस महीने की हाज़िरी, एडवांस या भुगतान नहीं बदलेंगे।', 'wages.perDay': 'एक दिन', 'wages.absentDeduct': 'ग़ैरहाज़िरी ({n} दिन)',
  'wages.halfDeduct': 'आधे दिन ({n})', 'wages.base': 'तनख्वाह', 'wages.daysWorked': 'काम के दिन', 'wages.pieces': 'पीस', 'wages.addDeduction': 'कटौती जोड़ें',
  'wages.deductionLabel': 'किस बात की', 'wages.deductionAmount': 'रकम (₹)', 'wages.recover': 'एडवांस में से काटें (₹)', 'wages.outstanding': 'बाकी एडवांस',
  'wages.afterRecover': 'भुगतान के बाद बाकी', 'wages.rounding': 'राउंडिंग', 'wages.mode': 'कैसे दिया', 'wages.confirm': 'भुगतान पक्का करें',
  'wages.alreadyPaid': 'इस महीने का भुगतान हो चुका है', 'wages.slip': 'पर्ची', 'wages.shareSlip': 'पर्ची WhatsApp पर भेजें', 'wages.printSlip': 'पर्ची प्रिंट करें',
  'wages.noWorkers': 'इस महीने कोई कारीगर नहीं', 'wages.summary': '{paid}/{total} को दिया', 'wages.photoHint': 'बड़ी रकम — रसीद या रजिस्टर की फ़ोटो लें',
  'wages.totalPaid': 'कुल दिया', 'wages.totalPending': 'कुल बाकी', 'wages.unmarkedWarn': '{n} दिन की हाज़िरी नहीं लगी',
  'adv.title': 'एडवांस दें', 'adv.worker': 'किसको', 'adv.amount': 'रकम (₹)', 'adv.mode': 'कैसे दिया', 'adv.saved': 'एडवांस दर्ज हो गया', 'adv.balanceAfter': 'इसके बाद बाकी',
  'adv.list': 'एडवांस', 'adv.new': 'नया एडवांस',
  'slip.title': 'पगार पर्ची', 'slip.month': 'महीना', 'slip.text': '*{unit}*\nपगार पर्ची — {month}\nनाम: {name}\n{lines}\n*दिया: {paid}* ({mode})\nबाकी एडवांस: {balance}',
} as const;
export default d;
