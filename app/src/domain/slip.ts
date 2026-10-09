// Bunkar OS — weaver slips (C8/C9) + WhatsApp link. Pure.
import type { BazaarP, PeshgiP } from '../db/types.ts';
import { formatFtIn, areaSqft as areaSqftFn } from './units.ts';
import { formatINR } from './money.ts';
import { rupeesSpoken, decimalSpoken, ftInSpoken, pieceIdSpoken } from './speech.ts';

export type SlipLine = { label: string; amountPaise?: number; value?: string; sign?: '+' | '-' };

/** SlipP without the public token (token assigned by the foundation/server layer). */
export interface SlipDraft {
  kind: 'bazaar' | 'peshgi';
  sourceId: string;
  weaverId: string;
  weaverName: string;
  weaverPhone: string;
  textHi: string;
  textEn: string;
  speechHi: string;   // C9 (SPEC-015): spoken Hindi script, numbers in words
  lines: SlipLine[];
}

/** Closing instruction read on every spoken slip (SPEC-015). */
const SPEECH_CLOSING = 'सही है तो सही दबाएँ, गलत है तो गलत दबाएँ।';

/** Payment mode spoken in Hindi. */
function modeHi(mode: 'UPI' | 'Cash' | 'UPI+Cash'): string {
  return mode === 'Cash' ? 'नकद' : mode === 'UPI' ? 'यूपीआई' : 'यूपीआई और नकद';
}

/** INR with paise, e.g. ₹3,014.54 */
function inrP(paise: number): string {
  return formatINR(paise, { paise: true });
}
/** INR whole rupees, e.g. ₹1,955 */
function inr(paise: number): string {
  return formatINR(paise);
}

/**
 * Build a bazaar (wage received) slip in Hindi (Devanagari) + English.
 * Lines: size, area, rate, gross, each deduction, peshgi recovered, net,
 * rounding, paid (with mode), peshgi balance.
 */
export function buildBazaarSlip(input: {
  bazaar: BazaarP;
  sourceId: string;
  weaverName: string;
  weaverPhone: string;
  peshgiBalanceAfterPaise: number;
}): SlipDraft {
  const { bazaar: b, sourceId, weaverName, weaverPhone, peshgiBalanceAfterPaise } = input;
  const size = `${formatFtIn(b.lengthIn)} x ${formatFtIn(b.widthIn)}`;
  const area = areaDisplay(b);
  const rateStr = `${inr(b.ratePaise)}/${b.rateUnit === 'sqgaj' ? 'sq gaj' : 'sq ft'}`;
  const mode = b.payment.upiPaise > 0 && b.payment.cashPaise === 0 ? 'UPI' : b.payment.cashPaise > 0 && b.payment.upiPaise === 0 ? 'Cash' : 'UPI+Cash';

  const lines: SlipLine[] = [
    { label: 'Size / नाप', value: size },
    { label: 'Area / क्षेत्र', value: `${area} sq ft` },
    { label: 'Rate / दर', value: rateStr },
    { label: 'Gross / कुल', amountPaise: b.grossPaise, sign: '+' },
  ];
  for (const d of b.deductions) {
    lines.push({ label: `Deduction / कटौती: ${d.reason}`, amountPaise: d.amountPaise, sign: '-' });
  }
  if (b.peshgiRecoveredPaise > 0) {
    lines.push({ label: 'Peshgi recovered / पेशगी वसूली', amountPaise: b.peshgiRecoveredPaise, sign: '-' });
  }
  lines.push({ label: 'Net / शुद्ध', amountPaise: b.netPaise });
  lines.push({ label: 'Rounding / राउंडिंग', amountPaise: b.roundingPaise, sign: b.roundingPaise >= 0 ? '+' : '-' });
  lines.push({ label: `Paid / दिया (${mode})`, amountPaise: b.paidPaise });
  lines.push({ label: 'Peshgi balance / पेशगी बाकी', amountPaise: peshgiBalanceAfterPaise });

  // short name without honorific suffix duplication
  const textEn =
    `${weaverName} ji, carpet ${b.pieceId} (${size}, ${area} sq ft) at ${rateStr}: ` +
    `gross ${inrP(b.grossPaise)}` +
    (b.deductions.length ? `, deductions ${inrP(sumDeductions(b))}` : '') +
    (b.peshgiRecoveredPaise > 0 ? `, peshgi recovered ${inrP(b.peshgiRecoveredPaise)}` : '') +
    `, net ${inrP(b.netPaise)}, paid ${inr(b.paidPaise)} (${mode})` +
    `, peshgi balance ${inr(peshgiBalanceAfterPaise)}.`;

  const textHi =
    `${weaverName} जी, कालीन ${b.pieceId} (${size}, ${area} वर्ग फुट) दर ${rateStr}: ` +
    `कुल ${inrP(b.grossPaise)}` +
    (b.deductions.length ? `, कटौती ${inrP(sumDeductions(b))}` : '') +
    (b.peshgiRecoveredPaise > 0 ? `, पेशगी वसूली ${inrP(b.peshgiRecoveredPaise)}` : '') +
    `, शुद्ध ${inrP(b.netPaise)}, दिया गया ${inr(b.paidPaise)} (${mode})` +
    `, पेशगी बाकी ${inr(peshgiBalanceAfterPaise)}।`;

  // Spoken Hindi script (numbers in words) for TTS + the server audio clip.
  const areaNum = b.areaSqft > 0 ? b.areaSqft : areaSqftFn(b.lengthIn, b.widthIn);
  const speechParts: string[] = [
    `${weaverName} जी, नमस्ते।`,
    `कालीन ${pieceIdSpoken(b.pieceId)}, नाप ${ftInSpoken(b.lengthIn)} गुणा ${ftInSpoken(b.widthIn)},`,
    `क्षेत्रफल ${decimalSpoken(areaNum)} वर्ग फ़ुट।`,
    `मजदूरी ${rupeesSpoken(b.grossPaise)}।`,
  ];
  for (const d of b.deductions) {
    speechParts.push(`${d.reason} कटौती ${rupeesSpoken(d.amountPaise)}।`);
  }
  if (b.peshgiRecoveredPaise > 0) {
    speechParts.push(`पेशगी वसूली ${rupeesSpoken(b.peshgiRecoveredPaise)}।`);
  }
  speechParts.push(`आपको दिया गया ${rupeesSpoken(b.paidPaise)}, ${modeHi(mode)} से।`);
  speechParts.push(`पेशगी बाकी ${rupeesSpoken(peshgiBalanceAfterPaise)}।`);
  speechParts.push(SPEECH_CLOSING);
  const speechHi = speechParts.join(' ');

  return { kind: 'bazaar', sourceId, weaverId: b.weaverId, weaverName, weaverPhone, textHi, textEn, speechHi, lines };
}

/** Build a peshgi (advance given) slip in Hindi + English. */
export function buildPeshgiSlip(input: {
  peshgi: PeshgiP;
  sourceId: string;
  weaverName: string;
  weaverPhone: string;
  balanceAfterPaise: number;
}): SlipDraft {
  const { peshgi: p, sourceId, weaverName, weaverPhone, balanceAfterPaise } = input;
  const mode = p.mode === 'upi' ? 'UPI' : 'Cash';
  const lines: SlipLine[] = [
    { label: `Advance / पेशगी (${mode})`, amountPaise: p.amountPaise, sign: '+' },
    { label: 'Peshgi balance / पेशगी बाकी', amountPaise: balanceAfterPaise },
  ];
  const textEn =
    `${weaverName} ji, advance ${inr(p.amountPaise)} (${mode}) given` +
    (p.note ? ` — ${p.note}` : '') +
    `. Peshgi balance ${inr(balanceAfterPaise)}.`;
  const textHi =
    `${weaverName} जी, पेशगी ${inr(p.amountPaise)} (${mode}) दी गई` +
    (p.note ? ` — ${p.note}` : '') +
    `। पेशगी बाकी ${inr(balanceAfterPaise)}।`;
  const spokenMode = mode === 'Cash' ? 'नकद' : 'यूपीआई';
  const speechHi =
    `${weaverName} जी, नमस्ते। ` +
    `आपको पेशगी ${rupeesSpoken(p.amountPaise)}, ${spokenMode} से दी गई।` +
    (p.note ? ` ${p.note}।` : '') +
    ` पेशगी बाकी ${rupeesSpoken(balanceAfterPaise)}। ` +
    SPEECH_CLOSING;
  return { kind: 'peshgi', sourceId, weaverId: p.personId, weaverName, weaverPhone, textHi, textEn, speechHi, lines };
}

function sumDeductions(b: BazaarP): number {
  return b.deductions.reduce((s, d) => s + d.amountPaise, 0);
}

function areaDisplay(b: BazaarP): string {
  const a = b.areaSqft > 0 ? b.areaSqft : areaSqftFn(b.lengthIn, b.widthIn);
  return a.toFixed(2);
}

/**
 * Build a wa.me link. Strips non-digits from phone; 10-digit numbers get a 91
 * prefix; 12-digit numbers already starting with 91 are kept. Text is URL-encoded.
 */
export function waMeLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  let normalized: string;
  if (digits.length === 10) normalized = `91${digits}`;
  else if (digits.length === 12 && digits.startsWith('91')) normalized = digits;
  else if (digits.length === 11 && digits.startsWith('0')) normalized = `91${digits.slice(1)}`;
  else normalized = digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}
