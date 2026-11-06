import { useId } from 'react';
import { cn } from '../../lib/utils';
import { knotClass, type KnotState } from './knots';

/**
 * SPEC-M17 carpet pieces, drawn in SVG so they cost no images:
 * - BrandMark: the logo, a concentric knot diamond (a gul) on an indigo tile.
 * - GuardBorder: the signature, a thin knotted band like a rug's minor border.
 */

const GRID = 7;
/** Knot cells of the mark: concentric diamond, madder centre. */
function markCells(): { x: number; y: number; c: 'ivory' | 'madder' }[] {
  const out: { x: number; y: number; c: 'ivory' | 'madder' }[] = [];
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    const d = Math.abs(x - 3) + Math.abs(y - 3);
    if (d === 0) out.push({ x, y, c: 'madder' });
    else if (d === 1 || d === 3) out.push({ x, y, c: 'ivory' });
  }
  return out;
}
const CELLS = markCells();

export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className={cn('shrink-0', className)}>
      <rect width="64" height="64" rx="14" fill="var(--color-dye-indigo)" />
      {CELLS.map(({ x, y, c }) => (
        <rect key={`${x}-${y}`} x={8 + x * 7} y={8 + y * 7} width="6" height="6" rx="1"
          fill={c === 'madder' ? 'var(--color-dye-madder)' : 'var(--color-dye-ivory)'} />
      ))}
    </svg>
  );
}

/** The wordmark: बुनकर in Eczar next to the mark. */
export function Wordmark({ name, sub, className }: { name: string; sub?: string; className?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <BrandMark size={40} />
      <span className="min-w-0">
        <span className="block truncate font-display text-lg font-medium leading-tight text-ink">{name}</span>
        {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
      </span>
    </span>
  );
}

/**
 * Guard border: a repeating knotted band (small diamonds between two hairline guards), the app's one signature detail.
 * Used only in the side menu brand, the login / setup card, the printed slip header and the worker page header.
 */
export function GuardBorder({ className, tone = 'dye' }: { className?: string; tone?: 'dye' | 'ink' }) {
  const id = useId().replace(/:/g, '');
  const a = tone === 'ink' ? '#1f1b16' : 'var(--color-dye-indigo)';
  const b = tone === 'ink' ? '#6a6156' : 'var(--color-dye-madder)';
  const c = tone === 'ink' ? '#6a6156' : 'var(--color-dye-turmeric)';
  return (
    <svg aria-hidden="true" className={cn('block h-2.5 w-full', className)} preserveAspectRatio="none">
      <defs>
        <pattern id={`g${id}`} width="12" height="10" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="12" height="1" fill={a} />
          <rect x="0" y="9" width="12" height="1" fill={a} />
          <path d="M6 2.5 L9 5 L6 7.5 L3 5 Z" fill={b} />
          <rect x="0" y="4.5" width="1" height="1" fill={c} />
          <rect x="11" y="4.5" width="1" height="1" fill={c} />
        </pattern>
      </defs>
      <rect width="100%" height="10" fill={`url(#g${id})`} />
    </svg>
  );
}


/** One knot: a small square for strips (Home register, attendance summary). */
export function Knot({ state, size = 14, title, className }: { state: KnotState; size?: number; title?: string; className?: string }) {
  return <span title={title} aria-hidden="true" className={cn('knot', knotClass(state), className)} style={{ width: size, height: size, borderRadius: Math.max(2, size / 5) }} />;
}
