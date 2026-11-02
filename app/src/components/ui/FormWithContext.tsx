import type { ReactNode } from 'react';
import { useIsDesktop } from './useIsDesktop';

/**
 * Entry form + context panel (SPEC-M12). Below lg: the form alone at its usual narrow width (phone markup
 * unchanged). At lg+: the form keeps a readable width and the context sits on the right, sticky under the header.
 */
export function FormWithContext({ children, context }: { children: ReactNode; context: ReactNode }) {
  const desktop = useIsDesktop();
  if (!desktop) return <section className="mx-auto max-w-2xl">{children}</section>;
  return (
    <section className="mx-auto grid max-w-[68rem] grid-cols-[minmax(0,1fr)_22rem] items-start gap-6">
      <div className="min-w-0">{children}</div>
      <aside className="sticky top-20 mt-16" data-testid="form-context" aria-live="polite">{context}</aside>
    </section>
  );
}
