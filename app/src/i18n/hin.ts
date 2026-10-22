// Base Hinglish — Hindi in Roman script with everyday English words.
const hin = {
  'app.name': 'Bunkar',
  'app.tagline': 'Haaziri · Pagaar · Stock · Order — offline bhi',

  'nav.home': 'Home', 'nav.attendance': 'Haaziri', 'nav.wages': 'Pagaar', 'nav.stock': 'Stock',
  'nav.orders': 'Order', 'nav.workers': 'Kaarigar', 'nav.month': 'Mahine ka hisaab', 'nav.log': 'Entry log',
  'nav.settings': 'Settings', 'nav.more': 'Aur', 'nav.buyers': 'Buyer', 'nav.label': 'Main menu',

  'lang.toggle': 'Bhasha chunein',

  'action.save': 'Save karein', 'action.saveAdd': 'Save karke agla', 'action.cancel': 'Cancel',
  'action.confirm': 'Pakka karein', 'action.back': 'Wapas', 'action.search': 'Khojein', 'action.add': 'Jodein',
  'action.share': 'Bhejein', 'action.sync': 'Sync', 'action.retry': 'Phir try karein', 'action.delete': 'Hataein',
  'action.edit': 'Badlein', 'action.reverse': 'Wapas lein', 'action.logout': 'Log out', 'action.next': 'Aage',
  'action.done': 'Ho gaya', 'action.print': 'Print', 'action.export': 'Excel mein nikaalein', 'action.view': 'Dekhein',
  'action.close': 'Band karein',

  'role.owner': 'Maalik', 'role.staff': 'Staff / Munshi', 'role.system': 'System',

  'sync.synced': 'Sync ho gaya', 'sync.offline': 'Offline', 'sync.pending': '{n} baaki', 'sync.error': 'Sync ruka', 'sync.login': 'Login karein',

  'valid.required': 'Yeh zaroori hai', 'valid.number': 'Sahi number bharein', 'valid.positive': 'Zero se bada hona chahiye',
  'valid.phone': 'Sahi phone number bharein', 'valid.pin': '4 ank ka PIN bharein', 'valid.pinMismatch': 'PIN match nahi karta',
  'valid.photoRequired': 'Itni rakam ke liye photo zaroori hai', 'valid.date': 'Sahi date chunein', 'valid.locked': 'Yeh mahina lock hai — maalik se khulwaayein',

  'common.loading': 'Load ho raha hai…', 'common.empty': 'Abhi kuch nahi hai', 'common.yes': 'Haan', 'common.no': 'Nahi',
  'common.optional': 'Optional', 'common.date': 'Date', 'common.today': 'Aaj', 'common.note': 'Note',
  'common.photo': 'Photo', 'common.total': 'Total', 'common.all': 'Sabhi', 'common.active': 'Chaalu', 'common.inactive': 'Band',
  'common.cash': 'Cash', 'common.upi': 'UPI', 'common.by': '{name} ne', 'common.at': '{time} baje', 'common.edited': 'Badla gaya',
  'common.reversed': 'Wapas liya', 'common.rejected': 'Server ne nahi maana', 'common.month': 'Mahina', 'common.rupees': '₹',

  'route.setup': 'Unit banaayein', 'route.login': 'Login', 'route.home': 'Home', 'route.settings': 'Settings', 'route.log': 'Entry log',

  'setup.title': 'Nayi unit banaayein', 'setup.join': 'Maujooda unit se judein', 'setup.create': 'Nayi unit',
  'setup.unitName': 'Unit / dukaan ka naam', 'setup.ownerName': 'Maalik ka naam', 'setup.ownerPhone': 'Maalik ka phone',
  'setup.pin': '4 ank ka PIN banaayein', 'setup.pinConfirm': 'PIN dobara bharein', 'setup.unitCode': 'Unit code',
  'setup.unitKey': 'Unit key', 'setup.createBtn': 'Unit banaayein', 'setup.joinBtn': 'Judein',
  'setup.hint': 'Pehli baar? Nayi unit banaayein. Doosra phone? Unit code aur key se judein.',

  'login.title': 'Apna naam chunein', 'login.enterPin': 'PIN bharein', 'login.wrongPin': 'Galat PIN',
  'login.lockedOut': '{s} second baad try karein', 'login.clear': 'Mitaayein', 'login.noUsers': 'Abhi koi user nahi — internet on karke phir kholein',

  'share.title': 'WhatsApp par bhejein', 'share.to': 'Kisko', 'share.preview': 'Poora message', 'share.send': 'WhatsApp par bhejein',
  'photo.capture': 'Photo lein', 'photo.retake': 'Dobara lein', 'photo.required': 'Photo zaroori',
  'person.search': 'Naam se khojein',
  'pwa.install.title': 'Home screen par jodein', 'pwa.install.hint': 'Bina internet bhi khulega, app jaisa chalega.',
  'pwa.install.add': 'Jodein', 'pwa.install.dismiss': 'Abhi nahi',

  'rec.user': 'User', 'rec.setting': 'Setting', 'rec.worker': 'Kaarigar', 'rec.item': 'Stock item', 'rec.buyer': 'Buyer',
  'rec.order': 'Order', 'rec.attendance': 'Haaziri', 'rec.piece_entry': 'Piece entry', 'rec.advance': 'Advance',
  'rec.wage_payment': 'Pagaar payment', 'rec.period_lock': 'Mahina lock', 'rec.stock_in': 'Stock aaya', 'rec.stock_out': 'Stock gaya',
  'rec.stock_adjust': 'Stock sudhaar', 'rec.finished_in': 'Taiyaar carpet', 'rec.order_status': 'Order status', 'rec.delivery': 'Delivery',
  'rec.order_note': 'Order note', 'rec.usage': 'Screen kholi', 'rec.reversal': 'Wapas liya',

  'settings.unit': 'Unit settings', 'settings.workingDays': 'Mahine mein kaam ke din', 'settings.workingDaysHint': 'Pagaar kaatne ke liye: salary ÷ itne din',
  'settings.photoAbove': 'Isse upar ki rakam par photo zaroori (₹)', 'settings.language': 'Bhasha', 'settings.users': 'Login',
  'settings.addUser': 'Staff jodein', 'settings.userName': 'Naam', 'settings.userPhone': 'Phone', 'settings.userRole': 'Role',
  'settings.userPin': '4 ank ka PIN', 'settings.deactivate': 'Band karein', 'settings.joinInfo': 'Doosre phone se judne ke liye',
  'settings.joinHint': 'Unit code aur key kisi bahar wale ko na dein.', 'settings.copy': 'Copy', 'settings.copied': 'Copy ho gaya',
  'settings.saved': 'Settings save ho gayi', 'settings.holidays': 'Chhuttiyaan', 'settings.theme': 'Rang', 'settings.theme.auto': 'Phone jaisa',
  'settings.theme.light': 'Halka', 'settings.theme.dark': 'Gehra',

  'log.title': 'Entry log', 'log.filterUser': 'Kiski entry', 'log.empty': 'Abhi koi entry nahi', 'log.old': 'Purana',
  'log.new': 'Naya', 'log.reason': 'Wajah', 'log.day': 'Date', 'log.reverse': 'Entry wapas lein', 'log.reverseWhy': 'Wapas lene ki wajah',
  'log.cannotReverse': 'Sirf aaj ki apni entry wapas le sakte hain',
} as const;
export default hin;
