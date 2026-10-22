import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { LangProvider } from './i18n';
import { SessionProvider } from './app/session';
import { ToastProvider } from './components/ui/Toast';
import { router } from './app/router';
import { startAutoSync } from './sync/client';

export default function App() {
  useEffect(() => startAutoSync(), []);
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
