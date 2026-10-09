// Shared helpers for the masters feature areas (looms/weavers/thekedars/orders/rates).
// Lives inside an owned feature folder; siblings import from here.
import { useState, type ReactNode } from 'react';
import { MapPin, Loader2, Check, Clock, Truck, Pause, Circle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Pill } from '../../components/ui';
import type { PieceStatus } from '../../domain/projections';

const PIECE_STATUS_ICON: Record<PieceStatus, LucideIcon> = {
  not_started: Circle,
  on_loom: Clock,
  off_loom: Check,
  delivered: Truck,
  on_hold: Pause,
};

/** Hindi/English piece-status pill with the app's red/green/amber meaning + an icon (not colour alone). */
export function StatusPill({ status, label }: { status: PieceStatus; label: string }) {
  const tone =
    status === 'delivered'
      ? 'received'
      : status === 'off_loom'
        ? 'info'
        : status === 'on_loom'
          ? 'warn'
          : status === 'on_hold'
            ? 'danger'
            : 'neutral';
  const Icon = PIECE_STATUS_ICON[status];
  return (
    <Pill tone={tone} data-status={status}>
      <Icon aria-hidden="true" size={13} strokeWidth={2.5} />
      {label}
    </Pill>
  );
}

/** A labelled section with a heading and spacing, used across detail screens. */
export function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg text-ink">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Thin progress bar for % woven. */
export function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="h-3 w-full overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-indigo transition-[width]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export interface GpsState {
  lat?: number;
  lng?: number;
}

/**
 * Optional GPS capture button using navigator.geolocation with graceful denial.
 * Shows a Hindi message if permission is denied or GPS is unavailable.
 */
export function GpsCapture({
  value,
  onChange,
  labelCapture,
  labelCaptured,
  msgDenied,
  msgUnavailable,
}: {
  value: GpsState;
  onChange: (v: GpsState) => void;
  labelCapture: string;
  labelCaptured: string;
  msgDenied: string;
  msgUnavailable: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const has = value.lat !== undefined && value.lng !== undefined;

  const capture = () => {
    setNote(null);
    if (!('geolocation' in navigator)) {
      setNote(msgUnavailable);
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setBusy(false);
        setNote(msgDenied);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={capture}
        disabled={busy}
        className="tap-48 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 text-base text-indigo focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink disabled:opacity-50"
      >
        {busy ? (
          <Loader2 aria-hidden="true" className="animate-spin" size={20} />
        ) : has ? (
          <Check aria-hidden="true" size={20} className="text-ok" />
        ) : (
          <MapPin aria-hidden="true" size={20} />
        )}
        {has ? labelCaptured : labelCapture}
      </button>
      {has && (
        <p className="num mt-1.5 text-sm text-muted">
          {value.lat!.toFixed(5)}, {value.lng!.toFixed(5)}
        </p>
      )}
      {note && (
        <p role="alert" className="mt-1.5 text-sm font-medium text-saffron-ink">
          {note}
        </p>
      )}
    </div>
  );
}

/** A big tappable list row with an optional leading element and trailing chevron area. */
export function ListRow({
  onClick,
  leading,
  children,
  trailing,
  testId,
}: {
  onClick?: () => void;
  leading?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  testId?: string;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      {...(onClick ? { type: 'button', onClick } : {})}
      data-testid={testId}
      className={
        'flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-card ' +
        (onClick
          ? 'transition-colors hover:bg-bg focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink'
          : '')
      }
    >
      {leading}
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
    </Comp>
  );
}
