import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-2xl font-medium ' +
    'transition-colors select-none disabled:opacity-50 disabled:pointer-events-none ' +
    'focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink ' +
    'focus-visible:outline-offset-2 active:translate-y-px',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-dark shadow-card',
        secondary: 'bg-surface text-ink border border-line hover:bg-bg',
        ghost: 'bg-transparent text-primary hover:bg-primary/10',
        danger: 'bg-given text-white hover:brightness-95 shadow-card',
        success: 'bg-ok text-white hover:brightness-95 shadow-card',
      },
      size: {
        md: 'min-h-12 px-4 text-base',
        lg: 'min-h-14 px-5 text-lg',
        xl: 'min-h-16 px-6 text-xl w-full',
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
