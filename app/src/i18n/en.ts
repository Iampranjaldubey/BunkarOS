// Base English. Mirrors every key in hi.ts.
const en = {
  'app.name': 'Bunkar',
  'app.tagline': 'Attendance · Wages · Stock · Orders — works offline',

  'nav.home': 'Home', 'nav.attendance': 'Attendance', 'nav.wages': 'Wages', 'nav.stock': 'Stock',
  'nav.orders': 'Orders', 'nav.workers': 'Workers', 'nav.month': 'Monthly report', 'nav.log': 'Entry log',
  'nav.settings': 'Settings', 'nav.more': 'More', 'nav.buyers': 'Buyers', 'nav.label': 'Main menu',

  'lang.toggle': 'Choose language',

  'action.save': 'Save', 'action.saveAdd': 'Save & add another', 'action.cancel': 'Cancel',
  'action.confirm': 'Confirm', 'action.back': 'Back', 'action.search': 'Search', 'action.add': 'Add',
  'action.share': 'Share', 'action.sync': 'Sync', 'action.retry': 'Retry', 'action.delete': 'Delete',
  'action.edit': 'Edit', 'action.reverse': 'Reverse', 'action.logout': 'Log out', 'action.next': 'Next',
  'action.done': 'Done', 'action.print': 'Print', 'action.export': 'Export to Excel', 'action.view': 'View',
  'action.close': 'Close',

  'role.owner': 'Owner', 'role.staff': 'Staff / Munshi', 'role.system': 'System',

  'sync.synced': 'Synced', 'sync.offline': 'Offline', 'sync.pending': '{n} pending', 'sync.error': 'Sync stopped', 'sync.login': 'Sign in',

  'valid.required': 'This is required', 'valid.number': 'Enter a valid number', 'valid.positive': 'Must be greater than zero',
  'valid.phone': 'Enter a valid phone number', 'valid.pin': 'Enter a 4-digit PIN', 'valid.pinMismatch': 'PINs do not match',
  'valid.photoRequired': 'A photo is required for this amount', 'valid.date': 'Choose a valid date', 'valid.locked': 'This month is locked — ask the owner to unlock',

  'common.loading': 'Loading…', 'common.empty': 'Nothing here yet', 'common.yes': 'Yes', 'common.no': 'No',
  'common.optional': 'Optional', 'common.date': 'Date', 'common.today': 'Today', 'common.note': 'Note',
  'common.photo': 'Photo', 'common.total': 'Total', 'common.all': 'All', 'common.active': 'Active', 'common.inactive': 'Inactive',
  'common.cash': 'Cash', 'common.upi': 'UPI', 'common.by': 'by {name}', 'common.at': 'at {time}', 'common.edited': 'Edited',
  'common.reversed': 'Reversed', 'common.rejected': 'Rejected by server', 'common.month': 'Month', 'common.rupees': '₹',

  'route.setup': 'Create unit', 'route.login': 'Log in', 'route.home': 'Home', 'route.settings': 'Settings', 'route.log': 'Entry log',

  'setup.title': 'Create a new unit', 'setup.join': 'Join an existing unit', 'setup.create': 'New unit',
  'setup.unitName': 'Unit / shop name', 'setup.ownerName': 'Owner name', 'setup.ownerPhone': 'Owner phone',
  'setup.pin': 'Create a 4-digit PIN', 'setup.pinConfirm': 'Re-enter PIN', 'setup.unitCode': 'Unit code',
  'setup.unitKey': 'Unit key', 'setup.createBtn': 'Create unit', 'setup.joinBtn': 'Join',
  'setup.hint': 'First time? Create a unit. Second phone? Join with the unit code and key.',

  'login.title': 'Pick your name', 'login.enterPin': 'Enter PIN', 'login.wrongPin': 'Wrong PIN',
  'login.lockedOut': 'Try again in {s} seconds', 'login.clear': 'Clear', 'login.noUsers': 'No users yet — turn on internet and reopen',

  'share.title': 'Send on WhatsApp', 'share.to': 'To', 'share.preview': 'Full message', 'share.send': 'Send on WhatsApp',
  'photo.capture': 'Take photo', 'photo.retake': 'Retake', 'photo.required': 'Photo required',
  'person.search': 'Search by name',
  'pwa.install.title': 'Add to home screen', 'pwa.install.hint': 'Opens offline, works like an app.',
  'pwa.install.add': 'Add', 'pwa.install.dismiss': 'Not now',

  'rec.user': 'User', 'rec.setting': 'Setting', 'rec.worker': 'Worker', 'rec.item': 'Stock item', 'rec.buyer': 'Buyer',
  'rec.order': 'Order', 'rec.attendance': 'Attendance', 'rec.piece_entry': 'Piece entry', 'rec.advance': 'Advance',
  'rec.wage_payment': 'Wage payment', 'rec.period_lock': 'Month locked', 'rec.stock_in': 'Stock in', 'rec.stock_out': 'Stock out',
  'rec.stock_adjust': 'Stock adjustment', 'rec.finished_in': 'Finished carpets', 'rec.order_status': 'Order status', 'rec.delivery': 'Delivery',
  'rec.order_note': 'Order note', 'rec.usage': 'Screen opened', 'rec.reversal': 'Reversed',

  'settings.unit': 'Unit settings', 'settings.workingDays': 'Working days per month', 'settings.workingDaysHint': 'Used for deductions: salary ÷ this many days',
  'settings.photoAbove': 'Photo required above (₹)', 'settings.language': 'Language', 'settings.users': 'Logins',
  'settings.addUser': 'Add staff', 'settings.userName': 'Name', 'settings.userPhone': 'Phone', 'settings.userRole': 'Role',
  'settings.userPin': '4-digit PIN', 'settings.deactivate': 'Deactivate', 'settings.joinInfo': 'To join from another phone',
  'settings.joinHint': 'Never share the unit code and key outside the unit.', 'settings.copy': 'Copy', 'settings.copied': 'Copied',
  'settings.saved': 'Settings saved', 'settings.holidays': 'Holidays', 'settings.theme': 'Theme', 'settings.theme.auto': 'Same as phone',
  'settings.theme.light': 'Light', 'settings.theme.dark': 'Dark',

  'log.title': 'Entry log', 'log.filterUser': 'Whose entries', 'log.empty': 'No entries yet', 'log.old': 'Old',
  'log.new': 'New', 'log.reason': 'Reason', 'log.day': 'Date', 'log.reverse': 'Reverse entry', 'log.reverseWhy': 'Reason for reversing',
  'log.cannotReverse': 'You can only reverse your own entries from today',
} as const;
export default en;
