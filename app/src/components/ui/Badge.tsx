import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badge = cva(
  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-bg text-muted border border-line',
        given: 'bg-given/10 text-given',
        received: 'bg-ok/12 text-ok',
        warn: 'bg-accent/20 text-accent-ink',
        info: 'bg-primary/10 text-primary',
        danger: 'bg-given text-white',
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
