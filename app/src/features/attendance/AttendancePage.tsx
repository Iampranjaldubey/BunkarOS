import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarOff, Check, ChevronLeft, ChevronRight, Keyboard, Minus, Plus, Users } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Feedback';
import { Sheet } from '../../components/ui/Sheet';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { useIsDesktop } from '../../components/ui/useIsDesktop';
import { useRecords } from '../../db/hooks';
import { addRecord, reverse } from '../../db/repo';
import type { AttendanceP, AttendanceStatus, PieceEntryP, WorkerP } from '../../db/types';
import { listWorkers, getSettings } from '../../domain/masters';
import { attendanceIndex, markKey, dayRollCall } from '../../domain/attendance';
import { isDayLocked } from '../../domain/locks';
import { recsOfType } from '../../domain/records';
import { addDays, todayIST, weekday } from '../../domain/ids';
import { formatDay } from '../../domain/dates';
import { formatINR, rupeesToPaise } from '../../domain/money';
import { useT } from '../../i18n';
import { Avatar } from '../workers/shared';
import { cn } from '../../lib/utils';

const STATUSES: { v: AttendanceStatus; key: string; short: string; cls: string; tone: 'received' | 'warn' | 'given' }[] = [
  { v: 'present', key: 'att.present', short: 'P', cls: 'bg-received text-on-fill border-received', tone: 'received' },
  { v: 'half', key: 'att.half', short: 'H', cls: 'bg-accent text-ink border-accent', tone: 'warn' },
  { v: 'absent', key: 'att.absent', short: 'A', cls: 'bg-given text-on-fill border-given', tone: 'given' },
];
const KEY_TO_STATUS: Record<string, AttendanceStatus> = { p: 'present', '1': 'present', h: 'half', '2': 'half', a: 'absent', '3': 'absent' };
const MAX_OT = 12;

/** One fast screen for the day's roll call. Phones: cards with big toggles. Desktop (SPEC-M12): a table you can drive with the keyboard. */
export default function AttendancePage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const isDesktop = useIsDesktop();
  const today = todayIST();
  const [day, setDay] = useState(today);
  const [onlyUnmarked, setOnlyUnmarked] = useState(false);
  const [pieceFor, setPieceFor] = useState<WorkerP | null>(null);
  const [pieceCount, setPieceCount] = useState(''); const [pieceRate, setPieceRate] = useState('');
  const workers = useMemo(() => listWorkers(recs).filter((w) => w.joinedOn <= day), [recs, day]);
  const idx = useMemo(() => attendanceIndex(recs), [recs]);
  const roll = useMemo(() => dayRollCall(recs, workers.map((w) => w.entityId), day), [recs, workers, day]);
  const locked = useMemo(() => isDayLocked(recs, day), [recs, day]);
  const settings = useMemo(() => getSettings(recs), [recs]);
  const dayPieces = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recsOfType<PieceEntryP>(recs, 'piece_entry')) if (r.day === day) m.set(r.payload.workerId, (m.get(r.payload.workerId) ?? 0) + r.payload.count);
    return m;
  }, [recs, day]);
  const isHoliday = (settings?.holidays ?? []).includes(day);
  const isSunday = weekday(day) === 0;
  const shown = isDesktop && onlyUnmarked ? workers.filter((w) => !idx.get(markKey(w.entityId, day))) : workers;
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const mark = async (w: WorkerP, status: AttendanceStatus, otHours?: number) => {
    if (locked) { toast.show(t('valid.locked'), 'error'); return; }
    const prev = idx.get(markKey(w.entityId, day));
    const ot = otHours ?? prev?.otHours ?? 0;
    if (prev && prev.status === status && prev.otHours === ot) return;
    if (prev) await reverse(prev.recId, 'edited');
    await addRecord<AttendanceP>('attendance', { workerId: w.entityId, status, otHours: status === 'absent' ? 0 : ot }, { day, replaces: prev?.recId });
  };
  const allPresent = async () => {
    for (const w of workers) if (!idx.get(markKey(w.entityId, day))) await mark(w, 'present', 0);
    toast.show(t('att.saved'), 'success');
  };
  const savePieces = async () => {
    if (!pieceFor) return;
    const count = Number(pieceCount); const rate = rupeesToPaise(Number(pieceRate));
    if (!Number.isInteger(count) || count <= 0 || !(rate >= 0)) { toast.show(t('valid.positive'), 'error'); return; }
    await addRecord<PieceEntryP>('piece_entry', { workerId: pieceFor.entityId, count, pieceRatePaise: rate }, { day });
    setPieceFor(null); setPieceCount(''); toast.show(t('action.done'), 'success');
  };
  const openPieces = (w: WorkerP) => { setPieceFor(w); setPieceRate(String((w.pieceRatePaise ?? 0) / 100)); };

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    requestAnimationFrame(() => (rowRefs.current.get(id) ?? rowRefs.current.values().next().value)?.focus());
  };
  /** Row keys: P/H/A or 1/2/3 mark (then next row), + / − change OT by 0.5 h, ↑ / ↓ move. */
  const onRowKey = (e: React.KeyboardEvent, w: WorkerP, i: number) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    const m = idx.get(markKey(w.entityId, day));
    const status = KEY_TO_STATUS[k];
    if (status) {
      e.preventDefault();
      if (locked) { toast.show(t('valid.locked'), 'error'); return; }
      const nextId = shown[i + 1]?.entityId ?? (onlyUnmarked ? undefined : w.entityId);
      void mark(w, status).then(() => focusRow(nextId));
      return;
    }
    if (k === '+' || k === '=' || k === '-' || k === '−' || k === '_') {
      e.preventDefault();
      if (!m || m.status === 'absent' || locked) return;
      const ot = k === '+' || k === '=' ? Math.min(MAX_OT, m.otHours + 0.5) : Math.max(0, m.otHours - 0.5);
      if (ot !== m.otHours) void mark(w, m.status, ot);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusRow(shown[e.key === 'ArrowDown' ? i + 1 : i - 1]?.entityId ?? w.entityId);
    }
  };

  const notes = (
    <>
      {locked && <p role="alert" className="mb-3 rounded-xl bg-warn-soft px-4 py-2 text-sm font-medium text-warn">{t('att.locked')}</p>}
      {(isHoliday || isSunday) && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-2 text-sm font-medium text-accent-ink" data-testid="day-off-note">
          <CalendarOff aria-hidden="true" size={16} />{isHoliday ? t('att.holiday') : t('att.sunday')}
        </p>
      )}
    </>
  );
  const counts = <p className="num text-lg font-medium text-ink">{t('att.marked', { marked: roll.marked, total: roll.total })} · <span className="text-received">P {roll.present}</span> · <span className="text-accent-ink">H {roll.half}</span> · <span className="text-given">A {roll.absent}</span></p>;
  const allPresentBtn = roll.marked < roll.total && !locked && <Button size="md" variant="success" onClick={() => void allPresent()}><Check aria-hidden="true" size={18} />{t('att.allPresent')}</Button>;
  const empty = <EmptyState icon={<Users size={40} />} title={t('att.empty')} action={<Button onClick={() => navigate('/workers/new')}>{t('worker.new')}</Button>} />;
  const pieceSheet = (
    <Sheet open={Boolean(pieceFor)} onClose={() => setPieceFor(null)} title={`${t('att.addPieces')} · ${pieceFor?.name ?? ''}`} footer={<Button block onClick={() => void savePieces()}>{t('action.save')}</Button>}>
      <Field label={t('att.pieceCount')} required>{({ id }) => <Input id={id} inputMode="numeric" value={pieceCount} onChange={(e) => setPieceCount(e.target.value.replace(/\D/g, ''))} className="num text-xl" autoFocus />}</Field>
      <Field label={t('att.pieceRate')} hint={pieceCount && pieceRate ? `= ${formatINR(Number(pieceCount) * rupeesToPaise(Number(pieceRate)))}` : undefined}>{({ id }) => <Input id={id} inputMode="decimal" value={pieceRate} onChange={(e) => setPieceRate(e.target.value.replace(/[^\d.]/g, ''))} className="num" />}</Field>
    </Sheet>
  );

  if (isDesktop) {
    const iconBtn = 'inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';
    return (
      <section>
        <PageHeader title={t('att.title')} />
        {notes}
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface p-3 shadow-card" data-testid="attendance-toolbar">
          <div className="flex items-center gap-1">
            <button type="button" className={iconBtn} aria-label={t('att.prevDay')} title={t('att.prevDay')} onClick={() => setDay(addDays(day, -1))}><ChevronLeft aria-hidden="true" /></button>
            <input type="date" aria-label={t('common.date')} value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} className="num min-h-11 rounded-xl border border-line bg-surface px-3 text-base text-ink" />
            <button type="button" className={iconBtn} aria-label={t('att.nextDay')} title={t('att.nextDay')} disabled={day >= today} onClick={() => setDay(addDays(day, 1))}><ChevronRight aria-hidden="true" /></button>
            <Button size="md" variant="ghost" disabled={day === today} onClick={() => setDay(today)}>{t('common.today')}</Button>
          </div>
          <div className="min-w-56 flex-1">
            <p className="text-sm text-muted">{formatDay(day, lang, 'long')}</p>
            {counts}
          </div>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-base text-ink hover:bg-surface-2">
            <input type="checkbox" checked={onlyUnmarked} onChange={(e) => setOnlyUnmarked(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)]" />{t('att.onlyUnmarked')}
          </label>
          {allPresentBtn}
        </div>
        {workers.length === 0 ? empty : (
          <>
            <p className="mb-2 flex items-center gap-2 text-sm text-muted" id="att-key-hint"><Keyboard aria-hidden="true" size={16} />{t('att.keyHint')}</p>
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
              <table className="w-full border-collapse text-base" data-testid="attendance-table" aria-describedby="att-key-hint">
                <thead>
                  <tr className="text-left text-sm text-muted">
                    <th scope="col" className="border-b border-line px-4 py-3 font-medium">{t('att.colWorker')}</th>
                    <th scope="col" className="border-b border-line px-4 py-3 font-medium">{t('att.colMark')}</th>
                    <th scope="col" className="border-b border-line px-4 py-3 font-medium">{t('att.colOt')}</th>
                    <th scope="col" className="border-b border-line px-4 py-3 font-medium">{t('att.colPieces')}</th>
                    <th scope="col" className="border-b border-line px-4 py-3 font-medium">{t('att.colState')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">{t('att.allMarked')}</td></tr>}
                  {shown.map((w, i) => {
                    const m = idx.get(markKey(w.entityId, day));
                    const st = STATUSES.find((s) => s.v === m?.status);
                    const pcs = dayPieces.get(w.entityId) ?? 0;
                    return (
                      <tr key={w.entityId} tabIndex={0} data-att-row data-testid={`att-row-${w.entityId}`}
                        ref={(el) => { if (el) rowRefs.current.set(w.entityId, el); else rowRefs.current.delete(w.entityId); }}
                        onKeyDown={(e) => onRowKey(e, w, i)}
                        className="even:bg-bg/60 focus-visible:outline focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-accent-ink">
                        <td className="border-b border-line px-4 py-2">
                          <div className="flex items-center gap-3"><Avatar name={w.name} photoId={w.photoId} size={36} />
                            <div className="min-w-0"><p className="truncate font-medium text-ink">{w.name}</p><p className="text-xs text-muted">{t(`worker.job.${w.jobTitle}`)}{w.payType === 'piece' ? ` · ${t('worker.payType.piece')}` : ''}</p></div></div>
                        </td>
                        <td className="border-b border-line px-4 py-2">
                          <div className="inline-flex gap-1.5" role="radiogroup" aria-label={w.name}>
                            {STATUSES.map((s) => (
                              <button key={s.v} type="button" role="radio" aria-checked={m?.status === s.v} aria-label={`${t(s.key)} (${s.short})`} disabled={locked} onClick={() => void mark(w, s.v)}
                                className={cn('inline-flex min-h-11 min-w-24 items-center justify-center gap-2 rounded-xl border px-3 text-base font-semibold transition-colors', m?.status === s.v ? s.cls : 'border-line bg-surface text-muted hover:bg-surface-2 hover:text-ink')}>
                                {t(s.key)}<kbd className={cn('rounded border px-1 text-xs font-medium', m?.status === s.v ? 'border-on-fill/40' : 'border-line')} aria-hidden="true">{s.short}</kbd>
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="border-b border-line px-4 py-2">
                          {m && m.status !== 'absent' ? (
                            <div className="inline-flex items-center gap-1">
                              <button type="button" aria-label="−0.5h" disabled={locked || m.otHours <= 0} onClick={() => void mark(w, m.status, Math.max(0, m.otHours - 0.5))} className={iconBtn}><Minus aria-hidden="true" size={18} /></button>
                              <span className="num w-10 text-center font-medium text-ink">{m.otHours}</span>
                              <button type="button" aria-label="+0.5h" disabled={locked || m.otHours >= MAX_OT} onClick={() => void mark(w, m.status, m.otHours + 0.5)} className={iconBtn}><Plus aria-hidden="true" size={18} /></button>
                            </div>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td className="border-b border-line px-4 py-2">
                          {w.payType === 'piece' ? (
                            <div className="flex items-center gap-2">{pcs > 0 && <span className="num font-medium text-ink">{pcs}</span>}
                              {!locked && <Button size="md" variant="ghost" onClick={() => openPieces(w)}><Plus aria-hidden="true" size={16} />{t('att.addPieces')}</Button>}</div>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td className="border-b border-line px-4 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {st ? <Badge tone={st.tone}>{t(st.key)}</Badge> : <Badge tone="neutral">{t('att.notMarked')}</Badge>}
                            {m && m.otHours > 0 && <span className="num rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">OT {m.otHours}h</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {pieceSheet}
      </section>
    );
  }

  return (
    <section>
      <PageHeader title={t('att.title')} right={
        <input type="date" aria-label={t('common.date')} value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} className="num min-h-11 rounded-xl border border-line bg-surface px-3 text-base text-ink" />
      } />
      {notes}
      <Card className="mb-4 flex items-center gap-3 bg-primary-soft">
        <div className="flex-1">
          <p className="text-sm text-muted">{formatDay(day, lang, 'long')}</p>
          {counts}
        </div>
        {allPresentBtn}
      </Card>
      {workers.length === 0 ? empty : (
        <ul className="flex flex-col gap-2 md:grid md:grid-cols-2" data-testid="attendance-list">
          {workers.map((w) => {
            const m = idx.get(markKey(w.entityId, day));
            return (
              <li key={w.entityId} className="rounded-2xl border border-line bg-surface p-3 shadow-card" data-att-row data-testid={`att-row-${w.entityId}`}>
                <div className="flex items-center gap-3">
                  <Avatar name={w.name} photoId={w.photoId} />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{w.name}</p><p className="text-xs text-muted">{t(`worker.job.${w.jobTitle}`)}{w.payType === 'piece' ? ` · ${t('worker.payType.piece')}` : ''}</p></div>
                  {m && m.otHours > 0 && <span className="num rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">OT {m.otHours}h</span>}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={w.name}>
                  {STATUSES.map((s) => (
                    <button key={s.v} type="button" role="radio" aria-checked={m?.status === s.v} aria-label={`${t(s.key)} (${s.short})`} disabled={locked} onClick={() => void mark(w, s.v)}
                      className={cn('tap-48 rounded-xl border text-base font-semibold transition-colors', m?.status === s.v ? s.cls : 'border-line bg-surface text-muted hover:bg-surface-2')}>
                      <span className="md:hidden">{s.short}</span><span className="hidden md:inline">{t(s.key)}</span>
                    </button>
                  ))}
                </div>
                {m && m.status !== 'absent' && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted">{t('att.otHours')}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label="−0.5h" disabled={locked || m.otHours <= 0} onClick={() => void mark(w, m.status, Math.max(0, m.otHours - 0.5))} className="tap-48 rounded-xl text-muted hover:bg-surface-2 disabled:opacity-30"><Minus aria-hidden="true" size={18} /></button>
                      <span className="num w-10 text-center font-medium text-ink">{m.otHours}</span>
                      <button type="button" aria-label="+0.5h" disabled={locked || m.otHours >= MAX_OT} onClick={() => void mark(w, m.status, m.otHours + 0.5)} className="tap-48 rounded-xl text-muted hover:bg-surface-2 disabled:opacity-30"><Plus aria-hidden="true" size={18} /></button>
                    </div>
                  </div>
                )}
                {w.payType === 'piece' && !locked && (
                  <button type="button" onClick={() => openPieces(w)} className="mt-2 text-sm font-medium text-primary">{t('att.addPieces')} →</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {pieceSheet}
    </section>
  );
}
