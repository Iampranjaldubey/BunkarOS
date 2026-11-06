import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/**
 * SPEC-M17: a tag, not a pill. Small radius, a tinted ground only for states that need attention,
 * a coloured dot for the rest. `danger` is the one filled tag (a problem that blocks work).
 */
const badge = cva(
  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-medium leading-6 whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-2 text-ink-2',
        given: 'bg-given-soft text-given',
        received: 'bg-received-soft text-received',
        warn: 'bg-accent-soft text-accent-ink',
        info: 'bg-primary-soft text-primary',
        danger: 'bg-given text-on-fill',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

export { Badge as Pill };

/** A status dot with its label in the secondary text colour: for lists where colour + word is enough. */
export function Dot({ tone = 'neutral', className, children }: { tone?: 'neutral' | 'given' | 'received' | 'warn' | 'info'; className?: string; children?: React.ReactNode }) {
  const c = { neutral: 'bg-line-strong', given: 'bg-given', received: 'bg-received', warn: 'bg-accent', info: 'bg-primary' }[tone];
  return <span className={cn('inline-flex items-center gap-1.5 text-sm text-ink-2', className)}><span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-[2px]', c)} />{children}</span>;
}
