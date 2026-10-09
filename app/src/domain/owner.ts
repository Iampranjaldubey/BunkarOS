// Bunkar OS — owner-home projections (K2 / SPEC-017). Pure, integer paise.
import type { Rec, CheckinP, PieceAssignP } from '../db/types.ts';
import { listLooms, listPieces, listWeavers, listThekedars, listUsers } from './pieces.ts';
import { peshgiBalance } from './peshgi.ts';
import { activeRecords, recsOfType } from './records.ts';
import { istDay, daysBetween } from './ids.ts';

// ---------------------------------------------------------------------------
// loomsFreeSoon — estimate which looms free up within `withinDays`.
// ---------------------------------------------------------------------------

export interface FreeSoonRow {
  loomId: string;
  code: string;
  pieceId: string;
  freeDay: string;   // YYYY-MM-DD
  daysLeft: number;  // whole days from today to freeDay
  estimate: true;
}

/** Add `n` whole days to a YYYY-MM-DD day (UTC-safe). */
function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T00:00:00Z`) + n * 24 * 60 * 60 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * SPEC-017: looms whose on_loom piece is projected to finish within
 * `withinDays`, sorted by freeDay ascending.
 *   pace     = wovenIn / max(1, days since assignment)
 *   remaining = order.lengthIn − wovenIn
 *   freeDay   = last check-in day + ceil(remaining / pace)
 * Looms with pace 0 (no measurable progress) are skipped.
 */
export function loomsFreeSoon(recs: Rec[], nowISO: string, withinDays = 30): FreeSoonRow[] {
  const today = istDay(nowISO);
  const looms = listLooms(recs);
  const pieces = listPieces(recs);
  const checkins = recsOfType<CheckinP>(recs, 'checkin');
  const assigns = recsOfType<PieceAssignP>(recs, 'piece_assign');

  const rows: FreeSoonRow[] = [];

  for (const loom of looms) {
    const piece = pieces.find((p) => p.loomId === loom.entityId && p.status === 'on_loom');
    if (!piece) continue;

    // assignment day (latest for this piece)
    let assignDay: string | undefined;
    for (const r of assigns) {
      if (r.payload.pieceId === piece.pieceId) {
        if (assignDay === undefined || r.day > assignDay) assignDay = r.day;
      }
    }
    if (assignDay === undefined) continue;

    // last check-in day with any progress
    let lastCheckinDay: string | undefined;
    for (const r of checkins) {
      if (r.payload.pieceId === piece.pieceId && r.payload.wovenIn > 0) {
        if (lastCheckinDay === undefined || r.day > lastCheckinDay) lastCheckinDay = r.day;
      }
    }
    const anchorDay = lastCheckinDay ?? assignDay;

    const daysSinceAssign = Math.max(1, daysBetween(assignDay, today));
    const pace = piece.wovenIn / daysSinceAssign; // inches/day
    if (pace <= 0) continue;

    const remaining = Math.max(0, piece.lengthIn - piece.wovenIn);
    const daysToFinish = Math.ceil(remaining / pace);
    const estimatedDay = addDays(anchorDay, daysToFinish);
    // If the estimate has already elapsed (e.g. last check-in was long ago), the loom is
    // due now: clamp to today so the owner never sees a negative "free in N days".
    const freeDay = estimatedDay < today ? today : estimatedDay;
    const daysLeft = daysBetween(today, freeDay); // always >= 0
    if (daysLeft > withinDays) continue;

    rows.push({
      loomId: loom.entityId,
      code: loom.code,
      pieceId: piece.pieceId,
      freeDay,
      daysLeft,
      estimate: true,
    });
  }

  rows.sort((a, b) => (a.freeDay === b.freeDay ? a.code.localeCompare(b.code) : a.freeDay.localeCompare(b.freeDay)));
  return rows;
}

// ---------------------------------------------------------------------------
// peshgiOutstanding — total advances still owed, with per-person balances.
// ---------------------------------------------------------------------------

export interface OutstandingPerson {
  kind: 'weaver' | 'thekedar';
  id: string;
  name: string;
  balancePaise: number;
}

export interface PeshgiOutstanding {
  totalPaise: number;
  people: OutstandingPerson[];
}

/** SPEC-017: sum of positive peshgi balances across weavers + thekedars. */
export function peshgiOutstanding(recs: Rec[]): PeshgiOutstanding {
  const people: OutstandingPerson[] = [];

  for (const w of listWeavers(recs)) {
    const bal = peshgiBalance(recs, 'weaver', w.entityId);
    if (bal > 0) people.push({ kind: 'weaver', id: w.entityId, name: w.name, balancePaise: bal });
  }
  for (const th of listThekedars(recs)) {
    const bal = peshgiBalance(recs, 'thekedar', th.entityId);
    if (bal > 0) people.push({ kind: 'thekedar', id: th.entityId, name: th.name, balancePaise: bal });
  }

  people.sort((a, b) => b.balancePaise - a.balancePaise || a.name.localeCompare(b.name));
  const totalPaise = people.reduce((s, p) => s + p.balancePaise, 0);
  return { totalPaise, people };
}

// ---------------------------------------------------------------------------
// todayEntriesByUser — who logged how many entries today.
// ---------------------------------------------------------------------------

export interface StaffEntryCount {
  userId: string;
  name: string;
  role: string;
  count: number;
}

/**
 * SPEC-017: non-reversed records authored on `day`, grouped by author,
 * excluding roles 'weaver' and 'system'. Sorted by count desc then name.
 */
export function todayEntriesByUser(recs: Rec[], day: string): StaffEntryCount[] {
  const nameOf = new Map(listUsers(recs).map((u) => [u.entityId, u.name]));
  const counts = new Map<string, StaffEntryCount>();

  for (const r of activeRecords(recs)) {
    if (r.day !== day) continue;
    if (r.role === 'weaver' || r.role === 'system') continue;
    const existing = counts.get(r.by);
    if (existing) existing.count += 1;
    else counts.set(r.by, { userId: r.by, name: nameOf.get(r.by) ?? r.by, role: r.role, count: 1 });
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
