// Bunkar OS — desktop/tablet list & table headers (SPEC-019), Hindi.
// Merged into the base dictionary by src/i18n/index.ts via the `./*.hi.ts` glob.
// Only lg+ table layouts use these; the phone cards are unchanged.
const hi = {
  // Orders table
  'col.order.no': 'ऑर्डर',
  'col.order.exporter': 'एक्सपोर्टर',
  'col.order.design': 'डिज़ाइन',
  'col.order.size': 'नाप',
  'col.order.count': 'पीस',
  'col.order.status': 'स्थिति',
  'col.order.due': 'डिलीवरी',

  // Order detail — pieces table
  'col.piece.id': 'पीस',
  'col.piece.status': 'स्थिति',
  'col.piece.loom': 'लूम',
  'col.piece.weaver': 'बुनकर',
  'col.piece.woven': '% बुना',
  'col.piece.actions': '',

  // Looms table
  'col.loom.code': 'लूम',
  'col.loom.village': 'गाँव',
  'col.loom.thekedar': 'ठेकेदार',
  'col.loom.piece': 'मौजूदा पीस',
  'col.loom.woven': '% बुना',
  'col.loom.status': 'स्थिति',

  // Thekedars table
  'col.thekedar.name': 'ठेकेदार',
  'col.thekedar.village': 'गाँव',
  'col.thekedar.looms': 'लूम',
  'col.thekedar.wool': 'ऊन बाहर',

  // Yarn balances table
  'col.yarn.holder': 'किसके पास',
  'col.yarn.shade': 'शेड',
  'col.yarn.lot': 'लॉट',
  'col.yarn.kg': 'किलो',
  'col.yarn.oldest': 'सबसे पुराना',

  // Roker entries table
  'col.roker.label': 'विवरण',
  'col.roker.mode': 'तरीका',
  'col.roker.in': 'आया',
  'col.roker.out': 'गया',
  'roker.stat.opening': 'शुरुआती रोकड़',
  'roker.stat.in': 'कुल आया',
  'roker.stat.out': 'कुल गया',
  'roker.stat.closing': 'अंत रोकड़',

  // Audit table
  'col.audit.when': 'कब',
  'col.audit.who': 'किसने',
  'col.audit.role': 'भूमिका',
  'col.audit.device': 'डिवाइस',
  'col.audit.type': 'प्रकार',
  'col.audit.summary': 'विवरण',
  'col.audit.flags': '',

  // Rates tables
  'col.rate.quality': 'क्वालिटी',
  'col.rate.work': 'काम',
  'col.rate.rate': 'रेट',
  'col.rate.unit': 'इकाई',
  'col.rate.effective': 'से लागू',

  // Weaver detail aside
  'weaver.detail.profile': 'प्रोफ़ाइल',

  // Loom detail aside
  'loom.detail.profile': 'प्रोफ़ाइल',
} as const;

export default hi;
