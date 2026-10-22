import { describe, it, expect } from 'vitest';
import { exportMonthXlsx } from './export';
import type { MonthReport } from '../../domain/dashboard';

describe('exportMonthXlsx', () => {
  it('produces a valid workbook with 4 sheets', async () => {
    const r: MonthReport = {
      month: '2026-10', workingDays: 26,
      attendance: [{ worker: { entityId: 'w', name: 'Rafiq', jobTitle: 'weaver', payType: 'monthly', salaryPaise: 900000, otRatePaise: 0, joinedOn: '2026-01-01', active: true }, days: { '2026-10-01': 'P', '2026-10-02': 'A' }, present: 1, half: 0, absent: 1, otHours: 0 }],
      wages: [], wageTotals: { gross: 0, ot: 0, deductions: 0, advances: 0, net: 0, paid: 0, pending: 0, workers: 0, paidCount: 0 },
      advancesGivenPaise: 0, cashOutPaise: 0, upiOutPaise: 0, stock: [], orders: { received: 0, delivered: 0, open: 0, overdue: 0, amountPendingPaise: 0 },
      usage: { byUser: [], workingDaysSoFar: 0, ownerOpens: 0 },
    };
    const blob = await exportMonthXlsx(r, 'Test', 'en');
    expect(blob.size).toBeGreaterThan(1000);
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(new Uint8Array(await blob.arrayBuffer()) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    expect(wb.worksheets).toHaveLength(4); // summary, attendance, wages, stock (names come from the active dictionary)
    expect(wb.worksheets[1].getRow(2).getCell(1).value).toBe('Rafiq');
  });
});
