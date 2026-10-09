// Bunkar OS — projections barrel (pure). Re-exports domain helpers and adds
// weaverPassbook + auditLog. All projections ignore reversed + rejected records.
import type { Rec, BazaarP, PeshgiP, JobP, ReversalP } from '../db/types.ts';
import { recsOfType } from './records.ts';
import { peshgiLedger } from './peshgi.ts';

export { activeRecords, latestEntities } from './records.ts';
export {
  listLooms, listWeavers, listThekedars, listUsers, listOrders, listPieces,
  getSettings, yarnBalances, pieceYarn,
} from './pieces.ts';
export type { Piece, PieceStatus, YarnBalanceRow } from './pieces.ts';
export { rateForPiece, normFor } from './rates.ts';
export { peshgiBalance, peshgiLedger } from './peshgi.ts';
export type { PeshgiLedgerEntry } from './peshgi.ts';
export { rokerDay } from './roker.ts';
export type { RokerDay, RokerEntry } from './roker.ts';
export { jobRateFor, computeJob, listJobs } from './jobs.ts';
export type { JobUnit, JobWork, JobAmount, JobRow } from './jobs.ts';
// SPEC-017 owner-home projections.
export { loomsFreeSoon, peshgiOutstanding, todayEntriesByUser } from './owner.ts';
export type { FreeSoonRow, OutstandingPerson, PeshgiOutstanding, StaffEntryCount } from './owner.ts';
// SPEC-018 monthly summary.
export { monthlySummary, monthLabel, monthlyTextHi, monthlyTextEn } from './monthly.ts';
export type { MonthlySummary } from './monthly.ts';
// SPEC-015 Hindi spoken-number helpers (C9 voice slip).
export {
  hindiNumber, rupeesSpoken, decimalSpoken, kgSpoken, ftInSpoken, pieceIdSpoken,
} from './speech.ts';
export { loomBoard } from './board.ts';
export type { LoomBoardRow, LoomStatus } from './board.ts';
export { digest, digestTextHi, digestTextEn, RISK_DUE_DAYS } from './digest.ts';
export { formatDay, formatTime } from './dates.ts';
export type { Digest, OrderAtRisk, OrderRiskReason } from './digest.ts';

export interface PassbookEntry {
  recId: string;
  day: string;
  at: string;
  kind: 'bazaar' | 'peshgi_given' | 'peshgi_recovered' | 'job';
  label: string;
  amountPaise: number; // signed from the weaver's perspective (+ earned, - advance given to them is info)
  balanceAfterPaise: number; // running peshgi balance
  work?: JobP['work']; // on 'job' entries: the ancillary work type (UI translates)
}

/**
 * Weaver passbook: chronological record of bazaar wages paid and peshgi
 * activity for a single weaver, with the running peshgi balance.
 */
export function weaverPassbook(recs: Rec[], weaverId: string): PassbookEntry[] {
  const ledger = peshgiLedger(recs, 'weaver', weaverId);
  const ledgerByRec = new Map(ledger.map((e) => [e.recId + ':' + e.kind, e]));

  type Row = Omit<PassbookEntry, 'balanceAfterPaise'>;
  const rows: Row[] = [];

  for (const r of recsOfType<BazaarP>(recs, 'bazaar')) {
    if (r.payload.weaverId !== weaverId) continue;
    rows.push({ recId: r.id, day: r.day, at: r.at, kind: 'bazaar', label: `Bazaar ${r.payload.pieceId}`, amountPaise: r.payload.paidPaise });
  }
  for (const r of recsOfType<PeshgiP>(recs, 'peshgi')) {
    if (r.payload.personKind !== 'weaver' || r.payload.personId !== weaverId) continue;
    rows.push({ recId: r.id, day: r.day, at: r.at, kind: 'peshgi_given', label: 'Peshgi given', amountPaise: r.payload.amountPaise });
  }
  for (const r of recsOfType<JobP>(recs, 'job')) {
    const j = r.payload;
    if (j.workerKind !== 'weaver' || j.workerId !== weaverId) continue;
    rows.push({ recId: r.id, day: r.day, at: r.at, kind: 'job', label: `Job ${j.work}`, amountPaise: j.paidPaise, work: j.work });
  }

  rows.sort((a, b) => (a.day === b.day ? a.at.localeCompare(b.at) : a.day.localeCompare(b.day)));

  // Attach running peshgi balance using the peshgi ledger as source of truth.
  return rows.map((row) => {
    const key =
      row.kind === 'peshgi_given'
        ? row.recId + ':given'
        : row.kind === 'bazaar'
          ? row.recId + ':recovered'
          : row.recId + ':recovered';
    const bal = ledgerByRec.get(key)?.balanceAfterPaise;
    return { ...row, balanceAfterPaise: bal ?? lastBalanceUpTo(ledger, row.day, row.at) };
  });
}

function lastBalanceUpTo(ledger: { day: string; at: string; balanceAfterPaise: number }[], day: string, at: string): number {
  let bal = 0;
  for (const e of ledger) {
    if (e.day < day || (e.day === day && e.at <= at)) bal = e.balanceAfterPaise;
  }
  return bal;
}

export interface AuditEntry {
  recId: string;
  at: string;
  day: string;
  type: string;
  by: string;
  role: string;
  device: string;
  reversed: boolean;
  rejected: boolean;
  reversalReason?: string;
  rejectReason?: string;
}

/**
 * Full audit log over ALL records (including reversed/rejected), annotated with
 * reversal and rejection status. Newest first.
 */
export function auditLog(recs: Rec[]): AuditEntry[] {
  const reversalByTarget = new Map<string, string>();
  for (const r of recs) {
    if (r.type === 'reversal' && r.sync !== 'rejected') {
      const p = r.payload as ReversalP;
      reversalByTarget.set(p.targetId, p.reason);
    }
  }
  const entries = recs
    .filter((r) => r.type !== 'reversal')
    .map((r) => ({
      recId: r.id,
      at: r.at,
      day: r.day,
      type: r.type,
      by: r.by,
      role: r.role,
      device: r.device,
      reversed: reversalByTarget.has(r.id),
      rejected: r.sync === 'rejected',
      reversalReason: reversalByTarget.get(r.id),
      rejectReason: r.rejectReason,
    }));
  entries.sort((a, b) => b.at.localeCompare(a.at));
  return entries;
}
