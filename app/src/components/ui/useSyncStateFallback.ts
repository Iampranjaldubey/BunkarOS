import { useEffect, useState } from 'react';
import { usePendingCount } from '../../db/hooks';

export interface SyncStateView {
  pending: number;
  online: boolean;
  lastSyncAt: number | null;
  error: string | null;
}

/**
 * Local sync-state fallback until the server agent's `useSyncState` lands in
 * src/sync. Reports the pending queue size + browser online status so the
 * SyncBadge is meaningful offline. When src/sync exists, SyncBadge can be
 * repointed to it without touching the badge markup.
 */
export function useSyncStateFallback(): SyncStateView {
  const pending = usePendingCount();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return { pending, online, lastSyncAt: null, error: null };
}
