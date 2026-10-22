import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn('block text-base font-medium text-ink mb-1.5', className)} {...props} />
  ),
);
Label.displayName = 'Label';

const fieldBase =
  'w-full min-h-14 rounded-2xl border border-line bg-surface px-4 py-2.5 text-lg text-ink md:min-h-12 ' +
  'placeholder:text-muted focus-visible:outline focus-visible:outline-3 ' +
  'focus-visible:outline-accent-ink focus-visible:outline-offset-1 ' +
  'aria-[invalid=true]:border-given';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} rows={3} className={cn(fieldBase, 'min-h-24 resize-y', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(fieldBase, 'appearance-none bg-no-repeat pr-10', className)} {...props} />
  ),
);
Select.displayName = 'Select';
