import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pencil, Wallet } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatTile, EmptyState } from '../../components/ui/Feedback';
import { PageGrid } from '../../components/ui/PageGrid';
import { ConfirmSheet } from '../../components/ui/Sheet';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { WorkerP } from '../../db/types';
import { listWorkers, getSettings, nameMaps } from '../../domain/masters';
import { monthAttendance, monthPieces } from '../../domain/attendance';
import { advancesFor, advanceBalance, lastPayment } from '../../domain/advances';
import { formatINR } from '../../domain/money';
import { formatDay, formatMonth } from '../../domain/dates';
import { todayIST, monthOf, prevMonth, nextMonth, weekday } from '../../domain/ids';
import { can } from '../../domain/permissions';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { Avatar, PaySummary, JobBadge } from './shared';

export default function WorkerDetailPage() {
  const { t, lang } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useSession();
  const recs = useRecords();
  const today = todayIST();
  const [month, setMonth] = useState(monthOf(today));
  const [confirm, setConfirm] = useState(false);
  const w = useMemo(() => listWorkers(recs, false).find((x) => x.entityId === id), [recs, id]);
  const settings = useMemo(() => getSettings(recs), [recs]);
  const names = useMemo(() => nameMaps(recs), [recs]);
  const att = useMemo(() => (w ? monthAttendance(recs, w.entityId, month, today, settings) : null), [recs, w, month, today, settings]);
  const pieces = useMemo(() => (w ? monthPieces(recs, w.entityId, month) : null), [recs, w, month]);
  const advances = useMemo(() => (w ? advancesFor(recs, w.entityId) : []), [recs, w]);
  const balance = w ? advanceBalance(recs, w.entityId) : 0;
  const last = w ? lastPayment(recs, w.entityId) : undefined;
  if (!w || !att) return <EmptyState title={t('common.empty')} />;
  const canManage = role ? can(role, 'worker.manage') : false;

  const toggleActive = async () => { await addRecord<WorkerP>('worker', { ...w, active: !w.active }); setConfirm(false); };
  const days = Object.keys(att.days);
  const holidays = new Set(settings?.holidays ?? []);

  const cell = (day: string) => {
    const m = att.days[day];
    const sunday = weekday(day) === 0 || holidays.has(day);
    const base = 'flex h-11 flex-col items-center justify-center rounded-lg text-xs font-medium';
    if (m?.status === 'present') return <div className={`${base} bg-received-soft text-received`}><span>P</span>{m.otHours > 0 && <span className="num text-[10px]">+{m.otHours}h</span>}</div>;
    if (m?.status === 'half') return <div className={`${base} bg-accent-soft text-accent-ink`}><span>H</span></div>;
    if (m?.status === 'absent') return <div className={`${base} bg-given-soft text-given`}><span>A</span></div>;
    if (sunday) return <div className={`${base} bg-surface-2 text-muted`}>·</div>;
    if (day > today) return <div className={`${base} text-line`}> </div>;
    return <div className={`${base} border border-dashed border-line text-muted`}>?</div>;
  };

  return (
    <section>
      <PageHeader title={w.name} back right={canManage && <Button size="md" variant="secondary" onClick={() => navigate(`/workers/${w.entityId}/edit`)}><Pencil aria-hidden="true" size={16} />{t('action.edit')}</Button>} />
      <PageGrid
        aside={
          <div className="flex flex-col gap-4">
            <Card className="flex items-center gap-3">
              <Avatar name={w.name} size={56} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><JobBadge w={w} />{!w.active && <Badge tone="neutral">{t('common.inactive')}</Badge>}</div>
                <PaySummary w={w} />
                {w.phone && <p className="num text-sm text-muted">{w.phone}</p>}
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label={t('worker.balance')} tone={balance > 0 ? 'given' : 'neutral'} value={formatINR(balance)} testid="worker-balance" />
              <StatTile label={t('worker.lastPayment')} value={last ? formatINR(last.payload.paidPaise) : t('worker.noPayment')} />
            </div>
            <Button variant="secondary" onClick={() => navigate(`/advances/new?worker=${w.entityId}`)}><Wallet aria-hidden="true" size={18} />{t('worker.advances')}</Button>
            <Card>
              <CardTitle>{t('worker.advances')}</CardTitle>
              {advances.length === 0 ? <p className="text-sm text-muted">{t('common.empty')}</p> : (
                <ul className="divide-y divide-line">
                  {advances.slice(0, 8).map((a) => (
                    <li key={a.recId} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-muted">{formatDay(a.day, lang, 'short')} · {t(`common.${a.mode}`)}{a.note ? ` · ${a.note}` : ''}</span>
                      <span className="num font-medium text-given">{formatINR(a.amountPaise)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            {canManage && <Button variant="ghost" onClick={() => setConfirm(true)}>{w.active ? t('worker.deactivate') : t('worker.reactivate')}</Button>}
          </div>
        }
        main={
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <CardTitle className="mb-0">{t('att.month')}</CardTitle>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setMonth(prevMonth(month))} aria-label={t('action.back')} className="tap-48 rounded-xl text-muted hover:bg-surface-2"><ChevronLeft aria-hidden="true" /></button>
                <span className="min-w-32 text-center font-medium text-ink">{formatMonth(month, lang)}</span>
                <button type="button" onClick={() => setMonth(nextMonth(month))} disabled={month >= monthOf(today)} aria-label={t('action.next')} className="tap-48 rounded-xl text-muted hover:bg-surface-2 disabled:opacity-30"><ChevronRight aria-hidden="true" /></button>
              </div>
            </div>
            <div className="mb-3 grid grid-cols-4 gap-2 text-center">
              {[['att.present', att.present, 'text-received'], ['att.half', att.half, 'text-accent-ink'], ['att.absent', att.absent, 'text-given'], ['att.ot', `${att.otHours}h`, 'text-ink']].map(([k, v, c]) => (
                <div key={String(k)} className="rounded-xl bg-surface-2 p-2"><p className={`num text-xl font-bold ${c}`}>{v}</p><p className="text-xs text-muted">{t(String(k))}</p></div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => <div key={d}><p className="num mb-0.5 text-center text-[10px] text-muted">{Number(d.slice(8))}</p>{cell(d)}</div>)}
            </div>
            <p className="mt-2 text-xs text-muted">{t('att.legend')}{att.unmarked > 0 ? ` · ? ${t('att.unmarked')}: ${att.unmarked}` : ''}</p>
            {w.payType === 'piece' && pieces && <p className="mt-2 text-sm text-ink">{t('att.pieces')}: <span className="num font-medium">{pieces.count}</span> · {formatINR(pieces.amountPaise)}</p>}
            {last && <p className="mt-2 text-sm text-muted">{t('worker.lastPayment')}: {formatMonth(last.payload.month, lang)} · {formatINR(last.payload.paidPaise)} · {t('common.by', { name: names.users.get(last.by) ?? '' })}</p>}
            <Link to={`/wages/${month}/${w.entityId}`} className="mt-3 inline-block text-sm font-medium text-primary">{t('nav.wages')} →</Link>
          </Card>
        }
      />
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} onConfirm={() => void toggleActive()} title={w.active ? t('worker.deactivate') : t('worker.reactivate')} message={w.name} />
    </section>
  );
}
