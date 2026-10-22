import { Check, CloudOff, LogIn, RefreshCw } from 'lucide-react';
import { Badge } from './Badge';
import { useSyncState, syncNow } from '../../sync/client';
import { useT } from '../../i18n';
import { usePendingCount } from '../../db/hooks';

/** Header sync status: offline / sign in / n pending (tap to sync) / synced. */
export function SyncBadge() {
  const { t } = useT();
  const { online, authState } = useSyncState();
  const pending = usePendingCount(); // live: shows a just-saved entry immediately
  if (!online) return <Badge tone="warn" aria-live="polite"><CloudOff aria-hidden="true" size={16} />{t('sync.offline')}</Badge>;
  if (authState === 'needs_login') return <Badge tone="warn" aria-live="polite"><LogIn aria-hidden="true" size={16} />{t('sync.login')}</Badge>;
  if (pending > 0) {
    return (
      <button type="button" onClick={() => void syncNow()} aria-label={t('sync.pending', { n: pending })} className="tap-48 inline-flex items-center justify-center rounded-full">
        <Badge tone="info" aria-live="polite"><RefreshCw aria-hidden="true" size={16} /><span className="num">{t('sync.pending', { n: pending })}</span></Badge>
      </button>
    );
  }
  return <Badge tone="received" aria-live="polite"><Check aria-hidden="true" size={16} />{t('sync.synced')}</Badge>;
}
