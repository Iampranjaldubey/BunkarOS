import { Field } from './Field';
import { Input } from './Input';
import { useT } from '../../i18n';
import { todayIST } from '../../domain/ids';

export interface DateFieldProps {
  value: string;
  onChange: (day: string) => void;
  label?: string;
  error?: string;
  /** Latest selectable day (defaults to today). */
  max?: string;
  min?: string;
  className?: string;
}

/** Business-day picker used on every entry screen (back-dating allowed up to today). */
export function DateField({ value, onChange, label, error, max, min, className }: DateFieldProps) {
  const { t } = useT();
  return (
    <Field label={label ?? t('common.date')} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <Input id={id} type="date" value={value} max={max ?? todayIST()} min={min} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} className="num" />
      )}
    </Field>
  );
}
