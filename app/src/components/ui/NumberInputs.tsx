import { useState, useEffect, useId } from 'react';
import { Input } from './Input';
import { cn } from '../../lib/utils';

export interface KgInputProps {
  /** Weight in grams (integer). */
  value: number;
  onChange: (grams: number) => void;
  describedBy?: string;
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Enter a weight in kilograms (3 dp); stores grams internally. */
export function KgInput({ value, onChange, describedBy, invalid, className, ...rest }: KgInputProps) {
  const id = useId();
  const [text, setText] = useState(() => (value ? (value / 1000).toFixed(3) : ''));

  // Keep text in sync when the parent resets the value.
  useEffect(() => {
    const asGrams = Math.round(parseFloat(text || '0') * 1000);
    if (asGrams !== value) setText(value ? (value / 1000).toFixed(3) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={0.001}
        value={text}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setText(e.target.value);
          const g = Math.round(parseFloat(e.target.value || '0') * 1000);
          onChange(Number.isFinite(g) ? g : 0);
        }}
        className="pr-14 text-right"
        {...rest}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base text-muted">
        kg
      </span>
    </div>
  );
}

export interface MoneyInputProps {
  /** Amount in paise (integer). */
  value: number;
  onChange: (paise: number) => void;
  /** Allow entering paise (2 dp). Defaults to whole rupees. */
  allowPaise?: boolean;
  describedBy?: string;
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Enter an amount in rupees (paise optional); stores paise internally. */
export function MoneyInput({
  value,
  onChange,
  allowPaise = false,
  describedBy,
  invalid,
  className,
  ...rest
}: MoneyInputProps) {
  const id = useId();
  const toText = (paise: number) =>
    paise ? (allowPaise ? (paise / 100).toFixed(2) : String(Math.round(paise / 100))) : '';
  const [text, setText] = useState(() => toText(value));

  useEffect(() => {
    const asPaise = Math.round(parseFloat(text || '0') * 100);
    if (asPaise !== value) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted">
        ₹
      </span>
      <Input
        id={id}
        type="number"
        inputMode={allowPaise ? 'decimal' : 'numeric'}
        min={0}
        step={allowPaise ? 0.01 : 1}
        value={text}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setText(e.target.value);
          const p = Math.round(parseFloat(e.target.value || '0') * 100);
          onChange(Number.isFinite(p) ? p : 0);
        }}
        className="pl-9 text-right"
        {...rest}
      />
    </div>
  );
}
