import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}

/** Empty screen that invites the next action. */
export function EmptyState({ icon, title, hint, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center', className)}>
      {icon && <div className="text-muted [&_svg]:stroke-[1.5]" aria-hidden="true">{icon}</div>}
      <p className="text-lg font-medium text-ink">{title}</p>
      {hint && <p className="max-w-sm text-base text-ink-2">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export interface StatTileProps {
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'given' | 'received' | 'info';
  className?: string;
  /** Optional data-testid for tests. */
  testid?: string;
}

/**
 * A ledger cell: label, then the figure. Colour lives in a small marker and in money-out / money-in figures,
 * not on the card's background (SPEC-M17). Use inside <StatRow> for a ruled row of cells.
 */
export function StatTile({ label, value, tone = 'neutral', className, testid }: StatTileProps) {
  const fig = { neutral: 'text-ink', given: 'text-given', received: 'text-received', info: 'text-primary' }[tone];
  return (
    <div data-testid={testid} className={cn('min-w-0 rounded-2xl border border-line bg-surface px-4 py-3 md:px-5 md:py-4', className)}>
      <div className="mb-1 text-sm text-muted">{label}</div>
      <div className={cn('num text-2xl font-medium leading-tight', fig)}>{value}</div>
    </div>
  );
}

/** Ruled row of ledger cells: hairlines between them, one border around (a bahi-khata line). */
export function StatRow({ children, className, testid }: { children: ReactNode; className?: string; testid?: string }) {
  return (
    <div data-testid={testid} className={cn('grid gap-px overflow-hidden rounded-2xl border border-line bg-line [&>*]:rounded-none [&>*]:border-0', className)}>{children}</div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('rounded-2xl bg-surface-2', className)} />;
}
