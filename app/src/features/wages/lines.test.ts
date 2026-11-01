// D-003 / SPEC-M02 AC7, AC9: slip sections, rounding row only when non-zero, WhatsApp text = same rows + worker link.
import { describe, it, expect } from 'vitest';
import type { SettingP, WagePaymentP } from '../../db/types';
import { paidView } from '../../domain/wage';
import { unitRules } from '../../domain/settings';
import { translate } from '../../i18n';
import { slipContent, slipText } from './lines';

// Hindi is the default language and the one loaded eagerly.
const t = (k: string, v?: Record<string, string | number>) => translate('hi', k, v);
const base: SettingP = { entityId: 'unit', unitName: 'Ideal Carpet', ownerPhone: '', lang: 'en', workingDaysPerMonth: 26, photoRequiredAbovePaise: 200_000, holidays: [] };
/** Example A, overtime off (AC5): paid ₹9,846, rounding −15 paise. */
const payment = (roundingPaise = -15): WagePaymentP => ({
  workerId: 'w', month: '2026-10', grossPaise: 1_084_615, otPaise: 0, deductions: [], advanceRecoveredPaise: 100_000, netPaise: 984_615,
  roundingPaise, paidPaise: 984_615 + roundingPaise, mode: 'cash',
  snapshot: { present: 1, half: 1, absent: 2, otHours: 0, pieces: 0, payType: 'monthly', ratePaise: 1_200_000, workingDays: 26, perDayPaise: 46_154, absentDeductPaise: 92_308, halfDeductPaise: 23_077, otRatePaise: 5_800, advanceOutstandingPaise: 100_000,
    parts: { base: 1_200_000, absent_deduct: 92_308, half_deduct: 23_077, overtime: 0, advance_recovered: 100_000, rounding: roundingPaise } },
});
const content = (p: WagePaymentP, settings = base) => {
  const r = unitRules(settings);
  return slipContent({ view: paidView(p), sections: r.slip, t, overtimeEnabled: r.overtimeEnabled, business: 'Ideal Carpet', worker: 'Rafiq', month: 'October 2026', mode: 'cash', payDayText: '31 October 2026' });
};

describe('slip (D-003)', () => {
  it('AC7 default sections: gross (also for monthly), advance, deductions, rounding (non-zero), net; signature; no attendance, pieces or overtime', () => {
    const c = content(payment());
    expect(c.rows.map((r) => r.section)).toEqual(['gross', 'deductions', 'advance', 'rounding', 'net']);
    expect(c.rows.map((r) => `${r.label}: ${r.value}`)).toEqual(['कुल कमाई: ₹10,846.15', 'कटौती: ₹0', 'एडवांस काटा: −₹1,000', 'राउंडिंग: −₹0.15', 'दिया: ₹9,846']);
    expect(c.signature).toBe(true);
    expect([c.business, c.worker, c.month]).toEqual(['Ideal Carpet', 'Rafiq', 'October 2026']);
  });

  it('the Rounding row appears only when rounding is not zero', () => {
    const p = { ...payment(0), paidPaise: 984_615 };
    expect(content(p).rows.some((r) => r.section === 'rounding')).toBe(false);
    expect(content(payment(+35)).rows.find((r) => r.section === 'rounding')?.value).toBe('₹0.35');
  });

  it('AC9: attendance summary on, signature off → summary shown, no signature line', () => {
    const c = content(payment(), { ...base, slipSections: { attendance: true, signature: false } });
    expect(c.rows[0]).toMatchObject({ section: 'attendance', value: 'P 1 · H 1 · A 2' });
    expect(c.signature).toBe(false);
  });

  it('overtime section only while overtime is on; optional sections when switched on', () => {
    const p = { ...payment(), otPaise: 17_400, netPaise: 1_002_015, paidPaise: 1_002_000 };
    expect(content(p, { ...base, slipSections: { overtime: true } }).rows.some((r) => r.section === 'overtime')).toBe(false);
    const on = content(p, { ...base, overtimeEnabled: true, slipSections: { overtime: true, rate: true, advanceBalance: true, payment: true } });
    expect(on.rows.map((r) => r.section)).toEqual(['rate', 'gross', 'overtime', 'deductions', 'advance', 'rounding', 'net', 'advanceBalance', 'payment']);
    expect(on.rows.find((r) => r.section === 'gross')?.value).toBe('₹11,020.15'); // gross pay + overtime
  });

  it('WhatsApp text has the same fields as the printed slip plus the worker-page link', () => {
    const c = content(payment());
    const text = slipText(c, t, 'https://app.example/w/abc123');
    for (const r of c.rows) expect(text).toContain(`${r.label}: ${r.value}`);
    expect(text).toContain('*Ideal Carpet*');
    expect(text).toContain('कारीगर: Rafiq');
    expect(text.trim().endsWith('https://app.example/w/abc123')).toBe(true);
    expect(slipText(c, t)).not.toContain('/w/');
  });
});
