import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface FormGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * Two-column field grid at lg+ (single column below). Children may add
 * `lg:col-span-2` to span the full width (e.g. a wide notes field, photo
 * capture, or the submit button row). Below lg this is a plain vertical stack,
 * identical to the phone forms.
 */
export function FormGrid({ children, className }: FormGridProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2', className)}>
      {children}
    </div>
  );
}
