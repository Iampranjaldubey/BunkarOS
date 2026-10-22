import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useT } from '../../i18n';

const DISMISS_KEY = 'bunkar.pwaInstallDismissed';

/** The non-standard event fired by Chromium when the app is installable. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Dismissible "Add to home screen" card. Shows only after the browser fires
 * `beforeinstallprompt` (so it never nags on unsupported browsers) and only
 * when the user has not previously dismissed it (stored in localStorage).
 */
export function PwaInstallCard() {
  const { t } = useT();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => {
    if (dismissed) return;
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the event so we can trigger it from our button
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [dismissed]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
    setPromptEvent(null);
  };

  const install = async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      /* ignore */
    }
    // The browser only lets us call prompt() once; hide + remember either way.
    dismiss();
  };

  if (dismissed || !promptEvent) return null;

  return (
    <div
      data-testid="pwa-install"
      className="mb-4 flex items-center gap-3 rounded-2xl border border-indigo/30 bg-indigo/5 p-4 shadow-card"
    >
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo/10 text-indigo">
        <Download size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-ink">{t('pwa.install.title')}</span>
        <span className="block text-sm text-muted">{t('pwa.install.hint')}</span>
      </span>
      <button
        type="button"
        data-testid="pwa-install-add"
        onClick={() => void install()}
        className="min-h-12 shrink-0 rounded-xl bg-indigo px-4 text-base font-medium text-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
      >
        {t('pwa.install.add')}
      </button>
      <button
        type="button"
        data-testid="pwa-install-dismiss"
        aria-label={t('pwa.install.dismiss')}
        onClick={dismiss}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-muted focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
      >
        <X aria-hidden="true" size={20} />
      </button>
    </div>
  );
}
