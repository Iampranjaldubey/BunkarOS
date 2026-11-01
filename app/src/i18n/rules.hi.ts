// SPEC-M13 / M14 / M02 slip strings (Hindi, default). To be proofread.
const rulesHi: Record<string, string> = {
  'sync.resyncing': 'डेटा नया हो रहा है',
  // wage lines
  'wages.offDays': 'छुट्टी के दिन (पगार वाले)',
  'wages.line.base': 'तनख्वाह', 'wages.line.absent_deduct': 'ग़ैरहाज़िरी की कटौती', 'wages.line.half_deduct': 'आधे दिन की कटौती', 'wages.line.days': 'काम के दिन',
  'wages.line.off_days': 'छुट्टी के दिन', 'wages.line.pieces': 'पीस', 'wages.line.overtime': 'ओवरटाइम', 'wages.line.advance_recovered': 'एडवांस काटा', 'wages.line.rounding': 'राउंडिंग',
  // owner override (SPEC-M14)
  'wages.change': 'बदलें', 'wages.changeLine': '{line} बदलें', 'wages.overrideTitle': 'रकम बदलें · {line}', 'wages.computed': 'हिसाब से', 'wages.newAmount': 'नई रकम (₹)',
  'wages.overrideReason': 'बदलने की वजह', 'wages.overrideSave': 'बदलाव रखें', 'wages.overrideRemove': 'हिसाब वाली रकम वापस लें', 'wages.ownerChanged': 'मालिक ने बदला',
  'wages.overrideErr.not_integer': 'सही रकम लिखें', 'wages.overrideErr.negative': 'रकम माइनस नहीं हो सकती', 'wages.overrideErr.rounding_limit': 'राउंडिंग ₹0.50 से ज़्यादा नहीं हो सकती',
  'wages.overrideErr.over_outstanding': 'बाकी एडवांस से ज़्यादा नहीं काट सकते',
  'wages.overrideHint': 'भुगतान पक्का करने से पहले मालिक कोई भी रकम बदल सकता है — वजह इतिहास में दर्ज होगी',
  // correcting a paid month (SPEC-M14)
  'wages.correctionReason': 'दोबारा भुगतान की वजह', 'wages.correctionHint': 'इस महीने का पिछला भुगतान वापस लिया गया था — वजह लिखें',
  'wages.changePaid': 'भुगतान बदलना है?', 'wages.step1': '1. पगार शीट पर महीना खोलें (वजह के साथ)', 'wages.step2': '2. यह भुगतान वापस लें (वजह के साथ)',
  'wages.step3': '3. फिर से भुगतान करें — रकम बदल सकते हैं', 'wages.step4': '4. महीना फिर से लॉक करें (वजह के साथ)',
  'wages.unlockFirst': 'महीना लॉक है — पहले पगार शीट पर महीना खोलें', 'wages.reversePay': 'भुगतान वापस लें', 'wages.reverseReason': 'वापस लेने की वजह',
  'wages.unlockReason': 'महीना खोलने की वजह', 'wages.lockReason': 'लॉक करने की वजह', 'wages.lockAgainHint': 'यह महीना पहले लॉक था — दोबारा लॉक करने की वजह लिखें',
  // slip (D-003)
  'slip.sec.workerName': 'कारीगर', 'slip.sec.attendance': 'हाज़िरी', 'slip.sec.offDays': 'छुट्टी के दिन (पगार वाले)', 'slip.sec.pieces': 'पीस', 'slip.sec.rate': 'रेट',
  'slip.sec.gross': 'कुल कमाई', 'slip.sec.overtime': 'ओवरटाइम', 'slip.sec.deductions': 'कटौती', 'slip.sec.advance': 'एडवांस काटा', 'slip.sec.net': 'दिया',
  'slip.sec.ownerChanges': 'मालिक का बदलाव', 'slip.sec.advanceBalance': 'बाकी एडवांस', 'slip.sec.payment': 'भुगतान',
  'slip.per.monthly': 'महीना', 'slip.per.daily': 'रोज़', 'slip.per.piece': 'पीस',
  'slip.signWorker': 'कारीगर के दस्तख़त', 'slip.signOwner': 'मालिक के दस्तख़त', 'slip.link': 'अपना पूरा हिसाब यहाँ देखें: {url}', 'slip.print': 'पर्ची प्रिंट करें (A4)',
  'slip.opt.businessName': 'दुकान का नाम', 'slip.opt.workerName': 'कारीगर का नाम', 'slip.opt.month': 'महीना', 'slip.opt.gross': 'कुल कमाई', 'slip.opt.advance': 'एडवांस काटा',
  'slip.opt.deductions': 'कटौती', 'slip.opt.net': 'कुल भुगतान', 'slip.opt.signature': 'दस्तख़त की जगह', 'slip.opt.attendance': 'हाज़िरी का जोड़', 'slip.opt.offDays': 'छुट्टी के दिन (पगार वाले)',
  'slip.opt.pieces': 'पीस', 'slip.opt.overtime': 'ओवरटाइम', 'slip.opt.rate': 'रेट', 'slip.opt.ownerChanges': 'मालिक के बदलाव', 'slip.opt.advanceBalance': 'बाकी एडवांस', 'slip.opt.payment': 'भुगतान की तारीख और तरीका',
  // settings: wage rules (SPEC-M13)
  'settings.rules': 'पगार के नियम', 'settings.overtime': 'ओवरटाइम', 'settings.overtimeHint': 'चालू करने पर हाज़िरी में ओवरटाइम घंटे भरे जाते हैं और पगार में जुड़ते हैं',
  'settings.on': 'चालू', 'settings.off': 'बंद', 'settings.offDayPolicy': 'छुट्टी के दिन की पगार (रोज़ वाले कारीगर)',
  'settings.policy.none': 'कोई नहीं', 'settings.policy.none.ex': 'सिर्फ़ काम के दिन की पगार',
  'settings.policy.sundays': 'रविवार', 'settings.policy.sundays.ex': 'हर रविवार की पगार, अगर उस दिन ग़ैरहाज़िर न लगी हो',
  'settings.policy.sundays_and_holidays': 'रविवार और छुट्टियाँ', 'settings.policy.sundays_and_holidays.ex': 'रविवार और सूची की छुट्टियों की पगार, अगर ग़ैरहाज़िर न लगी हो',
  'settings.slipSections': 'पर्ची में क्या छपे', 'settings.slipFixed': 'हमेशा', 'settings.slipPreview': 'पर्ची का नमूना', 'settings.saveRules': 'नियम सेव करें',
  'settings.overtimeOnlyWhenOn': 'ओवरटाइम चालू होने पर ही',
  // settings: operator toggles (D-005)
  'settings.operators': 'ऑपरेटर क्या कर सकते हैं', 'settings.permsHint': 'सभी ऑपरेटर (मुंशी) पर एक साथ लागू। सेटिंग, लॉगिन, रेट, महीना लॉक और रकम बदलना सिर्फ़ मालिक का।',
  'settings.perm.addEntries': 'एंट्री भरना', 'settings.perm.addEntries.hint': 'हाज़िरी, एडवांस, पगार, स्टॉक और ऑर्डर भर सकते हैं',
  'settings.perm.editPast': 'पुरानी एंट्री बदलना', 'settings.perm.editPast.hint': 'पिछले दिनों की किसी की भी एंट्री वजह के साथ वापस ले सकते हैं',
  'settings.perm.seePrices': 'भाव देखना', 'settings.perm.seePrices.hint': 'बंद करने पर ऑर्डर के भाव ऑपरेटर के फ़ोन पर भेजे ही नहीं जाते',
  'settings.perm.export': 'Excel फ़ाइल बनाना', 'settings.perm.export.hint': 'महीने का हिसाब Excel में निकाल सकते हैं',
  'settings.savePerms': 'ऑपरेटर की छूट सेव करें',
  // entry log
  'log.override': 'बदला: {line} {from} → {to} ({reason})', 'log.correction': 'दोबारा भुगतान: {reason}', 'log.lockReason': 'वजह: {reason}',
  'log.unlocked': 'महीना खोला: {month}', 'log.payReversed': 'भुगतान वापस: {name} · {month}', 'log.reasonShort': 'वजह: {reason}',
  // attendance / worker page
  'att.keyHintNoOt': 'कीबोर्ड: P हाज़िर · H आधा दिन · A ग़ैरहाज़िर (फिर अगला कारीगर) · ↑ ↓ ऊपर-नीचे',
  'att.paidOff': 'पगार वाली छुट्टी',
  'wp.ownerChanged': 'मालिक ने बदला',
};
export default rulesHi;
