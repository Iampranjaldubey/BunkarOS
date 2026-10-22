const d = {
  'worker.title': 'कारीगर', 'worker.new': 'नया कारीगर', 'worker.edit': 'कारीगर बदलें', 'worker.name': 'नाम', 'worker.phone': 'फ़ोन',
  'worker.jobTitle': 'काम', 'worker.job.weaver': 'बुनकर', 'worker.job.finisher': 'फिनिशिंग', 'worker.job.helper': 'हेल्पर', 'worker.job.other': 'अन्य',
  'worker.payType': 'पगार का तरीका', 'worker.payType.monthly': 'महीने की तनख्वाह', 'worker.payType.daily': 'रोज़ की दिहाड़ी', 'worker.payType.piece': 'पीस रेट',
  'worker.salary': 'महीने की तनख्वाह (₹)', 'worker.dailyRate': 'एक दिन की दिहाड़ी (₹)', 'worker.pieceRate': 'एक पीस का रेट (₹)',
  'worker.otRate': 'ओवरटाइम रेट (₹ प्रति घंटा)', 'worker.otHint': 'खाली छोड़ें तो तनख्वाह ÷ काम के दिन ÷ 8', 'worker.joinedOn': 'कब से काम पर',
  'worker.active': 'चालू', 'worker.deactivate': 'काम छोड़ दिया', 'worker.reactivate': 'फिर चालू करें', 'worker.photo': 'फ़ोटो (पहचान के लिए)',
  'worker.empty': 'अभी कोई कारीगर नहीं', 'worker.emptyHint': 'पहला कारीगर जोड़ें — नाम और पगार का तरीका काफ़ी है।', 'worker.search': 'नाम से खोजें',
  'worker.showInactive': 'बंद वाले भी दिखाएँ', 'worker.count': '{n} कारीगर', 'worker.thisMonth': 'इस महीने', 'worker.advances': 'एडवांस',
  'worker.balance': 'बाकी एडवांस', 'worker.lastPayment': 'पिछला भुगतान', 'worker.noPayment': 'अभी तक नहीं', 'worker.rateLocked': 'पगार के आँकड़े सिर्फ़ मालिक बदल सकता है',
  'worker.perDay': 'एक दिन = {amount}',
  'att.title': 'हाज़िरी', 'att.present': 'हाज़िर', 'att.half': 'आधा दिन', 'att.absent': 'ग़ैरहाज़िर', 'att.unmarked': 'बाकी', 'att.ot': 'ओवरटाइम',
  'att.otHours': 'OT घंटे', 'att.allPresent': 'सब हाज़िर', 'att.marked': '{marked}/{total} लगी', 'att.saved': 'हाज़िरी लग गई', 'att.summary': 'आज का हाल',
  'att.empty': 'पहले कारीगर जोड़ें', 'att.month': 'महीने की हाज़िरी', 'att.sunday': 'रविवार', 'att.holiday': 'छुट्टी', 'att.legend': 'P हाज़िर · H आधा · A ग़ैरहाज़िर',
  'att.locked': 'यह महीना लॉक है', 'att.pieces': 'पीस', 'att.addPieces': 'पीस जोड़ें', 'att.pieceCount': 'कितने पीस', 'att.pieceRate': 'रेट (₹ प्रति पीस)',
} as const;
export default d;
