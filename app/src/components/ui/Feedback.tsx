import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}

/** Friendly empty screen that invites the next action. */
export function EmptyState({ icon, title, hint, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      {icon && <div className="text-muted" aria-hidden="true">{icon}</div>}
      <p className="text-xl text-ink">{title}</p>
      {hint && <p className="max-w-xs text-base text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export interface StatTileProps {
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'given' | 'received' | 'info';
  className?: string;
}

const toneCls = {
  neutral: 'bg-surface border-line',
  given: 'bg-madder/5 border-madder/20',
  received: 'bg-ok/5 border-ok/20',
  info: 'bg-indigo/5 border-indigo/20',
};

/** Compact labelled statistic for home/digest grids. */
export function StatTile({ label, value, tone = 'neutral', className }: StatTileProps) {
  return (
    <div className={cn('rounded-2xl border p-4 shadow-card', toneCls[tone], className)}>
      <div className="num text-2xl font-bold text-ink">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-2xl bg-line/60', className)}
    />
  );
}
