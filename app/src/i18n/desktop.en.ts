// SPEC-M12 desktop-first UI strings (English).
const desktopEn: Record<string, string> = {
  'log.lockedMonth': 'Month is locked — unlock it first', 
  'nav.newEntry': 'New entry', 'nav.collapse': 'Collapse menu', 'nav.expand': 'Expand menu', 'nav.quickTitle': 'What do you want to enter?',
  'att.prevDay': 'Previous day', 'att.nextDay': 'Next day', 'att.onlyUnmarked': 'Only unmarked', 'att.allMarked': 'Everyone is marked',
  'att.keyHint': 'Keyboard: P present · H half day · A absent (then next worker) · + / − overtime · ↑ ↓ move',
  'att.colWorker': 'Worker', 'att.colMark': 'Attendance', 'att.colOt': 'Overtime (hours)', 'att.colPieces': 'Pieces', 'att.colState': 'Status', 'att.notMarked': 'Unmarked',
  'log.enteredOn': 'entered {day}', 'log.filterType': 'Entry type', 'log.allTypes': 'All types', 'log.colWhen': 'When', 'log.colType': 'Type', 'log.colWhat': 'What', 'log.colBy': 'By', 'log.shown': '{n} entries',
  'home.ordersPanel': 'Orders to deliver', 'home.ordersPanelEmpty': 'No orders due in the next 7 days', 'home.stockPanel': 'Low stock', 'home.stockPanelEmpty': 'All stock is fine',
  'home.viewAll': 'View all', 'home.lowLevel': 'Low level', 'home.pendingQty': '{n} pending',
  'ctx.worker': 'This worker', 'ctx.pickWorker': 'Pick a worker to see their advance balance and last advances here', 'ctx.lastAdvances': 'Last advances', 'ctx.none': 'Nothing yet',
  'ctx.item': 'This item', 'ctx.pickItem': 'Pick an item to see its stock and last entries here', 'ctx.lastMoves': 'Last entries', 'ctx.stockNow': 'In stock now',
};
export default desktopEn;
