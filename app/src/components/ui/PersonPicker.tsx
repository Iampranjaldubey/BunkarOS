import { useMemo, useState, useEffect } from 'react';
import { Search, User } from 'lucide-react';
import { Input } from './Input';
import { photoUrl } from '../../db/photos';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

export interface Person {
  id: string;
  name: string;
  village?: string;
  fatherName?: string;
  photoId?: string;
}

export interface PersonPickerProps {
  people: Person[];
  value?: string;
  onSelect: (id: string) => void;
  label?: string;
  className?: string;
}

function PersonTile({
  person,
  selected,
  onSelect,
}: {
  person: Person;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { t } = useT();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (person.photoId) void photoUrl(person.photoId).then((u) => active && setUrl(u));
    return () => {
      active = false;
    };
  }, [person.photoId]);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(person.id)}
      className={cn(
        'flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-colors',
        'focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink',
        selected ? 'border-primary bg-primary/5' : 'border-line bg-surface hover:bg-bg',
      )}
    >
      <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-bg">
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <User aria-hidden="true" className="text-muted" size={28} />
        )}
      </span>
      <span className="text-base font-medium leading-tight text-ink">{person.name}</span>
      {person.fatherName && (
        <span className="text-xs text-muted">
          {t('person.father')}: {person.fatherName}
        </span>
      )}
      {person.village && <span className="text-xs text-muted">{person.village}</span>}
    </button>
  );
}

/** Pick a person from a searchable grid of large photo tiles. */
export function PersonPicker({ people, value, onSelect, label, className }: PersonPickerProps) {
  const { t } = useT();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.village?.toLowerCase().includes(needle) ||
        p.fatherName?.toLowerCase().includes(needle),
    );
  }, [people, q]);

  return (
    <div className={className}>
      {label && <p className="mb-2 text-base font-medium text-ink">{label}</p>}
      <div className="relative mb-3">
        <Search
          aria-hidden="true"
          size={20}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('person.search')}
          aria-label={t('person.search')}
          className="pl-11"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-muted">{t('common.empty')}</p>
      ) : (
        <div className="grid grid-cols-3 gap-3" role="group" aria-label={label ?? t('action.search')}>
          {filtered.map((p) => (
            <PersonTile key={p.id} person={p} selected={p.id === value} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
