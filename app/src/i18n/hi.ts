// Bunkar OS — base Hindi dictionary (Devanagari).
// Feature agents ADD keys in src/i18n/<feature>.hi.ts; index.ts merges them.
// Keep words simple — the vocabulary a munshi actually uses.
const hi = {
  // App
  'app.name': 'बुनकर OS',
  'app.tagline': 'भदोही कारपेट यूनिट — ऑफलाइन',

  // Nav
  'nav.home': 'होम',
  'nav.orders': 'ऑर्डर',
  'nav.looms': 'करघा',
  'nav.weavers': 'बुनकर',
  'nav.loomsWeavers': 'करघा/बुनकर',
  'nav.thekedars': 'ठेकेदार',
  'nav.yarn': 'ऊन',
  'nav.rates': 'रेट कार्ड',
  'nav.bazaar': 'बाज़ार',
  'nav.peshgi': 'पेशगी',
  'nav.checkin': 'चेक-इन',
  'nav.roker': 'रोकड़',
  'nav.digest': 'दैनिक सार',
  'nav.audit': 'ऑडिट',
  'nav.settings': 'सेटिंग',
  'nav.more': 'और',

  // Language
  'lang.toggle': 'भाषा चुनें',

  // Common actions
  'action.save': 'सेव करें',
  'action.cancel': 'रद्द करें',
  'action.confirm': 'पक्का करें',
  'action.back': 'वापस',
  'action.search': 'खोजें',
  'action.add': 'जोड़ें',
  'action.share': 'भेजें',
  'action.sync': 'सिंक',
  'action.retry': 'फिर कोशिश करें',
  'action.delete': 'हटाएँ',
  'action.edit': 'बदलें',
  'action.reverse': 'वापस लें',
  'action.logout': 'लॉग आउट',
  'action.next': 'आगे',
  'action.done': 'हो गया',

  // Roles
  'role.owner': 'मालिक',
  'role.munshi': 'मुंशी',
  'role.thekedar': 'ठेकेदार',

  // Piece statuses (D5)
  'status.not_started': 'शुरू नहीं',
  'status.on_loom': 'करघे पर',
  'status.off_loom': 'उतरा',
  'status.delivered': 'डिलीवर',
  'status.on_hold': 'रोका गया',

  // Loom board statuses (D9 / K2)
  'board.on_track': 'ठीक चल रहा',
  'board.slow': 'धीमा',
  'board.idle': 'रुका',
  'board.free': 'खाली',

  // Record types — human labels for the audit log (not raw keys)
  'rec.type.user': 'यूज़र',
  'rec.type.loom': 'करघा',
  'rec.type.thekedar': 'ठेकेदार',
  'rec.type.weaver': 'बुनकर',
  'rec.type.order': 'ऑर्डर',
  'rec.type.piece_assign': 'करघे पर लगाया',
  'rec.type.piece_status': 'स्थिति बदली',
  'rec.type.rate': 'रेट',
  'rec.type.norm': 'नॉर्म',
  'rec.type.setting': 'सेटिंग',
  'rec.type.yarn_issue': 'ऊन दिया',
  'rec.type.yarn_return': 'ऊन वापस',
  'rec.type.bazaar': 'बाज़ार',
  'rec.type.peshgi': 'पेशगी',
  'rec.type.checkin': 'चेक-इन',
  'rec.type.roker': 'रोकड़',
  'rec.type.slip': 'पर्ची',
  'rec.type.slip_response': 'बुनकर का जवाब',
  'rec.type.reversal': 'वापस लिया',

  // Sync badge
  'sync.synced': 'सिंक हो गया',
  'sync.offline': 'ऑफलाइन',
  'sync.pending': '{n} बाकी',
  'sync.error': 'सिंक रुका',

  // Validation
  'valid.required': 'यह ज़रूरी है',
  'valid.number': 'सही संख्या भरें',
  'valid.positive': 'शून्य से बड़ा होना चाहिए',
  'valid.phone': 'सही फ़ोन नंबर भरें',
  'valid.pin': '4 अंक का पिन भरें',
  'valid.pinMismatch': 'पिन मेल नहीं खाता',
  'valid.photoRequired': 'फ़ोटो ज़रूरी है',

  // Common UI
  'common.loading': 'लोड हो रहा है…',
  'common.empty': 'कुछ नहीं मिला',
  'common.comingSoon': 'जल्द आ रहा है',
  'common.yes': 'हाँ',
  'common.no': 'नहीं',
  'common.optional': 'वैकल्पिक',
  'common.rupees': 'रुपये',
  'common.kg': 'किलो',
  'common.ft': 'फुट',
  'common.in': 'इंच',

  // Route titles
  'route.setup': 'यूनिट बनाएँ',
  'route.login': 'लॉग इन',
  'route.home': 'होम',
  'route.orders': 'ऑर्डर',
  'route.orderNew': 'नया ऑर्डर',
  'route.orderDetail': 'ऑर्डर',
  'route.looms': 'करघा',
  'route.loomNew': 'नया करघा',
  'route.loomDetail': 'करघा',
  'route.weavers': 'बुनकर',
  'route.weaverNew': 'नया बुनकर',
  'route.weaverDetail': 'बुनकर',
  'route.thekedars': 'ठेकेदार',
  'route.thekedarNew': 'नया ठेकेदार',
  'route.yarn': 'ऊन',
  'route.yarnIssue': 'ऊन दिया',
  'route.yarnReturn': 'ऊन वापस',
  'route.rates': 'रेट कार्ड',
  'route.bazaarNew': 'नया बाज़ार',
  'route.bazaarDetail': 'बाज़ार',
  'route.peshgiNew': 'नई पेशगी',
  'route.checkinNew': 'चेक-इन',
  'route.roker': 'रोकड़',
  'route.digest': 'दैनिक सार',
  'route.audit': 'ऑडिट',
  'route.settings': 'सेटिंग',
  'route.slip': 'पर्ची',
  'route.exporter': 'एक्सपोर्टर',

  // Setup
  'setup.title': 'नई यूनिट बनाएँ',
  'setup.join': 'मौजूदा यूनिट से जुड़ें',
  'setup.create': 'नई यूनिट',
  'setup.unitName': 'यूनिट का नाम',
  'setup.ownerName': 'मालिक का नाम',
  'setup.ownerPhone': 'मालिक का फ़ोन',
  'setup.pin': '4 अंक का पिन बनाएँ',
  'setup.pinConfirm': 'पिन दोबारा भरें',
  'setup.unitCode': 'यूनिट कोड',
  'setup.unitKey': 'यूनिट चाबी',
  'setup.createBtn': 'यूनिट बनाएँ',
  'setup.joinBtn': 'जुड़ें',

  // Login
  'login.title': 'अपना नाम चुनें',
  'login.enterPin': 'पिन भरें',
  'login.wrongPin': 'ग़लत पिन',
  'login.lockedOut': '{s} सेकंड बाद कोशिश करें',
  'login.clear': 'मिटाएँ',

  // Share
  'share.title': 'WhatsApp पर भेजें',
  'share.to': 'किसको',
  'share.preview': 'पूरा संदेश',
  'share.send': 'WhatsApp पर भेजें',

  // Photo
  'photo.capture': 'फ़ोटो लें',
  'photo.retake': 'दोबारा लें',
  'photo.required': 'फ़ोटो ज़रूरी',

  // Person picker
  'person.search': 'नाम या गाँव से खोजें',
  'person.father': 'पिता',

  // PWA install helper
  'pwa.install.title': 'होम स्क्रीन पर जोड़ें',
  'pwa.install.hint': 'बिना इंटरनेट भी खुलेगा, ऐप जैसा चलेगा।',
  'pwa.install.add': 'जोड़ें',
  'pwa.install.dismiss': 'अभी नहीं',

  // Orders at risk (K1 digest)
  'risk.title': 'खतरे में ऑर्डर',
  'risk.reason.overdue': 'समय निकला',
  'risk.reason.due_soon': 'समय नज़दीक',
  'risk.reason.idle_loom': 'करघा रुका',
  'risk.openPieces': '{n} कालीन बाकी',
  'risk.due': 'डिलीवरी {date}',

  // Piece picker extras
  'tx.piece.ready': 'बाज़ार के लिए तैयार',
  'tx.piece.father': 'पिता: {name}',
} as const;

export default hi;
export type BaseKey = keyof typeof hi;
