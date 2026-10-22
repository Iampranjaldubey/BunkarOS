const d = {
  'wages.title': 'Wages', 'wages.sheet': 'Wage sheet', 'wages.gross': 'Gross', 'wages.ot': 'Overtime', 'wages.deductions': 'Deductions',
  'wages.advances': 'Advance recovered', 'wages.net': 'Net due', 'wages.paid': 'Paid', 'wages.pending': 'Pending', 'wages.pay': 'Pay',
  'wages.paidOn': 'Paid on {date}', 'wages.lock': 'Lock month', 'wages.unlock': 'Unlock month', 'wages.locked': 'Month is locked',
  'wages.lockHint': 'After locking, attendance, advances and payments for this month cannot change.', 'wages.perDay': 'Per day', 'wages.absentDeduct': 'Absent ({n} days)',
  'wages.halfDeduct': 'Half days ({n})', 'wages.base': 'Salary', 'wages.daysWorked': 'Days worked', 'wages.pieces': 'Pieces', 'wages.addDeduction': 'Add deduction',
  'wages.deductionLabel': 'For what', 'wages.deductionAmount': 'Amount (₹)', 'wages.recover': 'Recover from advance (₹)', 'wages.outstanding': 'Advance outstanding',
  'wages.afterRecover': 'Balance after payment', 'wages.rounding': 'Rounding', 'wages.mode': 'Paid by', 'wages.confirm': 'Confirm payment',
  'wages.alreadyPaid': 'This month is already paid', 'wages.slip': 'Slip', 'wages.shareSlip': 'Share slip on WhatsApp', 'wages.printSlip': 'Print slip',
  'wages.noWorkers': 'No workers this month', 'wages.summary': '{paid}/{total} paid', 'wages.photoHint': 'Large amount — photograph the receipt or register',
  'wages.totalPaid': 'Total paid', 'wages.totalPending': 'Total pending', 'wages.unmarkedWarn': '{n} days have no attendance',
  'adv.title': 'Give advance', 'adv.worker': 'To whom', 'adv.amount': 'Amount (₹)', 'adv.mode': 'Paid by', 'adv.saved': 'Advance recorded', 'adv.balanceAfter': 'Balance after this',
  'adv.list': 'Advances', 'adv.new': 'New advance',
  'slip.title': 'Wage slip', 'slip.month': 'Month', 'slip.text': '*{unit}*\nWage slip — {month}\nName: {name}\n{lines}\n*Paid: {paid}* ({mode})\nAdvance balance: {balance}',
} as const;
export default d;
