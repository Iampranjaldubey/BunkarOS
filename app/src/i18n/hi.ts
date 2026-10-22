// Base Hindi (Devanagari). Simple munshi vocabulary; English domain words kept where common.
const hi = {
  'app.name': 'बुनकर',
  'app.tagline': 'हाज़िरी · पगार · स्टॉक · ऑर्डर — ऑफलाइन भी',

  'nav.home': 'होम', 'nav.attendance': 'हाज़िरी', 'nav.wages': 'पगार', 'nav.stock': 'स्टॉक',
  'nav.orders': 'ऑर्डर', 'nav.workers': 'कारीगर', 'nav.month': 'महीने का हिसाब', 'nav.log': 'एंट्री लॉग',
  'nav.settings': 'सेटिंग', 'nav.more': 'और', 'nav.buyers': 'खरीदार', 'nav.label': 'मुख्य मेनू',

  'lang.toggle': 'भाषा चुनें',

  'action.save': 'सेव करें', 'action.saveAdd': 'सेव करें और अगला', 'action.cancel': 'रद्द करें',
  'action.confirm': 'पक्का करें', 'action.back': 'वापस', 'action.search': 'खोजें', 'action.add': 'जोड़ें',
  'action.share': 'भेजें', 'action.sync': 'सिंक', 'action.retry': 'फिर कोशिश करें', 'action.delete': 'हटाएँ',
  'action.edit': 'बदलें', 'action.reverse': 'वापस लें', 'action.logout': 'लॉग आउट', 'action.next': 'आगे',
  'action.done': 'हो गया', 'action.print': 'प्रिंट', 'action.export': 'Excel में निकालें', 'action.view': 'देखें',
  'action.close': 'बंद करें',

  'role.owner': 'मालिक', 'role.staff': 'स्टाफ़ / मुंशी', 'role.system': 'सिस्टम',

  'sync.synced': 'सिंक हो गया', 'sync.offline': 'ऑफलाइन', 'sync.pending': '{n} बाकी', 'sync.error': 'सिंक रुका', 'sync.login': 'लॉगिन करें',

  'valid.required': 'यह ज़रूरी है', 'valid.number': 'सही संख्या भरें', 'valid.positive': 'शून्य से बड़ा होना चाहिए',
  'valid.phone': 'सही फ़ोन नंबर भरें', 'valid.pin': '4 अंक का पिन भरें', 'valid.pinMismatch': 'पिन मेल नहीं खाता',
  'valid.photoRequired': 'इतनी रकम के लिए फ़ोटो ज़रूरी है', 'valid.date': 'सही तारीख चुनें', 'valid.locked': 'यह महीना लॉक है — मालिक से खुलवाएँ',

  'common.loading': 'लोड हो रहा है…', 'common.empty': 'अभी कुछ नहीं है', 'common.yes': 'हाँ', 'common.no': 'नहीं',
  'common.optional': 'वैकल्पिक', 'common.date': 'तारीख', 'common.today': 'आज', 'common.note': 'नोट',
  'common.photo': 'फ़ोटो', 'common.total': 'कुल', 'common.all': 'सभी', 'common.active': 'चालू', 'common.inactive': 'बंद',
  'common.cash': 'नकद', 'common.upi': 'UPI', 'common.by': '{name} ने', 'common.at': '{time} बजे', 'common.edited': 'बदला गया',
  'common.reversed': 'वापस लिया', 'common.rejected': 'सर्वर ने नहीं माना', 'common.month': 'महीना', 'common.rupees': '₹',

  'route.setup': 'यूनिट बनाएँ', 'route.login': 'लॉग इन', 'route.home': 'होम', 'route.settings': 'सेटिंग', 'route.log': 'एंट्री लॉग',

  'setup.title': 'नई यूनिट बनाएँ', 'setup.join': 'मौजूदा यूनिट से जुड़ें', 'setup.create': 'नई यूनिट',
  'setup.unitName': 'यूनिट / दुकान का नाम', 'setup.ownerName': 'मालिक का नाम', 'setup.ownerPhone': 'मालिक का फ़ोन',
  'setup.pin': '4 अंक का पिन बनाएँ', 'setup.pinConfirm': 'पिन दोबारा भरें', 'setup.unitCode': 'यूनिट कोड',
  'setup.unitKey': 'यूनिट चाबी', 'setup.createBtn': 'यूनिट बनाएँ', 'setup.joinBtn': 'जुड़ें',
  'setup.hint': 'पहली बार? नई यूनिट बनाएँ। दूसरा फ़ोन? यूनिट कोड और चाबी से जुड़ें।',

  'login.title': 'अपना नाम चुनें', 'login.enterPin': 'पिन भरें', 'login.wrongPin': 'ग़लत पिन',
  'login.lockedOut': '{s} सेकंड बाद कोशिश करें', 'login.clear': 'मिटाएँ', 'login.noUsers': 'अभी कोई यूज़र नहीं — इंटरनेट चालू करके फिर खोलें',

  'share.title': 'WhatsApp पर भेजें', 'share.to': 'किसको', 'share.preview': 'पूरा संदेश', 'share.send': 'WhatsApp पर भेजें',
  'photo.capture': 'फ़ोटो लें', 'photo.retake': 'दोबारा लें', 'photo.required': 'फ़ोटो ज़रूरी',
  'person.search': 'नाम से खोजें',
  'pwa.install.title': 'होम स्क्रीन पर जोड़ें', 'pwa.install.hint': 'बिना इंटरनेट भी खुलेगा, ऐप जैसा चलेगा।',
  'pwa.install.add': 'जोड़ें', 'pwa.install.dismiss': 'अभी नहीं',

  // record type labels (entry log)
  'rec.user': 'यूज़र', 'rec.setting': 'सेटिंग', 'rec.worker': 'कारीगर', 'rec.item': 'स्टॉक आइटम', 'rec.buyer': 'खरीदार',
  'rec.order': 'ऑर्डर', 'rec.attendance': 'हाज़िरी', 'rec.piece_entry': 'पीस एंट्री', 'rec.advance': 'एडवांस',
  'rec.wage_payment': 'पगार भुगतान', 'rec.period_lock': 'महीना लॉक', 'rec.stock_in': 'स्टॉक आया', 'rec.stock_out': 'स्टॉक गया',
  'rec.stock_adjust': 'स्टॉक सुधार', 'rec.finished_in': 'तैयार कालीन', 'rec.order_status': 'ऑर्डर स्थिति', 'rec.delivery': 'डिलीवरी',
  'rec.order_note': 'ऑर्डर नोट', 'rec.usage': 'स्क्रीन खोली', 'rec.reversal': 'वापस लिया',

  // settings
  'settings.unit': 'यूनिट सेटिंग', 'settings.workingDays': 'महीने में काम के दिन', 'settings.workingDaysHint': 'पगार काटने के लिए: तनख्वाह ÷ इतने दिन',
  'settings.photoAbove': 'इससे ऊपर की रकम पर फ़ोटो ज़रूरी (₹)', 'settings.language': 'भाषा', 'settings.users': 'लॉगिन',
  'settings.addUser': 'स्टाफ़ जोड़ें', 'settings.userName': 'नाम', 'settings.userPhone': 'फ़ोन', 'settings.userRole': 'भूमिका',
  'settings.userPin': '4 अंक का पिन', 'settings.deactivate': 'बंद करें', 'settings.joinInfo': 'दूसरे फ़ोन से जुड़ने के लिए',
  'settings.joinHint': 'यूनिट कोड और चाबी किसी बाहरी को न दें।', 'settings.copy': 'कॉपी', 'settings.copied': 'कॉपी हो गया',
  'settings.saved': 'सेटिंग सेव हो गई', 'settings.holidays': 'छुट्टियाँ', 'settings.theme': 'रंग', 'settings.theme.auto': 'फ़ोन जैसा',
  'settings.theme.light': 'हल्का', 'settings.theme.dark': 'गहरा',

  // log
  'log.title': 'एंट्री लॉग', 'log.filterUser': 'किसकी एंट्री', 'log.empty': 'अभी कोई एंट्री नहीं', 'log.old': 'पुराना',
  'log.new': 'नया', 'log.reason': 'वजह', 'log.day': 'तारीख', 'log.reverse': 'एंट्री वापस लें', 'log.reverseWhy': 'वापस लेने की वजह',
  'log.cannotReverse': 'सिर्फ़ आज की अपनी एंट्री वापस ले सकते हैं',
} as const;

export default hi;
export type BaseKey = keyof typeof hi;
