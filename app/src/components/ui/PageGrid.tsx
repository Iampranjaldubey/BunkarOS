import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface PageGridProps {
  /** Primary column content. */
  main: ReactNode;
  /** Secondary column; stacks below `main` under lg, sits right at lg+. */
  aside?: ReactNode;
  /** When true, the aside sticks under the header while the main scrolls. */
  asideSticky?: boolean;
  className?: string;
}

/**
 * Two-column page layout for lg+ (main 2/3 + aside 1/3); a single stacked
 * column below lg so the phone layout is unchanged. Used by owner home and any
 * screen that wants a summary/alerts rail.
 */
export function PageGrid({ main, aside, asideSticky, className }: PageGridProps) {
  if (!aside) {
    return <div className={className}>{main}</div>;
  }
  return (
    <div className={cn('flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:gap-6', className)}>
      <div data-testid="page-main" className="min-w-0 lg:col-span-2">{main}</div>
      <aside
        data-testid="page-aside"
        className={cn(
          'min-w-0 lg:col-span-1',
          asideSticky && 'lg:sticky lg:top-20 lg:self-start',
        )}
      >
        {aside}
      </aside>
    </div>
  );
}
