import type { ReactNode } from 'react';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';
import { useT } from '../i18n';

/** Centered card layout for setup + login on every screen size. */
export function AuthShell({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="relative min-h-dvh bg-bg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary-soft to-transparent" aria-hidden="true" />
      <div className="absolute right-4 top-3 z-10 md:right-8 md:top-6"><LanguageSwitch /></div>
      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 pb-10 pt-20 md:max-w-lg">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white shadow-card" aria-hidden="true">बु</div>
          <h1 className="text-4xl">{title ?? t('app.name')}</h1>
          <p className="mt-1 text-muted">{subtitle ?? t('app.tagline')}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
