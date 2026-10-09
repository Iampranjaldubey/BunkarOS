import { useId, type ReactNode } from 'react';
import { Label } from './Input';
import { cn } from '../../lib/utils';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** Render prop receives the ids to wire onto the control. */
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/**
 * Labelled field with optional hint and error. Wires `aria-describedby` and
 * `aria-invalid` onto the control, and announces errors via role="alert".
 */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const base = useId();
  const id = `${base}-ctrl`;
  const hintId = hint ? `${base}-hint` : undefined;
  const errId = error ? `${base}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('mb-4', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-madder" aria-hidden="true"> *</span>}
      </Label>
      {hint && (
        <p id={hintId} className="text-sm text-muted mb-1.5">
          {hint}
        </p>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error && (
        <p id={errId} role="alert" className="mt-1.5 text-sm font-medium text-madder">
          {error}
        </p>
      )}
    </div>
  );
}
