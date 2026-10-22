// Excel export of the monthly report (exceljs, lazy-loaded). One sheet per table.
import type { Worksheet } from 'exceljs';
import type { MonthReport } from '../../domain/dashboard';
import type { Lang } from '../../db/types';
import { formatQty } from '../../domain/qty';
import { translate } from '../../i18n';

const rupees = (paise: number) => Math.round(paise) / 100;

export async function exportMonthXlsx(r: MonthReport, unitName: string, lang: Lang): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bunkar';
  const head = (ws: Worksheet, cols: { header: string; key: string; width?: number }[]) => { ws.columns = cols; ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }]; };

  const s = wb.addWorksheet(t('month.sheet.summary'));
  s.addRows([[unitName], [t('common.month'), r.month], [], [t('wages.gross'), rupees(r.wageTotals.gross + r.wageTotals.ot)], [t('wages.advances'), rupees(r.wageTotals.advances)], [t('wages.totalPaid'), rupees(r.wageTotals.paid)], [t('wages.totalPending'), rupees(r.wageTotals.pending)],
    [t('month.advancesGiven'), rupees(r.advancesGivenPaise)], [t('month.cashOut'), rupees(r.cashOutPaise)], [t('month.upiOut'), rupees(r.upiOutPaise)], [],
    [t('month.received'), r.orders.received], [t('month.deliveredQty'), r.orders.delivered], [t('month.open'), r.orders.open], [t('month.overdue'), r.orders.overdue], [t('month.amountPending'), rupees(r.orders.amountPendingPaise)]]);
  s.getColumn(1).width = 28; s.getColumn(2).width = 16;

  const a = wb.addWorksheet(t('month.sheet.attendance'));
  const days = Object.keys(r.attendance[0]?.days ?? {});
  head(a, [{ header: t('worker.name'), key: 'name', width: 22 }, ...days.map((d) => ({ header: d.slice(8), key: d, width: 4 })), { header: 'P', key: 'p', width: 5 }, { header: 'H', key: 'h', width: 5 }, { header: 'A', key: 'a', width: 5 }, { header: 'OT', key: 'ot', width: 6 }]);
  for (const row of r.attendance) a.addRow({ name: row.worker.name, ...row.days, p: row.present, h: row.half, a: row.absent, ot: row.otHours });

  const w = wb.addWorksheet(t('month.sheet.wages'));
  head(w, [{ header: t('worker.name'), key: 'name', width: 22 }, { header: t('worker.payType'), key: 'type', width: 14 }, { header: 'P', key: 'p', width: 5 }, { header: 'H', key: 'h', width: 5 }, { header: 'A', key: 'a', width: 5 }, { header: 'OT', key: 'ot', width: 6 },
    { header: t('wages.gross'), key: 'gross', width: 12 }, { header: t('wages.ot'), key: 'otp', width: 10 }, { header: t('wages.deductions'), key: 'ded', width: 12 }, { header: t('wages.advances'), key: 'adv', width: 12 }, { header: t('wages.net'), key: 'net', width: 12 }, { header: t('wages.paid'), key: 'paid', width: 12 }, { header: t('order.status'), key: 'st', width: 10 }]);
  for (const row of r.wages) {
    const p = row.payment?.payload;
    w.addRow({ name: row.worker.name, type: t(`worker.payType.${row.worker.payType}`), p: row.inputs.present, h: row.inputs.half, a: row.inputs.absent, ot: row.inputs.otHours,
      gross: rupees(p?.grossPaise ?? row.settlement.grossPaise), otp: rupees(p?.otPaise ?? row.settlement.otPaise), ded: rupees(p ? p.deductions.reduce((x, d) => x + d.amountPaise, 0) : row.settlement.deductionsPaise),
      adv: rupees(p?.advanceRecoveredPaise ?? row.settlement.advanceRecoveredPaise), net: rupees(p?.netPaise ?? row.settlement.netPaise), paid: p ? rupees(p.paidPaise) : 0, st: p ? t('wages.paid') : t('wages.pending') });
  }
  w.addRow({ name: t('common.total'), gross: rupees(r.wageTotals.gross), otp: rupees(r.wageTotals.ot), ded: rupees(r.wageTotals.deductions), adv: rupees(r.wageTotals.advances), net: rupees(r.wageTotals.net), paid: rupees(r.wageTotals.paid) }).font = { bold: true };

  const st = wb.addWorksheet(t('month.sheet.stock'));
  head(st, [{ header: t('stock.item'), key: 'name', width: 24 }, { header: t('stock.unit'), key: 'unit', width: 8 }, { header: t('stock.opening'), key: 'o', width: 12 }, { header: t('stock.totalIn'), key: 'i', width: 12 }, { header: t('stock.totalOut'), key: 'x', width: 12 }, { header: t('stock.adjust'), key: 'adj', width: 12 }, { header: t('stock.closing'), key: 'c', width: 12 }]);
  for (const { item, ledger } of r.stock) st.addRow({ name: item.name, unit: item.unit, o: Number(formatQty(ledger.opening, item.unit)), i: Number(formatQty(ledger.in, item.unit)), x: Number(formatQty(ledger.out, item.unit)), adj: Number(formatQty(ledger.adjust, item.unit)), c: Number(formatQty(ledger.closing, item.unit)) });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
