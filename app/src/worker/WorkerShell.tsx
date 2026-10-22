import type { ReactNode } from 'react';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';

/** Public worker chrome: no app navigation, no login words; language switch only. */
export function WorkerShell({ children, header }: { children: ReactNode; header?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-primary-soft to-transparent" aria-hidden="true" />
      <header className="relative mx-auto flex max-w-md items-start justify-between gap-3 px-4 pt-4 md:max-w-2xl">
        <div className="min-w-0 flex-1">{header}</div>
        <LanguageSwitch />
      </header>
      <main className="relative mx-auto max-w-md px-4 pb-10 pt-4 md:max-w-2xl">{children}</main>
    </div>
  );
}
