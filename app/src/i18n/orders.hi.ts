const d = {
  'order.title': 'ऑर्डर', 'order.new': 'नया ऑर्डर', 'order.edit': 'ऑर्डर बदलें', 'order.buyer': 'खरीदार', 'order.orderNo': 'ऑर्डर नंबर', 'order.design': 'डिज़ाइन',
  'order.size': 'साइज़', 'order.qty': 'कितने कालीन', 'order.dueDate': 'कब तक देना है', 'order.price': 'भाव (₹ प्रति कालीन)', 'order.notes': 'नोट', 'order.receivedOn': 'ऑर्डर मिला',
  'order.status': 'स्थिति', 'order.status.new': 'नया', 'order.status.in_production': 'बन रहा है', 'order.status.finished': 'तैयार', 'order.status.delivered': 'डिलीवर',
  'order.overdue': 'समय निकल गया', 'order.dueSoon': '{n} दिन बाकी', 'order.dueIn': '{n} दिन में', 'order.lateBy': '{n} दिन लेट', 'order.delivered': 'डिलीवर हुए', 'order.pending': 'बाकी',
  'order.amountPending': 'बाकी रकम', 'order.start': 'काम शुरू', 'order.finish': 'तैयार हो गया', 'order.deliver': 'डिलीवर करें', 'order.deliverQty': 'कितने दिए', 'order.fromStock': 'तैयार स्टॉक से घटाएँ',
  'order.addNote': 'नोट जोड़ें', 'order.timeline': 'क्या-क्या हुआ', 'order.empty': 'अभी कोई ऑर्डर नहीं', 'order.emptyHint': 'खरीदार का पहला ऑर्डर जोड़ें — डिज़ाइन, साइज़, कितने और कब तक।',
  'order.filter.all': 'सभी', 'order.filter.open': 'चालू', 'order.counts': '{open} चालू · {overdue} लेट', 'order.share': 'स्थिति WhatsApp पर भेजें',
  'order.shareText': '*{unit}*\nऑर्डर {orderNo} — {design} {size}\nकुल {qty} · डिलीवर {delivered} · बाकी {pending}\nस्थिति: {status}\nडिलीवरी: {due}',
  'order.tooMany': 'बाकी से ज़्यादा नहीं दे सकते ({pending})', 'order.noBuyer': 'पहले खरीदार जोड़ें', 'order.newBuyer': 'नया खरीदार',
  'buyer.title': 'खरीदार', 'buyer.name': 'नाम / फर्म', 'buyer.phone': 'फ़ोन', 'buyer.city': 'शहर', 'buyer.empty': 'अभी कोई खरीदार नहीं', 'buyer.orders': '{n} ऑर्डर',
} as const;
export default d;
