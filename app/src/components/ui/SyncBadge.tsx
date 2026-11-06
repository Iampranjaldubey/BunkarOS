import { CloudOff, LogIn, RefreshCw } from 'lucide-react';
import { useSyncState, syncNow } from '../../sync/client';
import { useT } from '../../i18n';
import { usePendingCount } from '../../db/hooks';
import { cn } from '../../lib/utils';

const base = 'inline-flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap';

/**
 * Header sync status: offline / sign in / n pending (tap to sync) / synced. SPEC-M17: quiet text with a status dot;
 * only the states that need the user get a tinted ground. The icon spins only while a resync is running (it is live).
 */
export function SyncBadge() {
  const { t } = useT();
  const { online, authState, resyncing } = useSyncState();
  const pending = usePendingCount(); // live: shows a just-saved entry immediately
  if (!online) return <span className={cn(base, 'bg-warn-soft text-warn')} aria-live="polite"><CloudOff aria-hidden="true" size={16} />{t('sync.offline')}</span>;
  if (authState === 'needs_login') return <span className={cn(base, 'bg-warn-soft text-warn')} aria-live="polite"><LogIn aria-hidden="true" size={16} />{t('sync.login')}</span>;
  if (resyncing) return <span className={cn(base, 'text-primary')} aria-live="polite" data-testid="sync-resyncing"><RefreshCw aria-hidden="true" size={16} className="animate-spin" />{t('sync.resyncing')}</span>;
  if (pending > 0) {
    return (
      <button type="button" onClick={() => void syncNow()} aria-label={t('sync.pending', { n: pending })} className="tap-48 inline-flex items-center justify-center rounded-lg">
        <span className={cn(base, 'bg-primary-soft text-primary')} aria-live="polite"><RefreshCw aria-hidden="true" size={16} /><span className="num">{t('sync.pending', { n: pending })}</span></span>
      </button>
    );
  }
  // Phones: the dot alone (room for the unit name); the words stay for screen readers.
  return <span className={cn(base, 'text-ink-2 max-md:px-1.5')} aria-live="polite" title={t('sync.synced')}><span aria-hidden="true" className="h-2 w-2 rounded-[2px] bg-received" /><span className="max-md:sr-only">{t('sync.synced')}</span></span>;
}
