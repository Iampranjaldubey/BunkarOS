import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** SPEC-M17: a flat raised surface with a hairline; depth comes from the surface step, not a shadow. */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-2xl border border-line bg-surface p-4 md:p-5', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('mb-3 text-base font-semibold text-ink md:text-lg', className)} {...props} />;
}
