// Bunkar OS — peshgi (advance) ledger (C5, D7). Pure. Money in integer paise.
import type { Rec, PeshgiP, BazaarP } from '../db/types.ts';
import { recsOfType } from './records.ts';

export interface PeshgiLedgerEntry {
  recId: string;
  day: string;
  at: string;
  kind: 'given' | 'recovered';
  amountPaise: number; // positive magnitude
  mode?: 'cash' | 'upi'; // present for 'given'
  note?: string;
  balanceAfterPaise: number;
}

/**
 * Current outstanding peshgi balance for a person.
 * balance = sum(given) - sum(recovered via bazaar.peshgiRecoveredPaise).
 */
export function peshgiBalance(
  recs: Rec[],
  personKind: 'weaver' | 'thekedar',
  personId: string,
): number {
  let balance = 0;
  for (const e of peshgiLedger(recs, personKind, personId)) {
    balance = e.balanceAfterPaise;
  }
  return balance;
}

/**
 * Chronological peshgi ledger for a person: gives (peshgi records) and
 * recoveries (netted from bazaar wage, D7). Sorted by (day, at).
 * For weavers, recoveries come from bazaar.peshgiRecoveredPaise where
 * bazaar.weaverId === personId. Thekedar recoveries are not modelled on bazaar,
 * so only gives appear for thekedars.
 */
export function peshgiLedger(
  recs: Rec[],
  personKind: 'weaver' | 'thekedar',
  personId: string,
): PeshgiLedgerEntry[] {
  type Row = Omit<PeshgiLedgerEntry, 'balanceAfterPaise'>;
  const rows: Row[] = [];

  for (const r of recsOfType<PeshgiP>(recs, 'peshgi')) {
    const p = r.payload;
    if (p.personKind === personKind && p.personId === personId) {
      rows.push({
        recId: r.id,
        day: r.day,
        at: r.at,
        kind: 'given',
        amountPaise: p.amountPaise,
        mode: p.mode,
        note: p.note,
      });
    }
  }

  if (personKind === 'weaver') {
    for (const r of recsOfType<BazaarP>(recs, 'bazaar')) {
      const b = r.payload;
      if (b.weaverId === personId && b.peshgiRecoveredPaise > 0) {
        rows.push({
          recId: r.id,
          day: r.day,
          at: r.at,
          kind: 'recovered',
          amountPaise: b.peshgiRecoveredPaise,
        });
      }
    }
  }

  rows.sort((a, b) => (a.day === b.day ? a.at.localeCompare(b.at) : a.day.localeCompare(b.day)));

  let balance = 0;
  return rows.map((row) => {
    balance += row.kind === 'given' ? row.amountPaise : -row.amountPaise;
    return { ...row, balanceAfterPaise: balance };
  });
}
