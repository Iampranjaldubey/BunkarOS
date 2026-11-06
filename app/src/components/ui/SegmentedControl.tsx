import { cn } from '../../lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

/**
 * A compact single-choice control (e.g. cash/upi, create/join). Equal columns so the selected surface
 * slides between them with a transform (SPEC-M17), no layout animation.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, label, className }: SegmentedControlProps<T>) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="radiogroup" aria-label={label}
      className={cn('relative inline-grid rounded-xl border border-line bg-surface-2 p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span aria-hidden="true" className="absolute inset-y-1 left-1 rounded-lg border border-line bg-surface transition-transform duration-200 ease-[var(--ease-out)]"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${idx * 100}%)` }} />
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button key={opt.value} type="button" role="radio" aria-checked={selected} onClick={() => onChange(opt.value)}
            className={cn(
              'relative min-h-12 min-w-12 rounded-lg px-4 text-base font-medium transition-colors',
              'focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink',
              selected ? 'text-ink' : 'text-muted hover:text-ink',
            )}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
