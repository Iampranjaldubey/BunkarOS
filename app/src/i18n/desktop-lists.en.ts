// Bunkar OS — desktop/tablet list & table headers (SPEC-019), English.
// Merged into the English dictionary by src/i18n/index.ts via the `./*.en.ts` glob.
const en = {
  // Orders table
  'col.order.no': 'Order',
  'col.order.exporter': 'Exporter',
  'col.order.design': 'Design',
  'col.order.size': 'Size',
  'col.order.count': 'Pieces',
  'col.order.status': 'Status',
  'col.order.due': 'Delivery',

  // Order detail — pieces table
  'col.piece.id': 'Piece',
  'col.piece.status': 'Status',
  'col.piece.loom': 'Loom',
  'col.piece.weaver': 'Weaver',
  'col.piece.woven': '% woven',
  'col.piece.actions': '',

  // Looms table
  'col.loom.code': 'Loom',
  'col.loom.village': 'Village',
  'col.loom.thekedar': 'Thekedar',
  'col.loom.piece': 'Current piece',
  'col.loom.woven': '% woven',
  'col.loom.status': 'Status',

  // Thekedars table
  'col.thekedar.name': 'Thekedar',
  'col.thekedar.village': 'Village',
  'col.thekedar.looms': 'Looms',
  'col.thekedar.wool': 'Wool out',

  // Yarn balances table
  'col.yarn.holder': 'Holder',
  'col.yarn.shade': 'Shade',
  'col.yarn.lot': 'Lot',
  'col.yarn.kg': 'kg',
  'col.yarn.oldest': 'Oldest',

  // Roker entries table
  'col.roker.label': 'Entry',
  'col.roker.mode': 'Mode',
  'col.roker.in': 'In',
  'col.roker.out': 'Out',
  'roker.stat.opening': 'Opening cash',
  'roker.stat.in': 'Total in',
  'roker.stat.out': 'Total out',
  'roker.stat.closing': 'Closing cash',

  // Audit table
  'col.audit.when': 'When',
  'col.audit.who': 'Who',
  'col.audit.role': 'Role',
  'col.audit.device': 'Device',
  'col.audit.type': 'Type',
  'col.audit.summary': 'Summary',
  'col.audit.flags': '',

  // Rates tables
  'col.rate.quality': 'Quality',
  'col.rate.work': 'Work',
  'col.rate.rate': 'Rate',
  'col.rate.unit': 'Unit',
  'col.rate.effective': 'Effective',

  // Weaver detail aside
  'weaver.detail.profile': 'Profile',

  // Loom detail aside
  'loom.detail.profile': 'Profile',
} as const;

export default en;
