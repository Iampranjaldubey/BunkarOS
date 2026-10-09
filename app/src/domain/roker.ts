// Bunkar OS — roker (owner cash/UPI day ledger) (O1, D7). Pure. Integer paise.
import type { Rec, BazaarP, PeshgiP, RokerP, JobP, WeaverP, ThekedarP } from '../db/types.ts';
import { activeRecords, recsOfType, latestEntities } from './records.ts';
import type { SettingP } from '../db/types.ts';

export interface RokerEntry {
  recId: string;
  label: string;
  dir: 'in' | 'out';
  mode: 'cash' | 'upi';
  amountPaise: number;
  auto: boolean;
  kind?: 'adjusted' | 'job'; // 'adjusted' = peshgi recovery info; 'job' = ancillary work payment
  work?: JobP['work'];       // on job entries: untying/straightening/helper/other (UI translates)
  workerName?: string;       // on job entries: resolved worker display name
}

export interface RokerDay {
  day: string;
  openingCash: number;
  entries: RokerEntry[];
  cashIn: number;
  cashOut: number;
  upiIn: number;
  upiOut: number;
  closingCash: number;
}

/**
 * D7 rokerDay: opening cash on openingCashDay = settings.openingCashPaise;
 * each later day's opening = previous day's closing (computed iteratively over
 * all days that have records). Cash/UPI out from bazaar payment, peshgi given
 * (by mode), and manual roker entries (dir/mode). Peshgi recovery is NOT a cash
 * entry but is shown as an info entry {kind:'adjusted'}.
 */
export function rokerDay(recs: Rec[], day: string): RokerDay {
  const settings = latestEntities<SettingP>(recs, 'setting')[0];
  const openingCashDay = settings?.openingCashDay ?? day;
  const openingCashPaise = settings?.openingCashPaise ?? 0;

  // All days with activity, from openingCashDay up to the requested day.
  const active = activeRecords(recs);
  const daySet = new Set<string>([openingCashDay, day]);
  for (const r of active) {
    if (r.day >= openingCashDay && r.day <= day) daySet.add(r.day);
  }
  const days = [...daySet].filter((d) => d >= openingCashDay && d <= day).sort();

  let opening = openingCashPaise;
  let result: RokerDay | undefined;
  for (const d of days) {
    const computed = computeDay(recs, d, opening);
    if (d === day) result = computed;
    opening = computed.closingCash;
  }
  // If `day` is before openingCashDay (no iteration hit it), compute standalone.
  return result ?? computeDay(recs, day, openingCashPaise);
}

function computeDay(recs: Rec[], day: string, openingCash: number): RokerDay {
  const entries: RokerEntry[] = [];

  for (const r of recsOfType<BazaarP>(recs, 'bazaar')) {
    if (r.day !== day) continue;
    const b = r.payload;
    if (b.payment.cashPaise > 0) {
      entries.push({ recId: r.id, label: `Bazaar ${b.pieceId}`, dir: 'out', mode: 'cash', amountPaise: b.payment.cashPaise, auto: true });
    }
    if (b.payment.upiPaise > 0) {
      entries.push({ recId: r.id, label: `Bazaar ${b.pieceId}`, dir: 'out', mode: 'upi', amountPaise: b.payment.upiPaise, auto: true });
    }
    if (b.peshgiRecoveredPaise > 0) {
      entries.push({ recId: r.id, label: `Peshgi recovered ${b.pieceId}`, dir: 'in', mode: 'cash', amountPaise: b.peshgiRecoveredPaise, auto: true, kind: 'adjusted' });
    }
  }

  for (const r of recsOfType<PeshgiP>(recs, 'peshgi')) {
    if (r.day !== day) continue;
    const p = r.payload;
    entries.push({ recId: r.id, label: `Peshgi ${p.personKind} ${p.personId}`, dir: 'out', mode: p.mode, amountPaise: p.amountPaise, auto: true });
  }

  for (const r of recsOfType<JobP>(recs, 'job')) {
    if (r.day !== day) continue;
    const j = r.payload;
    const workerName = jobWorkerName(recs, j);
    const label = `${j.work} ${workerName}`;
    if (j.payment.cashPaise > 0) {
      entries.push({ recId: r.id, label, dir: 'out', mode: 'cash', amountPaise: j.payment.cashPaise, auto: true, kind: 'job', work: j.work, workerName });
    }
    if (j.payment.upiPaise > 0) {
      entries.push({ recId: r.id, label, dir: 'out', mode: 'upi', amountPaise: j.payment.upiPaise, auto: true, kind: 'job', work: j.work, workerName });
    }
  }

  for (const r of recsOfType<RokerP>(recs, 'roker')) {
    if (r.day !== day) continue;
    const p = r.payload;
    entries.push({ recId: r.id, label: p.head + (p.note ? `: ${p.note}` : ''), dir: p.dir, mode: p.mode, amountPaise: p.amountPaise, auto: false });
  }

  let cashIn = 0, cashOut = 0, upiIn = 0, upiOut = 0;
  for (const e of entries) {
    if (e.kind === 'adjusted') continue; // info only, no cash movement
    if (e.mode === 'cash') {
      if (e.dir === 'in') cashIn += e.amountPaise;
      else cashOut += e.amountPaise;
    } else {
      if (e.dir === 'in') upiIn += e.amountPaise;
      else upiOut += e.amountPaise;
    }
  }

  const closingCash = openingCash + cashIn - cashOut;
  return { day, openingCash, entries, cashIn, cashOut, upiIn, upiOut, closingCash };
}

/** Display name of a job's worker: weaver/thekedar master name, else free-text workerName. */
function jobWorkerName(recs: Rec[], j: JobP): string {
  if (j.workerKind === 'weaver' && j.workerId) {
    const w = latestEntities<WeaverP>(recs, 'weaver').find((x) => x.entityId === j.workerId);
    if (w) return w.name;
  }
  if (j.workerKind === 'thekedar' && j.workerId) {
    const t = latestEntities<ThekedarP>(recs, 'thekedar').find((x) => x.entityId === j.workerId);
    if (t) return t.name;
  }
  return j.workerName ?? '';
}
