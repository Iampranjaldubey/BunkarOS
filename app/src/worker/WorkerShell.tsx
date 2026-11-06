import type { ReactNode } from 'react';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';
import { Signature } from '../industries/ui';

/** Public worker chrome: no app navigation, no login words; language switch only. The guard border runs under the header (SPEC-M17). */
export function WorkerShell({ children, header, industry }: { children: ReactNode; header?: ReactNode; industry?: string }) {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="border-b border-line bg-surface">
        <header className="mx-auto flex max-w-md items-start justify-between gap-3 px-4 pb-4 pt-4 md:max-w-2xl">
          <div className="min-w-0 flex-1">{header}</div>
          <LanguageSwitch />
        </header>
        <Signature industry={industry} />
      </div>
      <main className="rise-in mx-auto max-w-md px-4 pb-10 pt-4 md:max-w-2xl">{children}</main>
    </div>
  );
}
