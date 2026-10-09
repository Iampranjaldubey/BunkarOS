// Bunkar OS — shared transaction helpers (owned by the transactions agent).
import type { ReactNode } from 'react';
import type { Rec, Holder } from '../../db/types';
import { listLooms, listThekedars, listWeavers, getSettings } from '../../domain/projections';
import { translate } from '../../i18n';
import { getLang } from '../../i18n';
import { istDay } from '../../domain/ids';
import { cn } from '../../lib/utils';

/** Today's calendar day in Asia/Kolkata (YYYY-MM-DD). */
export function today(): string {
  return istDay(new Date().toISOString());
}

/** Readable label for a yarn holder, used in confirmations + overview. */
export function holderLabel(recs: Rec[], holder: Holder): string {
  const lang = getLang();
  if (holder.kind === 'loom') {
    const loom = listLooms(recs).find((l) => l.entityId === holder.loomId);
    return translate(lang, 'yarn.holderLoom', { code: loom?.code ?? holder.loomId });
  }
  const th = listThekedars(recs).find((t) => t.entityId === holder.thekedarId);
  return translate(lang, 'yarn.holderThekedar', { name: th?.name ?? holder.thekedarId });
}

export function weaverById(recs: Rec[], id?: string) {
  if (!id) return undefined;
  return listWeavers(recs).find((w) => w.entityId === id);
}

export function thekedarById(recs: Rec[], id?: string) {
  if (!id) return undefined;
  return listThekedars(recs).find((t) => t.entityId === id);
}

/** Photo-required threshold in paise (D4), default ₹2,000. */
export function photoThresholdPaise(recs: Rec[]): number {
  return getSettings(recs)?.photoRequiredAbovePaise ?? 200_000;
}

/** Current wastage percent (D1), default 3. */
export function wastagePct(recs: Rec[]): number {
  return getSettings(recs)?.wastagePct ?? 3;
}

/** A labelled receipt-style row: label on the left, value on the right. */
export function Row({
  label,
  children,
  strong,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-1.5', className)}>
      <span className={cn('text-base', strong ? 'font-semibold text-ink' : 'text-muted')}>{label}</span>
      <span className={cn('num tabular-nums text-right', strong ? 'text-xl font-bold text-ink' : 'text-lg text-ink')}>
        {children}
      </span>
    </div>
  );
}

/** Wizard progress dots. */
export function Stepper({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-4 flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            i < step ? 'bg-indigo' : i === step ? 'bg-saffron-ink' : 'bg-line',
          )}
        />
      ))}
    </div>
  );
}

/**
 * Sticky primary-action bar that sits ABOVE the global bottom nav (which is
 * fixed at bottom-0, ~64px tall). Using `sticky` keeps it in the page flow so
 * it never overlaps the nav, and it stays reachable while scrolling.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-20 z-20 mt-6 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}
