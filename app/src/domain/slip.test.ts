import { describe, it, expect } from 'vitest';
import type { BazaarP, PeshgiP, TauliResult } from '../db/types.ts';
import { buildBazaarSlip, buildPeshgiSlip, waMeLink } from './slip.ts';

const emptyTauli: TauliResult = {
  issuedG: 0, returnedG: 0, usedG: 0, wastagePct: 3, allowedG: 0, gapG: 0, shortG: 0, extraG: 0,
};

// Demo: carpet EX-118/03, gross ₹3,014.54, paid ₹1,955 (UPI), peshgi baaki ₹4,000
const bazaar: BazaarP = {
  pieceId: 'EX-118/03', loomId: 'l1', weaverId: 'w1',
  lengthIn: 119, widthIn: 72, areaSqft: 59.5, carpetGrams: 8500,
  rateId: 'r1', ratePaise: 5066, rateUnit: 'sqft',
  grossPaise: 301454, deductions: [], peshgiRecoveredPaise: 105954,
  netPaise: 195500, paidPaise: 195500, roundingPaise: 0,
  payment: { cashPaise: 0, upiPaise: 195500 }, tauli: emptyTauli,
};

describe('buildBazaarSlip', () => {
  const slip = buildBazaarSlip({
    bazaar, sourceId: 'bz-1', weaverName: 'Rafiq', weaverPhone: '9876543210',
    peshgiBalanceAfterPaise: 400000,
  });

  it('English text contains key numbers', () => {
    expect(slip.textEn).toContain('Rafiq ji');
    expect(slip.textEn).toContain('EX-118/03');
    expect(slip.textEn).toContain('₹3,014.54');
    expect(slip.textEn).toContain('₹1,955');
    expect(slip.textEn).toContain('UPI');
    expect(slip.textEn).toContain('₹4,000');
  });

  it('Hindi text uses Devanagari and key numbers', () => {
    expect(slip.textHi).toContain('जी'); // Devanagari honorific
    expect(slip.textHi).toContain('कालीन');
    expect(slip.textHi).toContain('EX-118/03');
    expect(slip.textHi).toContain('₹3,014.54');
    expect(slip.textHi).toContain('₹1,955');
    expect(slip.textHi).toContain('₹4,000');
  });

  it('has structured lines', () => {
    const labels = slip.lines.map((l) => l.label).join('|');
    expect(labels).toContain('Gross');
    expect(labels).toContain('Net');
    expect(labels).toContain('Paid');
    expect(labels).toContain('Peshgi balance');
    expect(slip.kind).toBe('bazaar');
    expect(slip.weaverId).toBe('w1');
  });
});

describe('buildBazaarSlip speechHi (SPEC-015 AC1)', () => {
  // Demo-exact bazaar: EX-118/03 measured 96×119 → area 79.33 sqft, gross
  // ₹3,014.54, deduction ₹60, peshgi recovered ₹1,000, paid ₹1,955 (UPI).
  const demoBazaar: BazaarP = {
    pieceId: 'EX-118/03', loomId: 'l1', weaverId: 'w1',
    lengthIn: 119, widthIn: 96, areaSqft: 79.33, carpetGrams: 21600,
    rateId: 'r1', ratePaise: 3800, rateUnit: 'sqft',
    grossPaise: 301454,
    deductions: [{ reason: 'नमी', amountPaise: 6000, photoId: 'p1' }],
    peshgiRecoveredPaise: 100000,
    netPaise: 195454, paidPaise: 195500, roundingPaise: 46,
    payment: { cashPaise: 0, upiPaise: 195500 },
    tauli: { ...emptyTauli, issuedG: 24000, returnedG: 1100, usedG: 22900, allowedG: 687, gapG: 1300, shortG: 613 },
  };

  const slip = buildBazaarSlip({
    bazaar: demoBazaar, sourceId: 'bz-1', weaverName: 'रफ़ीक़', weaverPhone: '9876543210',
    peshgiBalanceAfterPaise: 0,
  });

  it('speechHi exists and greets the weaver by name', () => {
    expect(slip.speechHi).toBeTruthy();
    expect(slip.speechHi).toContain('रफ़ीक़');
  });

  it('speechHi speaks the area in words + वर्ग फ़ुट', () => {
    expect(slip.speechHi).toContain('उन्यासी दशमलव तैंतीस वर्ग फ़ुट');
  });

  it('speechHi speaks the gross with rupees + paise', () => {
    expect(slip.speechHi).toContain('तीन हज़ार चौदह रुपये चौवन पैसे');
  });

  it('speechHi speaks the paid amount in words', () => {
    expect(slip.speechHi).toContain('एक हज़ार नौ सौ पचपन रुपये');
  });

  it('speechHi includes the closing instruction', () => {
    expect(slip.speechHi).toContain('सही है तो सही दबाएँ, गलत है तो गलत दबाएँ');
  });

  it('speechHi mentions the piece id spoken', () => {
    expect(slip.speechHi).toContain('ई एक्स एक सौ अठारह बटा तीन');
  });
});

describe('buildPeshgiSlip', () => {
  it('builds advance slip with balance', () => {
    const p: PeshgiP = { personKind: 'weaver', personId: 'w1', amountPaise: 200000, mode: 'cash', note: 'festival' };
    const slip = buildPeshgiSlip({ peshgi: p, sourceId: 'pg-1', weaverName: 'Rafiq', weaverPhone: '9876543210', balanceAfterPaise: 400000 });
    expect(slip.textEn).toContain('₹2,000');
    expect(slip.textEn).toContain('Cash');
    expect(slip.textEn).toContain('₹4,000');
    expect(slip.textHi).toContain('पेशगी');
  });

  it('speechHi speaks the advance amount in words + closing', () => {
    const p: PeshgiP = { personKind: 'weaver', personId: 'w1', amountPaise: 200000, mode: 'cash' };
    const slip = buildPeshgiSlip({ peshgi: p, sourceId: 'pg-1', weaverName: 'रफ़ीक़', weaverPhone: '9876543210', balanceAfterPaise: 400000 });
    expect(slip.speechHi).toContain('रफ़ीक़');
    expect(slip.speechHi).toContain('दो हज़ार रुपये');
    expect(slip.speechHi).toContain('सही है तो सही दबाएँ, गलत है तो गलत दबाएँ');
  });
});

describe('waMeLink', () => {
  it('prefixes 91 to a 10-digit number', () => {
    expect(waMeLink('9876543210', 'hi')).toBe('https://wa.me/919876543210?text=hi');
  });
  it('keeps a 12-digit number starting with 91', () => {
    expect(waMeLink('919876543210', 'hi')).toBe('https://wa.me/919876543210?text=hi');
  });
  it('strips non-digits and spaces', () => {
    expect(waMeLink('+91 98765-43210', 'hi')).toBe('https://wa.me/919876543210?text=hi');
  });
  it('drops a leading 0 on an 11-digit number', () => {
    expect(waMeLink('09876543210', 'hi')).toBe('https://wa.me/919876543210?text=hi');
  });
  it('URL-encodes the text', () => {
    expect(waMeLink('9876543210', 'कुल ₹3,015')).toContain('text=');
    expect(waMeLink('9876543210', 'a b&c')).toContain('a%20b%26c');
  });
});
