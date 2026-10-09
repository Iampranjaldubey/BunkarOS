import { db } from './db';
import type { Rec, RecordType, ReversalP, Role } from './types';
import { uuid, istDay } from '../domain/ids';
import { getDeviceId, getStoredSession } from '../lib/session-store';

export interface AddRecordOpts {
  photoIds?: string[];
  /** Override author/role/unit (used by the setup flow before a session exists). */
  as?: { by: string; role: Role | 'system'; unitId: string };
}

function resolveAuthor(opts?: AddRecordOpts): { by: string; role: Role | 'system'; unitId: string } {
  if (opts?.as) return opts.as;
  const session = getStoredSession();
  if (!session) {
    throw new Error('addRecord: no active session');
  }
  return { by: session.userId, role: session.role, unitId: session.unitId };
}

/**
 * Append a new record to the local store with `sync: 'pending'`.
 * Fills id/unitId/by/role/device/at/day from the current session. The sync
 * client (server agent) later pushes pending records and updates bookkeeping.
 */
export async function addRecord<P>(
  type: RecordType,
  payload: P,
  opts: AddRecordOpts = {},
): Promise<Rec<P>> {
  const { by, role, unitId } = resolveAuthor(opts);
  const at = new Date().toISOString();
  const rec: Rec<P> = {
    id: uuid(),
    type,
    unitId,
    payload,
    by,
    role,
    device: getDeviceId(),
    at,
    day: istDay(at),
    sync: 'pending',
    ...(opts.photoIds && opts.photoIds.length ? { photoIds: opts.photoIds } : {}),
  };
  await db.records.put(rec as Rec);
  return rec;
}

/**
 * Record a correction. Reversed records are ignored by all projections.
 * Permission enforcement (own-today vs any) lives in the domain `can` /
 * feature screens; this just appends the reversal event.
 */
export async function reverse(targetId: string, reason: string): Promise<Rec<ReversalP>> {
  return addRecord<ReversalP>('reversal', { targetId, reason });
}

/** All records for the active unit (unsorted). */
export async function allRecords(): Promise<Rec[]> {
  const session = getStoredSession();
  if (!session) return [];
  return db.records.where('unitId').equals(session.unitId).toArray();
}
