import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * SPEC-M17: a figure that rolls to its new value (Home, wage sheet). A small requestAnimationFrame tween that
 * renders real text, so screen readers, copy and tests always read the final formatted value once it settles.
 * (NumberFlow was evaluated and not used: its shadow DOM holds every digit 0–9 per column.)
 */
export function RollingNumber({ value, format, duration = 650, className }: { value: number; format: (n: number) => string; duration?: number; className?: string }) {
  const [still] = useState(reduced);
  const [shown, setShown] = useState(() => (still ? value : 0));
  const from = useRef(shown);
  const raf = useRef(0);
  useEffect(() => {
    if (still) return;
    const start = performance.now(); const a = from.current; const b = value;
    if (a === b) return;
    cancelAnimationFrame(raf.current);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      const v = p >= 1 ? b : a + (b - a) * e;
      from.current = v; setShown(v);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration, still]);
  const isFinal = still || shown === value;
  return <span className={cn('num', className)} aria-hidden={isFinal ? undefined : true}>{format(isFinal ? value : Math.round(shown))}</span>;
}

/** Woven progress: done of total as rows of weft being filled (orders delivered, workers paid). */
export function WovenProgress({ done, total, tone = 'primary', label, className }: { done: number; total: number; tone?: 'primary' | 'received' | 'given' | 'accent'; label: string; className?: string }) {
  const p = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const fill = { primary: 'bg-primary', received: 'bg-received', given: 'bg-given', accent: 'bg-accent' }[tone];
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}
      className={cn('relative h-2 w-full overflow-hidden rounded-[3px] bg-surface-2', className)}>
      <div className={cn('weft absolute inset-0 transition-[clip-path] duration-500 ease-[var(--ease-out)]', fill)}
        style={{ clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }} />
    </div>
  );
}
