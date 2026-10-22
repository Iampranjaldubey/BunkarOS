import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** Save-button row that stays visible above the bottom bar on phones; inline on desktop. */
export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      'sticky bottom-[4.5rem] z-20 -mx-4 -mb-4 mt-4 flex flex-col gap-2 rounded-b-2xl border-t border-line bg-surface/95 px-4 py-3 backdrop-blur',
      'md:flex-row lg:static lg:mx-0 lg:mb-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none',
      className,
    )}>{children}</div>
  );
}
