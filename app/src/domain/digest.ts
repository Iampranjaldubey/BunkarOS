// Bunkar OS — daily digest (K1). Pure.
// PRD K1: "Bazaars received, yarn issued, cash paid (from the roker), advances given,
// looms with no progress, orders at risk". Money comes from the roker (O1) so the
// digest and the cash book can never disagree.
import type { Rec, BazaarP, YarnIssueP, PeshgiP, SlipResponseP } from '../db/types.ts';
import { recsOfType } from './records.ts';
import { loomBoard } from './board.ts';
import { rokerDay } from './roker.ts';
import { listLooms, listOrders, listPieces, yarnBalances } from './pieces.ts';
import { formatINR } from './money.ts';
import { daysBetween } from './ids.ts';
import { formatDay } from './dates.ts';

/** An order is "at risk" if it still has unfinished pieces and is overdue, due within
 *  RISK_DUE_DAYS, or has a piece sitting on an idle loom. */
export const RISK_DUE_DAYS = 14;
export type OrderRiskReason = 'overdue' | 'due_soon' | 'idle_loom';
export interface OrderAtRisk {
  orderId: string;
  orderNo: string;
  reason: OrderRiskReason;
  openPieces: number;
  dueDate?: string;
}

export interface Digest {
  day: string;
  bazaarCount: number;
  bazaarSqft: number;
  woolIssuedG: number;          // wool issued on `day` (all holders)
  woolOutsideG: number;         // total wool held outside at the end of `day` (all holders)
  cashPaidPaise: number;        // cash OUT on `day` per the roker (wages + peshgi + manual)
  upiPaidPaise: number;         // UPI OUT on `day` per the roker
  peshgiGivenPaise: number;
  tauliShortCount: number;
  tauliShortLooms: string[];    // loom ids
  tauliShortLoomCodes: string[];
  idleLooms: string[];          // loom ids
  idleLoomCodes: string[];
  noWoolLooms: string[];        // loom ids with an on_loom piece out of wool
  noWoolLoomCodes: string[];
  ordersAtRisk: OrderAtRisk[];
  disputes: number;
  pendingSync: number;
}

const RISK_ORDER: Record<OrderRiskReason, number> = { overdue: 0, due_soon: 1, idle_loom: 2 };

/** Build the digest for a single day. nowISO drives the loom-board idle check. */
export function digest(recs: Rec[], day: string, nowISO: string): Digest {
  const bazaars = recsOfType<BazaarP>(recs, 'bazaar').filter((r) => r.day === day);
  const issues = recsOfType<YarnIssueP>(recs, 'yarn_issue').filter((r) => r.day === day);
  const peshgis = recsOfType<PeshgiP>(recs, 'peshgi').filter((r) => r.day === day);
  const responses = recsOfType<SlipResponseP>(recs, 'slip_response').filter((r) => r.day === day);
  const codeOf = new Map(listLooms(recs).map((l) => [l.entityId, l.code]));

  let bazaarSqft = 0;
  let tauliShortCount = 0;
  const tauliShortLooms: string[] = [];
  for (const r of bazaars) {
    const b = r.payload;
    bazaarSqft += b.areaSqft;
    if (b.tauli.shortG > 0) {
      tauliShortCount += 1;
      if (!tauliShortLooms.includes(b.loomId)) tauliShortLooms.push(b.loomId);
    }
  }

  let woolIssuedG = 0;
  for (const r of issues) woolIssuedG += r.payload.grams;
  // Balance as of the end of `day`: later records (incl. later reversals) are not applied.
  const woolOutsideG = yarnBalances(recs.filter((r) => r.day <= day))
    .reduce((sum, row) => sum + Math.max(0, row.grams), 0);

  const roker = rokerDay(recs, day);

  let peshgiGivenPaise = 0;
  for (const r of peshgis) peshgiGivenPaise += r.payload.amountPaise;

  const disputes = responses.filter((r) => r.payload.answer === 'dispute').length;

  const idleLooms = loomBoard(recs, nowISO).filter((l) => l.status === 'idle').map((l) => l.loomId);
  const idleSet = new Set(idleLooms);
  const noWoolLooms = loomBoard(recs, nowISO).filter((l) => l.status === 'no_wool').map((l) => l.loomId);

  const pieces = listPieces(recs);
  const ordersAtRisk: OrderAtRisk[] = [];
  for (const o of listOrders(recs)) {
    const open = pieces.filter((p) => p.orderId === o.entityId && (p.status === 'not_started' || p.status === 'on_loom' || p.status === 'on_hold'));
    if (open.length === 0) continue;
    let reason: OrderRiskReason | undefined;
    if (o.dueDate && o.dueDate < day) reason = 'overdue';
    else if (o.dueDate && daysBetween(day, o.dueDate) <= RISK_DUE_DAYS) reason = 'due_soon';
    else if (open.some((p) => p.loomId && idleSet.has(p.loomId))) reason = 'idle_loom';
    if (reason) ordersAtRisk.push({ orderId: o.entityId, orderNo: o.orderNo, reason, openPieces: open.length, dueDate: o.dueDate });
  }
  ordersAtRisk.sort((a, b) => RISK_ORDER[a.reason] - RISK_ORDER[b.reason] || a.orderNo.localeCompare(b.orderNo));

  const pendingSync = recs.filter((r) => r.sync === 'pending').length;

  return {
    day,
    bazaarCount: bazaars.length,
    bazaarSqft: Math.round(bazaarSqft * 100) / 100,
    woolIssuedG,
    woolOutsideG,
    cashPaidPaise: roker.cashOut,
    upiPaidPaise: roker.upiOut,
    peshgiGivenPaise,
    tauliShortCount,
    tauliShortLooms,
    tauliShortLoomCodes: tauliShortLooms.map((id) => codeOf.get(id) ?? id),
    idleLooms,
    idleLoomCodes: idleLooms.map((id) => codeOf.get(id) ?? id),
    noWoolLooms,
    noWoolLoomCodes: noWoolLooms.map((id) => codeOf.get(id) ?? id),
    ordersAtRisk,
    disputes,
    pendingSync,
  };
}

const kg = (g: number) => (g / 1000).toFixed(3);

/** Hindi (Devanagari) digest, one fact per line — readable on WhatsApp. */
export function digestTextHi(d: Digest): string {
  const lines = [
    `बुनकर OS — ${formatDay(d.day, 'hi')} का हिसाब`,
    `• बाज़ार: ${d.bazaarCount} कालीन · ${d.bazaarSqft.toFixed(2)} वर्ग फुट`,
    `• ऊन दी: ${kg(d.woolIssuedG)} किग्रा · कुल बाहर ${kg(d.woolOutsideG)} किग्रा`,
    `• नकद खर्च: ${formatINR(d.cashPaidPaise)} · UPI: ${formatINR(d.upiPaidPaise)}`,
    `• पेशगी दी: ${formatINR(d.peshgiGivenPaise)}`,
  ];
  if (d.tauliShortCount > 0) lines.push(`• तौल में कमी: ${d.tauliShortCount} (करघा ${d.tauliShortLoomCodes.join(', ')})`);
  if (d.noWoolLoomCodes.length > 0) lines.push(`• बिना ऊन के करघे: ${d.noWoolLoomCodes.length} (${d.noWoolLoomCodes.join(', ')})`);
  if (d.idleLoomCodes.length > 0) lines.push(`• रुके करघे: ${d.idleLoomCodes.length} (${d.idleLoomCodes.join(', ')})`);
  if (d.ordersAtRisk.length > 0) lines.push(`• खतरे में ऑर्डर: ${d.ordersAtRisk.map((o) => o.orderNo).join(', ')}`);
  if (d.disputes > 0) lines.push(`• बुनकर विवाद: ${d.disputes}`);
  if (d.pendingSync > 0) lines.push(`• सिंक बाकी: ${d.pendingSync}`);
  return lines.join('\n');
}

/** English digest, one fact per line. */
export function digestTextEn(d: Digest): string {
  const lines = [
    `Bunkar OS — summary for ${formatDay(d.day, 'en')}`,
    `• Bazaar: ${d.bazaarCount} carpets · ${d.bazaarSqft.toFixed(2)} sq ft`,
    `• Wool issued: ${kg(d.woolIssuedG)} kg · total outside ${kg(d.woolOutsideG)} kg`,
    `• Cash spent: ${formatINR(d.cashPaidPaise)} · UPI: ${formatINR(d.upiPaidPaise)}`,
    `• Advances given: ${formatINR(d.peshgiGivenPaise)}`,
  ];
  if (d.tauliShortCount > 0) lines.push(`• Wool shortfall: ${d.tauliShortCount} (loom ${d.tauliShortLoomCodes.join(', ')})`);
  if (d.noWoolLoomCodes.length > 0) lines.push(`• No-wool looms: ${d.noWoolLoomCodes.length} (${d.noWoolLoomCodes.join(', ')})`);
  if (d.idleLoomCodes.length > 0) lines.push(`• Idle looms: ${d.idleLoomCodes.length} (${d.idleLoomCodes.join(', ')})`);
  if (d.ordersAtRisk.length > 0) lines.push(`• Orders at risk: ${d.ordersAtRisk.map((o) => o.orderNo).join(', ')}`);
  if (d.disputes > 0) lines.push(`• Weaver disputes: ${d.disputes}`);
  if (d.pendingSync > 0) lines.push(`• Pending sync: ${d.pendingSync}`);
  return lines.join('\n');
}
