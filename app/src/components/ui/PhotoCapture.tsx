import { useRef, useState, useId } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import { savePhoto, photoUrl } from '../../db/photos';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

export interface PhotoCaptureProps {
  /** Current stored photo id (controlled). */
  value?: string;
  onChange: (photoId: string | undefined) => void;
  required?: boolean;
  label?: string;
  error?: string;
  className?: string;
}

/**
 * Capture a photo from the device camera, compress + store it, and surface the
 * resulting photo id. Shows a thumbnail once captured. Mandatory variant marks
 * itself invalid and announces the error.
 */
export function PhotoCapture({
  value,
  onChange,
  required,
  label,
  error,
  className,
}: PhotoCaptureProps) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const base = useId();
  const errId = error ? `${base}-err` : undefined;

  const pick = () => inputRef.current?.click();

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const id = await savePhoto(file);
      const url = await photoUrl(id);
      setThumb(url);
      onChange(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('mb-4', className)}>
      <span className="block text-base font-medium text-ink mb-1.5">
        {label ?? t('photo.capture')}
        {required && <span className="text-given" aria-hidden="true"> *</span>}
      </span>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only visually-hidden"
        aria-describedby={errId}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />

      {thumb || value ? (
        <div className="flex items-center gap-3">
          {thumb && (
            <img
              src={thumb}
              alt={t('photo.capture')}
              className="h-20 w-20 rounded-2xl border border-line object-cover"
            />
          )}
          <button
            type="button"
            onClick={pick}
            disabled={busy}
            className="tap-48 inline-flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-base text-primary focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink"
          >
            <RefreshCw aria-hidden="true" size={20} />
            {t('photo.retake')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={errId}
          className={cn(
            'flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-bg text-muted',
            'focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink',
            error ? 'border-given text-given' : 'border-line',
          )}
        >
          <Camera aria-hidden="true" size={28} />
          <span className="text-base">{busy ? t('common.loading') : t('photo.capture')}</span>
        </button>
      )}

      {error && (
        <p id={errId} role="alert" className="mt-1.5 text-sm font-medium text-given">
          {error}
        </p>
      )}
    </div>
  );
}
