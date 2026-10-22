import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Minus, Plus, Users } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/Feedback';
import { Sheet } from '../../components/ui/Sheet';
import { Field } from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord, reverse } from '../../db/repo';
import type { AttendanceP, AttendanceStatus, PieceEntryP, WorkerP } from '../../db/types';
import { listWorkers } from '../../domain/masters';
import { attendanceIndex, markKey, dayRollCall } from '../../domain/attendance';
import { isDayLocked } from '../../domain/locks';
import { todayIST } from '../../domain/ids';
import { formatDay } from '../../domain/dates';
import { formatINR, rupeesToPaise } from '../../domain/money';
import { useT } from '../../i18n';
import { Avatar } from '../workers/shared';
import { cn } from '../../lib/utils';

const STATUSES: { v: AttendanceStatus; key: string; short: string; cls: string }[] = [
  { v: 'present', key: 'att.present', short: 'P', cls: 'bg-received text-white border-received' },
  { v: 'half', key: 'att.half', short: 'H', cls: 'bg-accent text-ink border-accent' },
  { v: 'absent', key: 'att.absent', short: 'A', cls: 'bg-given text-white border-given' },
];

/** One fast screen: every active worker, three big toggles + OT stepper, saves on tap. */
export default function AttendancePage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const [day, setDay] = useState(todayIST());
  const [pieceFor, setPieceFor] = useState<WorkerP | null>(null);
  const [pieceCount, setPieceCount] = useState(''); const [pieceRate, setPieceRate] = useState('');
  const workers = useMemo(() => listWorkers(recs).filter((w) => w.joinedOn <= day), [recs, day]);
  const idx = useMemo(() => attendanceIndex(recs), [recs]);
  const roll = useMemo(() => dayRollCall(recs, workers.map((w) => w.entityId), day), [recs, workers, day]);
  const locked = useMemo(() => isDayLocked(recs, day), [recs, day]);

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

  return (
    <section>
      <PageHeader title={t('att.title')} right={
        <input type="date" aria-label={t('common.date')} value={day} max={todayIST()} onChange={(e) => e.target.value && setDay(e.target.value)} className="num min-h-11 rounded-xl border border-line bg-surface px-3 text-base text-ink" />
      } />
      {locked && <p role="alert" className="mb-3 rounded-xl bg-warn-soft px-4 py-2 text-sm font-medium text-warn">{t('att.locked')}</p>}
      <Card className="mb-4 flex items-center gap-3 bg-primary-soft">
        <div className="flex-1">
          <p className="text-sm text-muted">{formatDay(day, lang, 'long')}</p>
          <p className="num text-lg font-medium text-ink">{t('att.marked', { marked: roll.marked, total: roll.total })} · <span className="text-received">P {roll.present}</span> · <span className="text-accent-ink">H {roll.half}</span> · <span className="text-given">A {roll.absent}</span></p>
        </div>
        {roll.marked < roll.total && !locked && <Button size="md" variant="success" onClick={() => void allPresent()}><Check aria-hidden="true" size={18} />{t('att.allPresent')}</Button>}
      </Card>
      {workers.length === 0 ? (
        <EmptyState icon={<Users size={40} />} title={t('att.empty')} action={<Button onClick={() => navigate('/workers/new')}>{t('worker.new')}</Button>} />
      ) : (
        <ul className="flex flex-col gap-2 md:grid md:grid-cols-2 lg:grid-cols-3" data-testid="attendance-list">
          {workers.map((w) => {
            const m = idx.get(markKey(w.entityId, day));
            return (
              <li key={w.entityId} className="rounded-2xl border border-line bg-surface p-3 shadow-card" data-testid={`att-row-${w.entityId}`}>
                <div className="flex items-center gap-3">
                  <Avatar name={w.name} />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{w.name}</p><p className="text-xs text-muted">{t(`worker.job.${w.jobTitle}`)}{w.payType === 'piece' ? ` · ${t('worker.payType.piece')}` : ''}</p></div>
                  {m && m.otHours > 0 && <span className="num rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">OT {m.otHours}h</span>}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={w.name}>
                  {STATUSES.map((s) => (
                    <button key={s.v} type="button" role="radio" aria-checked={m?.status === s.v} disabled={locked} onClick={() => void mark(w, s.v)}
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
                      <button type="button" aria-label="+0.5h" disabled={locked || m.otHours >= 12} onClick={() => void mark(w, m.status, m.otHours + 0.5)} className="tap-48 rounded-xl text-muted hover:bg-surface-2 disabled:opacity-30"><Plus aria-hidden="true" size={18} /></button>
                    </div>
                  </div>
                )}
                {w.payType === 'piece' && !locked && (
                  <button type="button" onClick={() => { setPieceFor(w); setPieceRate(String((w.pieceRatePaise ?? 0) / 100)); }} className="mt-2 text-sm font-medium text-primary">{t('att.addPieces')} →</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Sheet open={Boolean(pieceFor)} onClose={() => setPieceFor(null)} title={`${t('att.addPieces')} · ${pieceFor?.name ?? ''}`} footer={<Button block onClick={() => void savePieces()}>{t('action.save')}</Button>}>
        <Field label={t('att.pieceCount')} required>{({ id }) => <Input id={id} inputMode="numeric" value={pieceCount} onChange={(e) => setPieceCount(e.target.value.replace(/\D/g, ''))} className="num text-xl" autoFocus />}</Field>
        <Field label={t('att.pieceRate')} hint={pieceCount && pieceRate ? `= ${formatINR(Number(pieceCount) * rupeesToPaise(Number(pieceRate)))}` : undefined}>{({ id }) => <Input id={id} inputMode="decimal" value={pieceRate} onChange={(e) => setPieceRate(e.target.value.replace(/[^\d.]/g, ''))} className="num" />}</Field>
      </Sheet>
    </section>
  );
}
