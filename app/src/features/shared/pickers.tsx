// Bunkar OS — shared transaction pickers (owned by the transactions agent).
// PiecePicker (on_loom pieces), LoomPicker, HolderPicker, WeaverPicker.
import { useMemo, useState } from 'react';
import { Search, Layers, Check } from 'lucide-react';
import type { Rec, Holder } from '../../db/types';
import {
  listPieces,
  listLooms,
  listWeavers,
  listThekedars,
  type Piece,
} from '../../domain/projections';
import { PersonPicker, type Person } from '../../components/ui/PersonPicker';
import { PhotoThumb } from '../../components/ui/PhotoThumb';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/Feedback';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

// ----------------------------------------------------------------------------
// PiecePicker — on_loom pieces with loom code + weaver name + % woven.
// ----------------------------------------------------------------------------
export interface PiecePickerProps {
  recs: Rec[];
  value?: string;
  onSelect: (pieceId: string) => void;
  /** Restrict to these loom ids (thekedar visibility). */
  loomIds?: string[];
  /** Status filter; defaults to on_loom. */
  status?: Piece['status'];
  label?: string;
}

// ----------------------------------------------------------------------------
// PiecePicker — on_loom pieces with loom code + weaver (photo + father) + % woven.
//   • weaver photo via PhotoThumb + father's name so same-named weavers differ
//   • loom number shown large
//   • sorted by % woven descending (closest to bazaar first)
//   • 'ready for bazaar' badge when pctWoven >= 95
// ----------------------------------------------------------------------------
const READY_PCT = 95;

export function PiecePicker({ recs, value, onSelect, loomIds, status = 'on_loom', label }: PiecePickerProps) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const looms = useMemo(() => listLooms(recs), [recs]);
  const weavers = useMemo(() => listWeavers(recs), [recs]);

  const pieces = useMemo(() => {
    let list = listPieces(recs).filter((p) => p.status === status);
    if (loomIds) list = list.filter((p) => p.loomId && loomIds.includes(p.loomId));
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((p) => p.pieceId.toLowerCase().includes(needle) || p.design.toLowerCase().includes(needle));
    // Sort by % woven descending (ready-for-bazaar first), then piece id for stability.
    return list.sort((a, b) => b.pctWoven - a.pctWoven || a.pieceId.localeCompare(b.pieceId));
  }, [recs, status, loomIds, q]);

  const loomCode = (id?: string) => looms.find((l) => l.entityId === id)?.code;
  const weaverOf = (id?: string) => weavers.find((w) => w.entityId === id);

  if (listPieces(recs).filter((p) => p.status === status && (!loomIds || (p.loomId && loomIds.includes(p.loomId)))).length === 0) {
    return (
      <EmptyState
        icon={<Layers size={40} />}
        title={t('bazaar.noPieces')}
        hint={t('bazaar.noPiecesHint')}
      />
    );
  }

  return (
    <div>
      {label && <p className="mb-2 text-base font-medium text-ink">{label}</p>}
      <div className="relative mb-3">
        <Search aria-hidden="true" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('tx.pick.search')} aria-label={t('tx.pick.search')} className="pl-11" />
      </div>
      {pieces.length === 0 ? (
        <p className="py-6 text-center text-muted">{t('common.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2" role="listbox" aria-label={label ?? t('tx.pick.piece')}>
          {pieces.map((p) => {
            const selected = p.pieceId === value;
            const weaver = weaverOf(p.weaverId);
            const code = loomCode(p.loomId);
            const ready = p.pctWoven >= READY_PCT;
            return (
              <li key={p.pieceId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect(p.pieceId)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                    'focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink',
                    selected ? 'border-indigo bg-indigo/5' : 'border-line bg-surface hover:bg-bg',
                  )}
                >
                  {/* Large loom number */}
                  <span className="num flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo/10 text-indigo">
                    <span className="text-xl font-bold leading-none">{code ?? '—'}</span>
                    <span className="text-[10px] text-muted">{t('nav.looms')}</span>
                  </span>
                  {/* Weaver photo so same-named weavers are distinguishable */}
                  <PhotoThumb id={weaver?.photoId} alt={weaver?.name ?? ''} size={44} initials={weaver?.name} className="rounded-full" />
                  <span className="min-w-0 flex-1">
                    <span className="num block text-base font-semibold text-ink">{p.pieceId}</span>
                    <span className="block truncate text-sm text-ink">{weaver?.name ?? t('tx.piece.noWeaver')}</span>
                    {weaver?.fatherName && (
                      <span className="block truncate text-xs text-muted">{t('tx.piece.father', { name: weaver.fatherName })}</span>
                    )}
                    {ready && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-ok/12 px-2 py-0.5 text-xs font-medium text-ok">
                        <Check aria-hidden="true" size={12} strokeWidth={3} />
                        {t('tx.piece.ready')}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="num text-xl font-bold text-indigo">{p.pctWoven}%</span>
                    <span className="text-xs text-muted">{t('tx.piece.onLoom')}</span>
                  </span>
                  {selected && <Check aria-hidden="true" className="text-indigo" size={22} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// LoomPicker — select a loom (optionally restricted by visibility).
// ----------------------------------------------------------------------------
export interface LoomPickerProps {
  recs: Rec[];
  value?: string;
  onSelect: (loomId: string) => void;
  loomIds?: string[];
  label?: string;
}

export function LoomPicker({ recs, value, onSelect, loomIds, label }: LoomPickerProps) {
  const { t } = useT();
  const looms = useMemo(() => {
    let list = listLooms(recs).filter((l) => l.active);
    if (loomIds) list = list.filter((l) => loomIds.includes(l.entityId));
    return list.sort((a, b) => a.code.localeCompare(b.code));
  }, [recs, loomIds]);

  if (looms.length === 0) {
    return <EmptyState icon={<Layers size={40} />} title={t('checkin.noLooms')} hint={t('checkin.noLoomsHint')} />;
  }

  return (
    <div>
      {label && <p className="mb-2 text-base font-medium text-ink">{label}</p>}
      <ul className="grid grid-cols-2 gap-2" role="listbox" aria-label={label ?? t('tx.pick.loom')}>
        {looms.map((l) => {
          const selected = l.entityId === value;
          return (
            <li key={l.entityId}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(l.entityId)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
                  'focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink',
                  selected ? 'border-indigo bg-indigo/5' : 'border-line bg-surface hover:bg-bg',
                )}
              >
                <PhotoThumb id={l.photoId} alt={l.code} size={44} initials={l.code} />
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="num text-lg font-semibold text-ink">{l.code}</span>
                  <span className="truncate text-sm text-muted">{l.village}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------------------------
// WeaverPicker — PersonPicker over active weavers.
// ----------------------------------------------------------------------------
export interface WeaverPickerProps {
  recs: Rec[];
  value?: string;
  onSelect: (weaverId: string) => void;
  label?: string;
}

export function WeaverPicker({ recs, value, onSelect, label }: WeaverPickerProps) {
  const people: Person[] = useMemo(
    () =>
      listWeavers(recs)
        .filter((w) => w.active)
        .map((w) => ({ id: w.entityId, name: w.name, village: w.village, fatherName: w.fatherName, photoId: w.photoId })),
    [recs],
  );
  return <PersonPicker people={people} value={value} onSelect={onSelect} label={label} />;
}

// ----------------------------------------------------------------------------
// HolderPicker — pick a loom/piece OR a thekedar as the yarn holder.
// ----------------------------------------------------------------------------
export interface HolderPickerProps {
  recs: Rec[];
  value?: Holder;
  onSelect: (holder: Holder) => void;
  label?: string;
}

type HolderKind = 'loom' | 'thekedar';

export function HolderPicker({ recs, value, onSelect, label }: HolderPickerProps) {
  const { t } = useT();
  const [kind, setKind] = useState<HolderKind>(value?.kind ?? 'loom');
  const thekedars = useMemo(() => listThekedars(recs).filter((x) => x.active), [recs]);

  return (
    <div>
      {label && <p className="mb-2 text-base font-medium text-ink">{label}</p>}
      <div role="radiogroup" aria-label={t('tx.pick.holder')} className="mb-3 inline-flex rounded-2xl border border-line bg-bg p-1">
        {(['loom', 'thekedar'] as HolderKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={cn(
              'min-h-12 min-w-12 rounded-xl px-4 text-base font-medium transition-colors focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink',
              kind === k ? 'bg-surface text-indigo shadow-card' : 'text-muted hover:text-ink',
            )}
          >
            {k === 'loom' ? t('tx.pick.holderLoom') : t('tx.pick.holderThekedar')}
          </button>
        ))}
      </div>

      {kind === 'loom' ? (
        <LoomPicker
          recs={recs}
          value={value?.kind === 'loom' ? value.loomId : undefined}
          onSelect={(loomId) => onSelect({ kind: 'loom', loomId })}
        />
      ) : thekedars.length === 0 ? (
        <p className="py-6 text-center text-muted">{t('tx.pick.none')}</p>
      ) : (
        <ul className="flex flex-col gap-2" role="listbox" aria-label={t('tx.pick.holderThekedar')}>
          {thekedars.map((th) => {
            const selected = value?.kind === 'thekedar' && value.thekedarId === th.entityId;
            return (
              <li key={th.entityId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect({ kind: 'thekedar', thekedarId: th.entityId })}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink',
                    selected ? 'border-indigo bg-indigo/5' : 'border-line bg-surface hover:bg-bg',
                  )}
                >
                  <span className="flex-1">
                    <span className="block text-lg font-semibold text-ink">{th.name}</span>
                    <span className="block text-sm text-muted">{th.village}</span>
                  </span>
                  {selected && <Check aria-hidden="true" className="text-indigo" size={22} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
