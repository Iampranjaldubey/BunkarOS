import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Rec } from './types';
import { getStoredSession } from '../lib/session-store';

// Re-export the session hook so callers can import everything db-related from
// one place, per the architecture contract. The provider lives in app/session.
export { useSession } from '../app/session';

/**
 * Live list of all records for the active unit, sorted by `at` ascending.
 * Re-renders whenever the local store changes (offline writes + sync).
 */
export function useRecords(): Rec[] {
  const recs = useLiveQuery(async () => {
    const session = getStoredSession();
    if (!session) return [];
    const rows = await db.records.where('unitId').equals(session.unitId).toArray();
    rows.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    return rows;
  }, []);
  return recs ?? [];
}

/** Count of records + photos still waiting to sync (for the SyncBadge). */
export function usePendingCount(): number {
  const count = useLiveQuery(async () => {
    const [recs, photos] = await Promise.all([
      db.records.where('sync').equals('pending').count(),
      db.photos.where('sync').equals('pending').count(),
    ]);
    return recs + photos;
  }, []);
  return count ?? 0;
}
