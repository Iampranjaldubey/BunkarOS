import { db } from './db';
import type { Rec, RecordType, ReversalP, Role } from './types';
import { uuid, istDay } from '../domain/ids';
import { getDeviceId, getStoredSession } from '../lib/session-store';

export interface AddRecordOpts {
  photoIds?: string[];
  /** Business day (back-dating). Defaults to today in IST. */
  day?: string;
  /** Id of the record this one replaces (the caller reverses the old one). */
  replaces?: string;
  /** Override author (setup flow before a session exists). */
  as?: { by: string; role: Role | 'system'; unitId: string };
}

function resolveAuthor(opts?: AddRecordOpts) {
  if (opts?.as) return opts.as;
  const session = getStoredSession();
  if (!session) throw new Error('addRecord: no active session');
  return { by: session.userId, role: session.role, unitId: session.unitId };
}

/** Append a record locally with sync:'pending'; the sync client pushes it later. */
export async function addRecord<P>(type: RecordType, payload: P, opts: AddRecordOpts = {}): Promise<Rec<P>> {
  const { by, role, unitId } = resolveAuthor(opts);
  const at = new Date().toISOString();
  const rec: Rec<P> = {
    id: uuid(), type, unitId, payload, by, role,
    device: getDeviceId(), at, day: opts.day ?? istDay(at), sync: 'pending',
    ...(opts.photoIds?.length ? { photoIds: opts.photoIds } : {}),
    ...(opts.replaces ? { replaces: opts.replaces } : {}),
  };
  await db.records.put(rec as Rec);
  return rec;
}

/** Record a correction. Reversed records are ignored by every projection. */
export async function reverse(targetId: string, reason: string): Promise<Rec<ReversalP>> {
  return addRecord<ReversalP>('reversal', { targetId, reason });
}

/**
 * "Edit" an event: reverse the old record and append the new one in its place
 * (same day unless given). The log shows both, with the edit note.
 */
export async function replaceRecord<P>(old: Rec, type: RecordType, payload: P, opts: AddRecordOpts = {}): Promise<Rec<P>> {
  await reverse(old.id, 'edited');
  return addRecord<P>(type, payload, { day: old.day, ...opts, replaces: old.id });
}

export async function allRecords(): Promise<Rec[]> {
  const session = getStoredSession();
  if (!session) return [];
  return db.records.where('unitId').equals(session.unitId).toArray();
}
