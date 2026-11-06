import { cn } from '../../lib/utils';

/** On / off switch with an accessible name; 44 px tall hit area around a 32 px track. */
export function Switch({ checked, onChange, label, disabled, testid }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; testid?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} data-testid={testid}
      className="group inline-flex min-h-12 min-w-14 shrink-0 items-center justify-center rounded-xl lg:min-h-11 focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink disabled:opacity-50">
      <span aria-hidden="true" className={cn('relative inline-flex h-8 w-14 items-center rounded-[10px] border transition-colors duration-200', checked ? 'border-primary bg-primary' : 'border-line-strong bg-surface-2')}>
        <span className={cn('inline-block h-6 w-6 rounded-[7px] bg-surface transition-transform duration-200 ease-[var(--ease-out)]', checked ? 'translate-x-7' : 'translate-x-0.5')} />
      </span>
    </button>
  );
}
