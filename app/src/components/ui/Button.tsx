import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/**
 * SPEC-M17: one filled primary (indigo), quiet secondary (raised surface + hairline), ghost text action.
 * Danger / success fills are for the one confirming action of a flow (pay, give out), never side by side.
 * Press = a tiny scale down; hover = a colour step.
 */
const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap ' +
    'transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)] select-none ' +
    'disabled:opacity-50 disabled:pointer-events-none ' +
    'focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink ' +
    'focus-visible:outline-offset-2 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-fill hover:bg-primary-dark',
        secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2',
        ghost: 'bg-transparent text-primary hover:bg-primary-soft',
        danger: 'bg-given text-on-fill hover:brightness-95',
        success: 'bg-ok text-on-fill hover:brightness-95',
      },
      size: {
        md: 'min-h-12 px-4 text-base',
        lg: 'min-h-14 px-5 text-lg',
        xl: 'min-h-14 px-6 text-lg w-full',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: { variant: 'primary', size: 'lg', block: false },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(button({ variant, size, block }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
