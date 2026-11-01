import { describe, it, expect } from 'vitest';
import { exportMonthXlsx } from './export';
import type { MonthReport } from '../../domain/dashboard';

describe('exportMonthXlsx', () => {
  it('produces a valid workbook with 5 sheets incl. an orders sheet with a total row (SPEC-M10 AC2)', async () => {
    const r: MonthReport = {
      month: '2026-10', workingDays: 26,
      attendance: [{ worker: { entityId: 'w', name: 'Rafiq', jobTitle: 'weaver', payType: 'monthly', salaryPaise: 900000, otRatePaise: 0, joinedOn: '2026-01-01', active: true }, days: { '2026-10-01': 'P', '2026-10-02': 'A' }, present: 1, half: 0, absent: 1, otHours: 0 }],
      wages: [], wageTotals: { gross: 0, ot: 0, deductions: 0, advances: 0, net: 0, paid: 0, pending: 0, workers: 0, paidCount: 0 },
      advancesGivenPaise: 0, cashOutPaise: 0, upiOutPaise: 0, stock: [], orders: { received: 2, delivered: 12, open: 1, overdue: 1, amountPendingPaise: 400_000 },
      orderList: [
        { orderId: 'o1', orderNo: 'ORD-001', buyerName: 'Sharma Exports', design: 'Kashan', size: '8x10', qty: 20, delivered: 12, pending: 8, dueDate: '2026-10-20', status: 'in_production', overdue: true, amountPendingPaise: 400_000 },
        { orderId: 'o2', orderNo: 'ORD-002', buyerName: 'Gupta', design: 'Tabriz', size: '6x9', qty: 4, delivered: 4, pending: 0, dueDate: '2026-10-25', status: 'delivered', overdue: false },
      ],
      usage: { byUser: [], workingDaysSoFar: 0, ownerOpens: 0 },
    };
    const blob = await exportMonthXlsx(r, 'Test', 'en');
    expect(blob.size).toBeGreaterThan(1000);
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(new Uint8Array(await blob.arrayBuffer()) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    expect(wb.worksheets).toHaveLength(5); // summary, attendance, wages, stock, orders
    expect(wb.worksheets[1].getRow(2).getCell(1).value).toBe('Rafiq');
    const os = wb.worksheets[4];
    const row = (n: number) => (os.getRow(n).values as unknown[]).slice(1, 12);
    expect(row(2).slice(0, 7)).toEqual(['ORD-001', 'Sharma Exports', 'Kashan', '8x10', 20, 12, 8]);
    expect(os.getRow(2).getCell(11).value).toBe(4000);
    const total = os.getRow(4);
    expect([total.getCell(5).value, total.getCell(6).value, total.getCell(7).value, total.getCell(11).value]).toEqual([24, 16, 8, r.orders.amountPendingPaise / 100]);
    expect(total.font?.bold).toBe(true);
  });
});
