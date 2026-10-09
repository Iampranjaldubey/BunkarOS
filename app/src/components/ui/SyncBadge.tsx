import { Check, CloudOff, LogIn, RefreshCw } from 'lucide-react';
import { Badge } from './Badge';
import { useSyncState, syncNow } from '../../sync/client';
import { useT } from '../../i18n';

/**
 * Compact sync status for the app header.
 * - offline → "ऑफलाइन"
 * - needs_login → "लॉगिन करें" (server wants a fresh per-user token)
 * - pending > 0 → "{n} बाकी"
 * - else → "सिंक हो गया"
 */
export function SyncBadge() {
  const { t, lang } = useT();
  const { pending, online, authState } = useSyncState();

  if (!online) {
    return (
      <Badge tone="warn" aria-live="polite">
        <CloudOff aria-hidden="true" size={16} />
        {t('sync.offline')}
      </Badge>
    );
  }
  if (authState === 'needs_login') {
    // Online but the server wants a fresh per-user login (offline login earlier
    // or a 401). Inline label keeps this change self-contained (no i18n edits).
    const label = lang === 'en' ? 'Sign in' : 'लॉगिन करें';
    return (
      <Badge tone="warn" aria-live="polite">
        <LogIn aria-hidden="true" size={16} />
        {label}
      </Badge>
    );
  }
  if (pending > 0) {
    return (
      <button type="button" onClick={() => void syncNow()} aria-label={t('sync.pending', { n: pending })} className="tap-48 inline-flex items-center justify-center rounded-full">
        <Badge tone="info" aria-live="polite">
          <RefreshCw aria-hidden="true" size={16} />
          <span className="num">{t('sync.pending', { n: pending })}</span>
        </Badge>
      </button>
    );
  }
  return (
    <Badge tone="received" aria-live="polite">
      <Check aria-hidden="true" size={16} />
      {t('sync.synced')}
    </Badge>
  );
}
