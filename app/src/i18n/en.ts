// Bunkar OS — base English dictionary. MUST mirror every key in hi.ts.
const en = {
  // App
  'app.name': 'Bunkar OS',
  'app.tagline': 'Bhadohi carpet unit — offline',

  // Nav
  'nav.home': 'Home',
  'nav.orders': 'Orders',
  'nav.looms': 'Looms',
  'nav.weavers': 'Weavers',
  'nav.loomsWeavers': 'Looms/Weavers',
  'nav.thekedars': 'Thekedars',
  'nav.yarn': 'Yarn',
  'nav.rates': 'Rate card',
  'nav.bazaar': 'Bazaar',
  'nav.peshgi': 'Peshgi',
  'nav.checkin': 'Check-in',
  'nav.roker': 'Roker',
  'nav.digest': 'Daily digest',
  'nav.audit': 'Audit',
  'nav.settings': 'Settings',
  'nav.more': 'More',

  // Language
  'lang.toggle': 'Choose language',

  // Common actions
  'action.save': 'Save',
  'action.cancel': 'Cancel',
  'action.confirm': 'Confirm',
  'action.back': 'Back',
  'action.search': 'Search',
  'action.add': 'Add',
  'action.share': 'Share',
  'action.sync': 'Sync',
  'action.retry': 'Retry',
  'action.delete': 'Delete',
  'action.edit': 'Edit',
  'action.reverse': 'Reverse',
  'action.logout': 'Log out',
  'action.next': 'Next',
  'action.done': 'Done',

  // Roles
  'role.owner': 'Owner',
  'role.munshi': 'Munshi',
  'role.thekedar': 'Thekedar',

  // Piece statuses (D5)
  'status.not_started': 'Not started',
  'status.on_loom': 'On loom',
  'status.off_loom': 'Off loom',
  'status.delivered': 'Delivered',
  'status.on_hold': 'On hold',

  // Loom board statuses (D9 / K2)
  'board.on_track': 'On track',
  'board.slow': 'Slow',
  'board.idle': 'Idle',
  'board.free': 'Free',

  // Record types — human labels for the audit log (not raw keys)
  'rec.type.user': 'User',
  'rec.type.loom': 'Loom',
  'rec.type.thekedar': 'Thekedar',
  'rec.type.weaver': 'Weaver',
  'rec.type.order': 'Order',
  'rec.type.piece_assign': 'Piece assigned',
  'rec.type.piece_status': 'Status change',
  'rec.type.rate': 'Rate',
  'rec.type.norm': 'Norm',
  'rec.type.setting': 'Setting',
  'rec.type.yarn_issue': 'Yarn issued',
  'rec.type.yarn_return': 'Yarn returned',
  'rec.type.bazaar': 'Bazaar',
  'rec.type.peshgi': 'Peshgi',
  'rec.type.checkin': 'Check-in',
  'rec.type.roker': 'Roker',
  'rec.type.slip': 'Slip',
  'rec.type.slip_response': 'Weaver response',
  'rec.type.reversal': 'Reversed',

  // Sync badge
  'sync.synced': 'Synced',
  'sync.offline': 'Offline',
  'sync.pending': '{n} pending',
  'sync.error': 'Sync stopped',

  // Validation
  'valid.required': 'This is required',
  'valid.number': 'Enter a valid number',
  'valid.positive': 'Must be greater than zero',
  'valid.phone': 'Enter a valid phone number',
  'valid.pin': 'Enter a 4-digit PIN',
  'valid.pinMismatch': 'PINs do not match',
  'valid.photoRequired': 'Photo is required',

  // Common UI
  'common.loading': 'Loading…',
  'common.empty': 'Nothing here yet',
  'common.comingSoon': 'Coming soon',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.optional': 'Optional',
  'common.rupees': 'rupees',
  'common.kg': 'kg',
  'common.ft': 'ft',
  'common.in': 'in',

  // Route titles
  'route.setup': 'Create unit',
  'route.login': 'Log in',
  'route.home': 'Home',
  'route.orders': 'Orders',
  'route.orderNew': 'New order',
  'route.orderDetail': 'Order',
  'route.looms': 'Looms',
  'route.loomNew': 'New loom',
  'route.loomDetail': 'Loom',
  'route.weavers': 'Weavers',
  'route.weaverNew': 'New weaver',
  'route.weaverDetail': 'Weaver',
  'route.thekedars': 'Thekedars',
  'route.thekedarNew': 'New thekedar',
  'route.yarn': 'Yarn',
  'route.yarnIssue': 'Yarn issued',
  'route.yarnReturn': 'Yarn returned',
  'route.rates': 'Rate card',
  'route.bazaarNew': 'New bazaar',
  'route.bazaarDetail': 'Bazaar',
  'route.peshgiNew': 'New peshgi',
  'route.checkinNew': 'Check-in',
  'route.roker': 'Roker',
  'route.digest': 'Daily digest',
  'route.audit': 'Audit',
  'route.settings': 'Settings',
  'route.slip': 'Slip',
  'route.exporter': 'Exporter',

  // Setup
  'setup.title': 'Create a new unit',
  'setup.join': 'Join an existing unit',
  'setup.create': 'New unit',
  'setup.unitName': 'Unit name',
  'setup.ownerName': 'Owner name',
  'setup.ownerPhone': 'Owner phone',
  'setup.pin': 'Create a 4-digit PIN',
  'setup.pinConfirm': 'Re-enter PIN',
  'setup.unitCode': 'Unit code',
  'setup.unitKey': 'Unit key',
  'setup.createBtn': 'Create unit',
  'setup.joinBtn': 'Join',

  // Login
  'login.title': 'Pick your name',
  'login.enterPin': 'Enter PIN',
  'login.wrongPin': 'Wrong PIN',
  'login.lockedOut': 'Try again in {s} seconds',
  'login.clear': 'Clear',

  // Share
  'share.title': 'Send on WhatsApp',
  'share.to': 'To',
  'share.preview': 'Full message',
  'share.send': 'Send on WhatsApp',

  // Photo
  'photo.capture': 'Take photo',
  'photo.retake': 'Retake',
  'photo.required': 'Photo required',

  // Person picker
  'person.search': 'Search by name or village',
  'person.father': 'Father',

  // PWA install helper
  'pwa.install.title': 'Add to home screen',
  'pwa.install.hint': 'Opens offline, works like an app.',
  'pwa.install.add': 'Add',
  'pwa.install.dismiss': 'Not now',

  // Orders at risk (K1 digest)
  'risk.title': 'Orders at risk',
  'risk.reason.overdue': 'Overdue',
  'risk.reason.due_soon': 'Due soon',
  'risk.reason.idle_loom': 'Idle loom',
  'risk.openPieces': '{n} pieces left',
  'risk.due': 'Due {date}',

  // Piece picker extras
  'tx.piece.ready': 'Ready for bazaar',
  'tx.piece.father': 'Father: {name}',
} as const;

export default en;
