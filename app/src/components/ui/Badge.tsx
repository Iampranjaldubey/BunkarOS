import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badge = cva(
  'inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-bg text-muted border border-line',
        given: 'bg-madder/10 text-madder',
        received: 'bg-ok/12 text-ok',
        warn: 'bg-saffron/20 text-saffron-ink',
        info: 'bg-indigo/10 text-indigo',
        danger: 'bg-madder text-white',
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
