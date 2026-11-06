// SPEC-M18 bags pack v0: words that differ from carpet. Every key here overrides the base dictionaries for a bags unit.
// Hindi and Hinglish flagged for proofreading; confirm the trade's words with the bag partner (M19).
type Dict = Record<string, string>;

const hi: Dict = {
  'cat.addMore': 'और बैग जोड़ें', 'cat.anyDesign': 'सभी मॉडल', 'cat.cost': 'लागत (₹, एक बैग)', 'cat.design': 'मॉडल (नाम या कोड)',
  'cat.edit': 'बैग बदलें', 'cat.empty': 'कैटलॉग में अभी कोई बैग नहीं', 'cat.emptyHint': 'तैयार बैग फ़ोटो, मॉडल और साइज़ के साथ जोड़ें',
  'cat.err.design_required': 'मॉडल ज़रूरी है', 'cat.err.duplicate_tag': 'यह टैग पहले से किसी और बैग पर है', 'cat.err.unknown_carpet': 'बैग चुनें',
  'cat.legacyHint': 'पुराने तैयार माल आइटम: बैलेंस और इतिहास वैसे ही रहेंगे। नए बैग कैटलॉग में जोड़ें।',
  'cat.material': 'सामान के नोट (कपड़ा, चेन, रंग)', 'cat.new': 'नया बैग', 'cat.noMatch': 'इन फ़िल्टर से कोई बैग नहीं मिला', 'cat.pickCarpet': 'बैग चुनें',
  'cat.price': 'बेचने का भाव (₹, एक बैग)', 'cat.qty': 'कितने बैग', 'cat.saved': 'बैग सेव हुआ', 'cat.search': 'मॉडल, टैग या नोट से खोजें',
  'cat.shown': '{n} बैग', 'cat.title': 'बैग कैटलॉग', 'nav.catalogue': 'बैग कैटलॉग',
  'm17.drawn': 'तस्वीर नहीं है, मॉडल से नमूना बना दिखाया है', 'm17.loginTitle': 'कटिंग से रजिस्टर तक',
  'm17.loginLine': 'हाज़िरी, पगार, कपड़ा और ऑर्डर एक जगह। इंटरनेट न हो तब भी चलता है।',
  'month.deliveredQty': 'डिलीवर बैग', 'order.design': 'मॉडल', 'order.price': 'भाव (₹ प्रति बैग)', 'order.qty': 'कितने बैग',
  'order.emptyHint': 'खरीदार का पहला ऑर्डर जोड़ें — मॉडल, साइज़, कितने और कब तक।',
  'rec.carpet': 'कैटलॉग बैग', 'rec.finished_in': 'तैयार बैग', 'stock.finished': 'तैयार बैग', 'stock.finishedIn': 'बैग तैयार',
  'stock.emptyHint': 'कपड़ा, चेन, धागा — जो भी गोदाम में आता-जाता है, उसे जोड़ें।',
  'stock.kind.finished': 'तैयार बैग (मॉडल + साइज़)', 'stock.kind.raw': 'कच्चा माल (कपड़ा, चेन, धागा)',
};
const hin: Dict = {
  'cat.addMore': 'Aur bag jodein', 'cat.anyDesign': 'Sab model', 'cat.cost': 'Lagat (₹, ek bag)', 'cat.design': 'Model (naam ya code)',
  'cat.edit': 'Bag badlein', 'cat.empty': 'Catalogue mein abhi koi bag nahi', 'cat.emptyHint': 'Taiyaar bag photo, model aur size ke saath jodein',
  'cat.err.design_required': 'Model zaroori hai', 'cat.err.duplicate_tag': 'Yeh tag pehle se kisi aur bag par hai', 'cat.err.unknown_carpet': 'Bag chunein',
  'cat.legacyHint': 'Purane taiyaar maal item: balance aur itihaas waise hi rahenge. Naye bag catalogue mein jodein.',
  'cat.material': 'Material notes (kapda, chain, rang)', 'cat.new': 'Naya bag', 'cat.noMatch': 'In filter se koi bag nahi mila', 'cat.pickCarpet': 'Bag chunein',
  'cat.price': 'Bechne ka bhav (₹, ek bag)', 'cat.qty': 'Kitne bag', 'cat.saved': 'Bag save hua', 'cat.search': 'Model, tag ya note se khojein',
  'cat.shown': '{n} bag', 'cat.title': 'Bag catalogue', 'nav.catalogue': 'Bag catalogue',
  'm17.drawn': 'Photo nahi hai, model se namoona bana dikhaya hai', 'm17.loginTitle': 'Cutting se register tak',
  'm17.loginLine': 'Haaziri, pagaar, kapda aur order ek jagah. Internet na ho tab bhi chalta hai.',
  'month.deliveredQty': 'Deliver bag', 'order.design': 'Model', 'order.price': 'Bhaav (₹ per bag)', 'order.qty': 'Kitne bag',
  'order.emptyHint': 'Buyer ka pehla order jodein — model, size, kitne aur kab tak.',
  'rec.carpet': 'Catalogue bag', 'rec.finished_in': 'Taiyaar bag', 'stock.finished': 'Taiyaar bag', 'stock.finishedIn': 'Bag taiyaar',
  'stock.emptyHint': 'Kapda, chain, dhaaga — jo bhi godown mein aata-jaata hai, use jodein.',
  'stock.kind.finished': 'Taiyaar bag (model + size)', 'stock.kind.raw': 'Kachcha maal (kapda, chain, dhaaga)',
};
const en: Dict = {
  'cat.addMore': 'Add more bags', 'cat.anyDesign': 'All models', 'cat.cost': 'Cost (₹, per bag)', 'cat.design': 'Model (name or code)',
  'cat.edit': 'Edit bag', 'cat.empty': 'No bags in the catalogue yet', 'cat.emptyHint': 'Add finished bags with photos, model and size',
  'cat.err.design_required': 'Model is required', 'cat.err.duplicate_tag': 'Another bag already has this tag', 'cat.err.unknown_carpet': 'Choose a bag',
  'cat.legacyHint': 'Old finished-goods items keep their balance and history. Add new bags in the catalogue.',
  'cat.material': 'Material notes (fabric, zips, colours)', 'cat.new': 'New bag', 'cat.noMatch': 'No bag matches these filters', 'cat.pickCarpet': 'Choose a bag',
  'cat.price': 'Selling price (₹, per bag)', 'cat.qty': 'How many bags', 'cat.saved': 'Bag saved', 'cat.search': 'Search model, tag or notes',
  'cat.shown': '{n} bags', 'cat.title': 'Bag catalogue', 'nav.catalogue': 'Bag catalogue',
  'm17.drawn': 'No photo yet, drawn from the model', 'm17.loginTitle': 'From the cutting table to the register',
  'm17.loginLine': 'Attendance, wages, fabric and orders in one place. Works without internet.',
  'month.deliveredQty': 'Bags delivered', 'order.design': 'Model', 'order.price': 'Price (₹ per bag)', 'order.qty': 'Quantity',
  'order.emptyHint': 'Add the buyer’s first order — model, size, quantity and due date.',
  'rec.carpet': 'Catalogue bag', 'rec.finished_in': 'Finished bags', 'stock.finished': 'Finished bags', 'stock.finishedIn': 'Bags finished',
  'stock.emptyHint': 'Fabric, zips, thread — add whatever moves in and out of the store.',
  'stock.kind.finished': 'Finished bag (model + size)', 'stock.kind.raw': 'Raw material (fabric, zips, thread)',
};
export default { hi, hin, en };
