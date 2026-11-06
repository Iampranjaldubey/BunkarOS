import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn('mb-1.5 block text-base font-medium text-ink', className)} {...props} />
  ),
);
Label.displayName = 'Label';

const fieldBase =
  'w-full min-h-14 rounded-xl border border-line-strong bg-surface px-4 py-2 text-lg text-ink md:min-h-12 md:text-base ' +
  'transition-[border-color,background-color] duration-150 hover:border-muted ' +
  'placeholder:text-muted focus-visible:border-primary focus-visible:outline focus-visible:outline-3 ' +
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

/** Native select with a drawn chevron (keeps the phone's own picker). */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref}
      className={cn(fieldBase, 'appearance-none bg-no-repeat pr-10 bg-[length:16px] bg-[position:right_14px_center]', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236a6156' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...props} />
  ),
);
Select.displayName = 'Select';
