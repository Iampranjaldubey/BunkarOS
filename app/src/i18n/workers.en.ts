const d = {
  'worker.title': 'Workers', 'worker.new': 'New worker', 'worker.edit': 'Edit worker', 'worker.name': 'Name', 'worker.phone': 'Phone',
  'worker.jobTitle': 'Job', 'worker.job.weaver': 'Weaver', 'worker.job.finisher': 'Finisher', 'worker.job.helper': 'Helper', 'worker.job.other': 'Other',
  'worker.payType': 'Pay type', 'worker.payType.monthly': 'Monthly salary', 'worker.payType.daily': 'Daily wage', 'worker.payType.piece': 'Piece rate',
  'worker.salary': 'Monthly salary (₹)', 'worker.dailyRate': 'Daily wage (₹)', 'worker.pieceRate': 'Rate per piece (₹)',
  'worker.otRate': 'Overtime rate (₹ per hour)', 'worker.otHint': 'Leave blank for salary ÷ working days ÷ 8', 'worker.joinedOn': 'Joined on',
  'worker.active': 'Active', 'worker.deactivate': 'Left the unit', 'worker.reactivate': 'Reactivate', 'worker.photo': 'Photo (to identify)',
  'worker.empty': 'No workers yet', 'worker.emptyHint': 'Add the first worker — a name and pay type are enough.', 'worker.search': 'Search by name',
  'worker.showInactive': 'Show inactive too', 'worker.count': '{n} workers', 'worker.thisMonth': 'This month', 'worker.advances': 'Advances',
  'worker.balance': 'Advance balance', 'worker.lastPayment': 'Last payment', 'worker.noPayment': 'None yet', 'worker.rateLocked': 'Only the owner can change pay figures',
  'worker.perDay': 'One day = {amount}',
  'att.title': 'Attendance', 'att.present': 'Present', 'att.half': 'Half day', 'att.absent': 'Absent', 'att.unmarked': 'Unmarked', 'att.ot': 'Overtime',
  'att.otHours': 'OT hours', 'att.allPresent': 'All present', 'att.marked': '{marked}/{total} marked', 'att.saved': 'Attendance saved', 'att.summary': 'Today',
  'att.empty': 'Add workers first', 'att.month': 'Month attendance', 'att.sunday': 'Sunday', 'att.holiday': 'Holiday', 'att.legend': 'P present · H half · A absent',
  'att.locked': 'This month is locked', 'att.pieces': 'Pieces', 'att.addPieces': 'Add pieces', 'att.pieceCount': 'How many pieces', 'att.pieceRate': 'Rate (₹ per piece)',
} as const;
export default d;
