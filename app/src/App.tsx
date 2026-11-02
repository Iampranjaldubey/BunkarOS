import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { LangProvider } from './i18n';
import { SessionProvider } from './app/session';
import { ToastProvider } from './components/ui/Toast';
import { router } from './app/router';
import { startAutoSync, scrubPinHashes } from './sync/client';

export default function App() {
  useEffect(() => {
    let stop: (() => void) | undefined; let cancelled = false;
    // SPEC-M11: drop PIN hashes an older build pulled onto this phone, then start syncing.
    void scrubPinHashes().catch(() => 0).finally(() => { if (!cancelled) stop = startAutoSync(); });
    return () => { cancelled = true; stop?.(); };
  }, []);
  return (
    <LangProvider>
      <SessionProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SessionProvider>
    </LangProvider>
  );
}
