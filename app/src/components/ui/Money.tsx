import { cn, formatINR } from '../../lib/utils';

export type MoneyFlow = 'given' | 'received' | 'neutral';

export interface MoneyProps {
  /** Amount in paise (integer). */
  paise: number;
  /** Colour meaning: given = red, received = green. */
  flow?: MoneyFlow;
  /** Show two decimal places. */
  withPaise?: boolean;
  /** Prefix a +/- sign based on flow. */
  signed?: boolean;
  size?: 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeCls: Record<NonNullable<MoneyProps['size']>, string> = {
  md: 'text-xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
};

const flowCls: Record<MoneyFlow, string> = {
  given: 'text-given',
  received: 'text-ok',
  neutral: 'text-ink',
};

/** Big formatted INR amount with given/received colouring. */
export function Money({
  paise,
  flow = 'neutral',
  withPaise = false,
  signed = false,
  size = 'lg',
  className,
}: MoneyProps) {
  const sign = signed && flow === 'given' ? '−' : signed && flow === 'received' ? '+' : '';
  return (
    <span className={cn('num font-bold tracking-tight', sizeCls[size], flowCls[flow], className)}>
      {sign}
      {formatINR(Math.abs(paise), { paise: withPaise })}
    </span>
  );
}

export interface BigNumberProps {
  value: string | number;
  unit?: string;
  label?: string;
  className?: string;
}

/** Large tabular number with an optional unit + small label. */
export function BigNumber({ value, unit, label, className }: BigNumberProps) {
  return (
    <span className={cn('inline-flex flex-col', className)}>
      <span className="num text-3xl font-bold tracking-tight text-ink">
        {value}
        {unit && <span className="ml-1 text-xl font-medium text-muted">{unit}</span>}
      </span>
      {label && <span className="text-sm text-muted">{label}</span>}
    </span>
  );
}
