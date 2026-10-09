// Test helpers — build Rec<P> objects with sensible defaults. Not shipped.
import type { Rec, RecordType, SyncState, Role } from '../db/types.ts';

let seq = 0;

export function rec<P>(
  type: RecordType,
  payload: P,
  opts?: Partial<Pick<Rec, 'id' | 'day' | 'at' | 'sync' | 'by' | 'role' | 'unitId' | 'rejectReason'>>,
): Rec<P> {
  seq += 1;
  const day = opts?.day ?? '2026-10-09';
  return {
    id: opts?.id ?? `rec-${seq}`,
    type,
    unitId: opts?.unitId ?? 'unit-1',
    payload,
    by: opts?.by ?? 'user-owner',
    role: (opts?.role as Role) ?? 'owner',
    device: 'dev-1',
    at: opts?.at ?? `${day}T10:00:0${seq % 10}.000Z`,
    day,
    sync: (opts?.sync as SyncState) ?? 'synced',
    rejectReason: opts?.rejectReason,
  };
}

export function resetSeq(): void {
  seq = 0;
}
