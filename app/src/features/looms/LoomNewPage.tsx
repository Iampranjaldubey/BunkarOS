import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import {
  Button,
  Field,
  Input,
  Select,
  FtInInput,
  PhotoCapture,
  type Person,
  useToast,
} from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { PhotoThumb } from '../../components/ui/PhotoThumb';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import { listThekedars, listWeavers } from '../../domain/projections';
import type { LoomP } from '../../db/types';
import { uuid } from '../../domain/ids';
import { useT } from '../../i18n';
import { GpsCapture, type GpsState } from './shared';

export default function LoomNewPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();

  const thekedars = useMemo(() => listThekedars(recs).filter((th) => th.active), [recs]);
  const weavers = useMemo(() => listWeavers(recs).filter((w) => w.active), [recs]);

  const [code, setCode] = useState('');
  const [village, setVillage] = useState('');
  const [widthIn, setWidthIn] = useState(0);
  const [thekedarId, setThekedarId] = useState('');
  const [weaverIds, setWeaverIds] = useState<string[]>([]);
  const [gps, setGps] = useState<GpsState>({});
  const [photoId, setPhotoId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const errCode = touched && !code.trim() ? t('valid.required') : undefined;
  const errVillage = touched && !village.trim() ? t('valid.required') : undefined;
  const errWidth = touched && widthIn <= 0 ? t('masters.valid.width') : undefined;
  const valid = code.trim() && village.trim() && widthIn > 0;

  const people: Person[] = weavers.map((w) => ({
    id: w.entityId,
    name: w.name,
    village: w.village,
    fatherName: w.fatherName,
    photoId: w.photoId,
  }));

  const toggleWeaver = (id: string) =>
    setWeaverIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      const payload: LoomP = {
        entityId: uuid(),
        code: code.trim(),
        village: village.trim(),
        widthIn,
        thekedarId: thekedarId || undefined,
        weaverIds,
        lat: gps.lat,
        lng: gps.lng,
        photoId,
        active: true,
      };
      await addRecord<LoomP>('loom', payload, photoId ? { photoIds: [photoId] } : {});
      toast.show(t('loom.saved'), 'success');
      navigate('/looms', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <PageHeader title={t('route.loomNew')} back />

      <Field label={t('loom.field.code')} hint={t('loom.field.code.hint')} required error={errCode}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="L-01"
          />
        )}
      </Field>

      <Field label={t('loom.field.village')} required error={errVillage}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={village}
            onChange={(e) => setVillage(e.target.value)}
          />
        )}
      </Field>

      <Field label={t('loom.field.width')} required error={errWidth}>
        {({ describedBy, invalid }) => (
          <FtInInput value={widthIn} onChange={setWidthIn} describedBy={describedBy} invalid={invalid} />
        )}
      </Field>

      <Field label={t('loom.field.thekedar')} hint={t('common.optional')}>
        {({ id, describedBy }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            value={thekedarId}
            onChange={(e) => setThekedarId(e.target.value)}
          >
            <option value="">{t('loom.field.thekedar.none')}</option>
            {thekedars.map((th) => (
              <option key={th.entityId} value={th.entityId}>
                {th.name} — {th.village}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="mb-4">
        <p className="mb-2 text-base font-medium text-ink">{t('loom.field.weavers')}</p>
        {people.length === 0 ? (
          <p className="text-sm text-muted">{t('masters.pickWeaver')}</p>
        ) : (
          <PersonPickerMulti people={people} selected={weaverIds} onToggle={toggleWeaver} />
        )}
      </div>

      <GpsCapture
        value={gps}
        onChange={setGps}
        labelCapture={t('loom.gps.capture')}
        labelCaptured={t('loom.gps.captured')}
        msgDenied={t('loom.gps.denied')}
        msgUnavailable={t('loom.gps.unavailable')}
      />

      <PhotoCapture value={photoId} onChange={setPhotoId} label={t('loom.photo')} />

      <Button size="xl" onClick={save} disabled={saving || (touched && !valid)}>
        <Check aria-hidden="true" size={22} />
        {t('loom.save')}
      </Button>
    </section>
  );
}

/**
 * Multi-select person grid. Reuses PersonPicker's search by composing a simple
 * grid of toggle tiles (PersonPicker itself is single-select, so we build a
 * local multi variant here — this stays inside the owned feature folder).
 */
function PersonPickerMulti({
  people,
  selected,
  onToggle,
}: {
  people: Person[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const filtered = people.filter((p) => {
    const n = q.trim().toLowerCase();
    if (!n) return true;
    return (
      p.name.toLowerCase().includes(n) ||
      (p.village ?? '').toLowerCase().includes(n) ||
      (p.fatherName ?? '').toLowerCase().includes(n)
    );
  });
  return (
    <div>
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('person.search')}
        aria-label={t('person.search')}
        className="mb-3"
      />
      <div className="grid grid-cols-3 gap-3">
        {filtered.map((p) => {
          const on = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(p.id)}
              className={
                'relative flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink ' +
                (on ? 'border-indigo bg-indigo/5' : 'border-line bg-surface hover:bg-bg')
              }
            >
              {on && (
                <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-indigo text-white">
                  <Check aria-hidden="true" size={14} />
                </span>
              )}
              <PhotoThumb id={p.photoId} alt={p.name} size={56} initials={p.name} className="rounded-full" />
              <span className="text-sm font-medium leading-tight text-ink">{p.name}</span>
              {p.village && <span className="text-xs text-muted">{p.village}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
