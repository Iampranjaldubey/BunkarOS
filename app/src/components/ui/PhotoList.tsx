import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { savePhoto } from '../../db/photos';
import { useT } from '../../i18n';
import { PhotoThumb } from './PhotoThumb';

export interface PhotoListProps {
  value: string[];
  onChange: (ids: string[]) => void;
  max: number;
  label: string;
  hint?: string;
  error?: string;
}

/**
 * Up to `max` photos. Each picked file is compressed (JPEG, ≤ 1280 px, ≤ 300 KB) and stored on the phone first;
 * the sync client uploads it when online, so this works offline. The first photo is the cover.
 */
export function PhotoList({ value, onChange, max, label, hint, error }: PhotoListProps) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const full = value.length >= max;

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const ids = [...value];
      for (const f of [...files]) {
        if (ids.length >= max) break; // never more than max (SPEC-M15 AC2)
        ids.push(await savePhoto(f));
      }
      onChange(ids);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <fieldset className="mb-4" data-testid="photo-list">
      <legend className="mb-1.5 text-base font-medium text-ink">{label}</legend>
      {hint && <p className="mb-2 text-sm text-muted">{hint}</p>}
      <ul className="flex flex-wrap gap-3">
        {value.map((id, i) => (
          <li key={id} className="relative" data-testid="photo-list-item">
            <PhotoThumb id={id} alt={t('cat.photoN', { n: i + 1 })} size={88} className="border border-line" />
            <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={t('cat.removePhoto', { n: i + 1 })}
              className="absolute -right-2 -top-2 grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-given shadow-card">
              <X aria-hidden="true" size={18} />
            </button>
          </li>
        ))}
        {!full && (
          <li>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
              className="flex h-[88px] w-[88px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-bg text-sm text-muted focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink">
              <ImagePlus aria-hidden="true" size={24} />{busy ? t('common.loading') : t('cat.addPhoto')}
            </button>
          </li>
        )}
      </ul>
      <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only visually-hidden" tabIndex={-1} aria-hidden="true"
        disabled={full} data-testid="photo-list-input" onChange={(e) => void onFiles(e.target.files)} />
      {error && <p role="alert" className="mt-1.5 text-sm font-medium text-given">{error}</p>}
    </fieldset>
  );
}
