import { useId } from 'react';
import { Input } from './Input';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

export interface FtInInputProps {
  /** Total length in inches (may be fractional). */
  value: number;
  onChange: (inches: number) => void;
  describedBy?: string;
  invalid?: boolean;
  className?: string;
}

/** Two boxes: feet + inches. Emits total inches. */
export function FtInInput({ value, onChange, describedBy, invalid, className }: FtInInputProps) {
  const base = useId();
  const { t } = useT();
  const ft = Math.floor(value / 12);
  const inch = Math.round((value - ft * 12) * 100) / 100;

  const update = (nextFt: number, nextIn: number) => {
    const f = Number.isFinite(nextFt) ? nextFt : 0;
    const i = Number.isFinite(nextIn) ? nextIn : 0;
    onChange(f * 12 + i);
  };

  return (
    <div className={cn('flex gap-3', className)}>
      <div className="flex-1">
        <Input
          id={`${base}-ft`}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={ft || ''}
          aria-label={t('common.ft')}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(e) => update(Number(e.target.value), inch)}
          className="text-center"
        />
        <span className="mt-1 block text-center text-sm text-muted">{t('common.ft')}</span>
      </div>
      <div className="flex-1">
        <Input
          id={`${base}-in`}
          type="number"
          inputMode="numeric"
          min={0}
          max={11.99}
          step={0.25}
          value={inch || ''}
          aria-label={t('common.in')}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(e) => update(ft, Number(e.target.value))}
          className="text-center"
        />
        <span className="mt-1 block text-center text-sm text-muted">{t('common.in')}</span>
      </div>
    </div>
  );
}
