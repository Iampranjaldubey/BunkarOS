const d = {
  'order.title': 'Orders', 'order.new': 'New order', 'order.edit': 'Edit order', 'order.buyer': 'Buyer', 'order.orderNo': 'Order number', 'order.design': 'Design',
  'order.size': 'Size', 'order.qty': 'Quantity', 'order.dueDate': 'Due date', 'order.price': 'Price (₹ per carpet)', 'order.notes': 'Notes', 'order.receivedOn': 'Received on',
  'order.status': 'Status', 'order.status.new': 'New', 'order.status.in_production': 'In production', 'order.status.finished': 'Finished', 'order.status.delivered': 'Delivered',
  'order.overdue': 'Overdue', 'order.dueSoon': '{n} days left', 'order.dueIn': 'in {n} days', 'order.lateBy': '{n} days late', 'order.delivered': 'delivered', 'order.pending': 'pending',
  'order.amountPending': 'Amount pending', 'order.start': 'Start production', 'order.finish': 'Mark finished', 'order.deliver': 'Deliver', 'order.deliverQty': 'Quantity delivered', 'order.fromStock': 'Reduce finished stock',
  'order.addNote': 'Add note', 'order.timeline': 'Timeline', 'order.empty': 'No orders yet', 'order.emptyHint': 'Add the buyer’s first order — design, size, quantity and due date.',
  'order.filter.all': 'All', 'order.filter.open': 'Open', 'order.counts': '{open} open · {overdue} late', 'order.share': 'Share status on WhatsApp',
  'order.shareText': '*{unit}*\nOrder {orderNo} — {design} {size}\nTotal {qty} · Delivered {delivered} · Pending {pending}\nStatus: {status}\nDue: {due}',
  'order.tooMany': 'Cannot deliver more than pending ({pending})', 'order.noBuyer': 'Add a buyer first', 'order.newBuyer': 'New buyer',
  'buyer.title': 'Buyers', 'buyer.name': 'Name / firm', 'buyer.phone': 'Phone', 'buyer.city': 'City', 'buyer.empty': 'No buyers yet', 'buyer.orders': '{n} orders',
} as const;
export default d;
