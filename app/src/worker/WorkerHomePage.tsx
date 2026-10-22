import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CalendarCheck, Wallet, HandCoins, UserRound, MessageCircle, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ConfirmSheet } from '../components/ui/Sheet';
import { waMeLink } from '../components/ui/PreviewShareSheet';
import type { WagePaymentP, Rec } from '../db/types';
import { getSettings } from '../domain/masters';
import { monthAttendance, monthPieces } from '../domain/attendance';
import { wageInputsFor, computeGross, settle, rateOf } from '../domain/wage';
import { advanceBalance, advancesFor } from '../domain/advances';
import { recsOfType } from '../domain/records';
import { formatINR } from '../domain/money';
import { formatDay, formatMonth, formatTime } from '../domain/dates';
import { todayIST, monthOf, prevMonth, nextMonth } from '../domain/ids';
import { useT } from '../i18n';
import { Avatar } from '../features/workers/shared';
import { MonthGrid } from '../features/workers/MonthGrid';
import { WorkerShell } from './WorkerShell';
import { cachedWorkerData, fetchWorkerData, forgetWorker, getWorkerToken, type WorkerData } from './api';
import { cn } from '../lib/utils';

type Tab = 'month' | 'pay' | 'advance' | 'profile';
const TABS: { v: Tab; key: string; icon: React.ReactNode }[] = [
  { v: 'month', key: 'wp.tab.month', icon: <CalendarCheck size={20} aria-hidden="true" /> },
  { v: 'pay', key: 'wp.tab.pay', icon: <Wallet size={20} aria-hidden="true" /> },
  { v: 'advance', key: 'wp.tab.advance', icon: <HandCoins size={20} aria-hidden="true" /> },
  { v: 'profile', key: 'wp.tab.profile', icon: <UserRound size={20} aria-hidden="true" /> },
];

/** The worker's own page: this month, pay history, advances, profile. Remembered on the phone; no login words. */
export default function WorkerHomePage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const token = getWorkerToken();
  const [data, setData] = useState<WorkerData | null>(() => cachedWorkerData());
  const [state, setState] = useState<'loading' | 'ok' | 'stale' | 'revoked' | 'error'>(data ? 'ok' : 'loading');
  const [tab, setTab] = useState<Tab>('month');
  const [month, setMonth] = useState(monthOf(todayIST()));
  const [openPay, setOpenPay] = useState<string | null>(null);
  const [confirmForget, setConfirmForget] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    const r = await fetchWorkerData(token);
    if (r.ok) { setData(r.data); setState('ok'); return; }
    if (r.reason === 'revoked' || r.reason === 'not_found') { setState('revoked'); return; }
    setState(cachedWorkerData() ? 'stale' : 'error');
  }, [token]);
  useEffect(() => { void refresh(); const on = () => void refresh(); window.addEventListener('online', on); window.addEventListener('focus', on); return () => { window.removeEventListener('online', on); window.removeEventListener('focus', on); }; }, [refresh]);

  const today = todayIST();
  const recs: Rec[] = useMemo(() => data?.records ?? [], [data]);
  const settings = useMemo(() => getSettings(recs), [recs]);
  const worker = data?.worker;
  const att = useMemo(() => (worker ? monthAttendance(recs, worker.entityId, month, month === monthOf(today) ? today : `${month}-31`, settings) : null), [recs, worker, month, today, settings]);
  const pieces = useMemo(() => (worker ? monthPieces(recs, worker.entityId, month) : null), [recs, worker, month]);
  const estimate = useMemo(() => {
    if (!worker) return null;
    const inputs = wageInputsFor(recs, worker, month, settings);
    const b = computeGross(inputs);
    const paid = recsOfType<WagePaymentP>(recs, 'wage_payment').find((r) => r.payload.workerId === worker.entityId && r.payload.month === month);
    const outstanding = advanceBalance(recs, worker.entityId) + (paid?.payload.advanceRecoveredPaise ?? 0);
    return { inputs, b, s: settle(b, paid?.payload.deductions ?? [], outstanding, paid?.payload.advanceRecoveredPaise), paid };
  }, [recs, worker, month, settings]);
  const payments = useMemo(() => (worker ? recsOfType<WagePaymentP>(recs, 'wage_payment').filter((r) => r.payload.workerId === worker.entityId).sort((a, b) => (a.payload.month < b.payload.month ? 1 : -1)) : []), [recs, worker]);
  const byYear = useMemo(() => { const m = new Map<string, Rec<WagePaymentP>[]>(); for (const p of payments) { const y = p.payload.month.slice(0, 4); m.set(y, [...(m.get(y) ?? []), p]); } return [...m]; }, [payments]);
  const advances = useMemo(() => (worker ? advancesFor(recs, worker.entityId) : []), [recs, worker]);
  const balance = worker ? advanceBalance(recs, worker.entityId) : 0;

  if (!token) return <Navigate to="/w/join" replace />;
  if (state === 'revoked') {
    return (
      <WorkerShell header={<h1 className="text-2xl">{t('wp.title')}</h1>}>
        <Card className="text-center"><p className="mb-4 text-lg text-ink">{t('wp.revoked')}</p><Button onClick={() => { forgetWorker(); navigate('/w/join', { replace: true }); }}>{t('wj.title')}</Button></Card>
      </WorkerShell>
    );
  }
  if (!data || !worker || !att || !estimate) {
    return <WorkerShell header={<h1 className="text-2xl">{t('wp.title')}</h1>}><Card className="text-center text-muted">{state === 'error' ? t('wp.error') : t('wp.loading')}</Card>{state === 'error' && <Button className="mt-3" block onClick={() => void refresh()}>{t('action.retry')}</Button>}</WorkerShell>;
  }

  const rate = rateOf(worker);
  const rateUnit = worker.payType === 'monthly' ? t('wp.perMonth') : worker.payType === 'daily' ? t('wp.perDay') : t('wp.perPiece');
  const slipLines = (p: WagePaymentP) => {
    const lines: [string, number][] = [[t('wp.gross'), p.grossPaise]];
    if (p.otPaise) lines.push([t('wp.ot'), p.otPaise]);
    for (const d of p.deductions) lines.push([d.label, -d.amountPaise]);
    if (p.advanceRecoveredPaise) lines.push([t('wp.advanceCut'), -p.advanceRecoveredPaise]);
    if (p.roundingPaise) lines.push([t('wages.rounding'), p.roundingPaise]);
    return lines;
  };

  return (
    <WorkerShell header={
      <div className="flex items-center gap-3">
        <Avatar name={worker.name} size={48} />
        <div className="min-w-0"><p className="truncate text-sm text-muted">{data.unitName}</p><h1 className="truncate text-2xl">{t('wp.hello', { name: worker.name })}</h1></div>
      </div>
    }>
      <p className="mb-3 text-xs text-muted">{state === 'stale' ? t('wp.offline') + ' · ' : ''}{t('wp.updated', { time: formatTime(data.fetchedAt, lang) })}</p>
      <div className="mb-4 grid grid-cols-4 gap-1 rounded-2xl border border-line bg-surface p-1" role="tablist" aria-label={t('wp.title')}>
        {TABS.map((x) => (
          <button key={x.v} role="tab" aria-selected={tab === x.v} onClick={() => setTab(x.v)} className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium', tab === x.v ? 'bg-primary text-white' : 'text-muted hover:bg-surface-2')}>{x.icon}<span>{t(x.key)}</span></button>
        ))}
      </div>

      {tab === 'month' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setMonth(prevMonth(month))} aria-label={t('action.back')} className="tap-48 rounded-xl text-muted hover:bg-surface-2"><ChevronLeft aria-hidden="true" /></button>
            <span className="text-lg font-medium text-ink">{formatMonth(month, lang)}</span>
            <button type="button" onClick={() => setMonth(nextMonth(month))} disabled={month >= monthOf(today)} aria-label={t('action.next')} className="tap-48 rounded-xl text-muted hover:bg-surface-2 disabled:opacity-30"><ChevronRight aria-hidden="true" /></button>
          </div>
          <Card className="bg-primary-soft/60">
            <p className="text-sm text-muted">{estimate.paid ? t('wp.paid') : t('wp.expected')}</p>
            <p className="num text-4xl font-bold text-ink" data-testid="wp-estimate">{formatINR(estimate.paid ? estimate.paid.payload.paidPaise : estimate.s.paidPaise)}</p>
            {!estimate.paid && estimate.s.advanceRecoveredPaise > 0 && <p className="mt-1 text-sm text-muted">{t('wp.afterAdvance')} · {t('wp.advanceCut')}: {formatINR(estimate.s.advanceRecoveredPaise)}</p>}
            <p className="mt-1 text-xs text-muted">{estimate.paid ? t('wp.paidOn', { date: formatDay(estimate.paid.day, lang, 'medium') }) : t('wp.expectedHint')}</p>
          </Card>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[[t('wp.present'), att.present, 'text-received'], [t('wp.half'), att.half, 'text-accent-ink'], [t('wp.absent'), att.absent, 'text-given'], [t('wp.ot'), `${att.otHours}h`, 'text-ink']].map(([l, v, c]) => (
              <div key={String(l)} className="rounded-2xl border border-line bg-surface p-2"><p className={`num text-2xl font-bold ${c}`}>{v}</p><p className="text-xs text-muted">{l}</p></div>
            ))}
          </div>
          {worker.payType === 'piece' && pieces && <p className="text-sm text-ink">{t('wp.pieces')}: <span className="num font-medium">{pieces.count}</span> · {formatINR(pieces.amountPaise)}</p>}
          <Card><MonthGrid att={att} today={today} holidays={settings?.holidays} /></Card>
        </div>
      )}

      {tab === 'pay' && (
        <div className="flex flex-col gap-4">
          {byYear.length === 0 && <Card className="text-center text-muted">{t('wp.noPay')}</Card>}
          {byYear.map(([year, list]) => (
            <Card key={year}>
              <div className="mb-2 flex items-center justify-between"><CardTitle className="mb-0">{year}</CardTitle><span className="num text-lg font-bold text-received" data-testid={`year-total-${year}`}>{formatINR(list.reduce((s, p) => s + p.payload.paidPaise, 0))}</span></div>
              <p className="mb-2 text-xs text-muted">{t('wp.yearTotal', { year })}</p>
              <ul className="divide-y divide-line">
                {list.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setOpenPay(openPay === p.id ? null : p.id)} className="flex w-full items-center gap-3 py-3 text-left" aria-expanded={openPay === p.id}>
                      <div className="flex-1"><p className="font-medium text-ink">{formatMonth(p.payload.month, lang)}</p><p className="text-xs text-muted">{t('wp.paidOn', { date: formatDay(p.day, lang, 'short') })} · {t(`common.${p.payload.mode}`)}</p></div>
                      <span className="num text-lg font-bold text-ink">{formatINR(p.payload.paidPaise)}</span>
                      <ChevronDown aria-hidden="true" className={cn('text-muted transition-transform', openPay === p.id && 'rotate-180')} size={18} />
                    </button>
                    {openPay === p.id && (
                      <dl className="mb-3 rounded-xl bg-surface-2 p-3 text-sm">
                        <p className="num mb-1 text-xs text-muted">P {p.payload.snapshot.present} · H {p.payload.snapshot.half} · A {p.payload.snapshot.absent} · OT {p.payload.snapshot.otHours}h</p>
                        {slipLines(p.payload).map(([l, v], i) => <div key={i} className="flex justify-between py-0.5"><dt className="text-ink">{l}</dt><dd className={`num ${v < 0 ? 'text-given' : 'text-ink'}`}>{v < 0 ? '−' : ''}{formatINR(Math.abs(v), { paise: v % 100 !== 0 })}</dd></div>)}
                        <div className="mt-1 flex justify-between border-t border-line pt-1 font-bold"><dt>{t('wp.paid')}</dt><dd className="num">{formatINR(p.payload.paidPaise)}</dd></div>
                      </dl>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {tab === 'advance' && (
        <div className="flex flex-col gap-4">
          <Card className={balance > 0 ? 'bg-given-soft/50' : ''}><p className="text-sm text-muted">{t('wp.balance')}</p><p className={`num text-4xl font-bold ${balance > 0 ? 'text-given' : 'text-ink'}`} data-testid="wp-balance">{formatINR(balance)}</p></Card>
          <Card>
            {advances.length === 0 ? <p className="text-muted">{t('wp.noAdvance')}</p> : (
              <ul className="divide-y divide-line">{advances.map((a) => <li key={a.recId} className="flex items-center justify-between py-3"><div><p className="text-ink">{formatDay(a.day, lang, 'medium')}</p><p className="text-xs text-muted">{t('wp.taken')} · {t(`common.${a.mode}`)}{a.note ? ` · ${a.note}` : ''}</p></div><span className="num text-lg font-bold text-given">{formatINR(a.amountPaise)}</span></li>)}</ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'profile' && (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="mb-3 flex items-center gap-3"><Avatar name={worker.name} size={56} /><div><p className="text-xl font-medium text-ink">{worker.name}</p><Badge tone="info">{t(`worker.job.${worker.jobTitle}`)}</Badge></div></div>
            <dl className="divide-y divide-line text-base">
              {[[t('wp.payType'), t(`worker.payType.${worker.payType}`)], [t('wp.rate'), `${formatINR(rate)} / ${rateUnit}`], [t('wp.otRate'), `${formatINR(worker.otRatePaise)} / h`], [t('wp.joined'), formatDay(worker.joinedOn, lang, 'medium')], [t('wp.phone'), worker.phone ?? '—'], [t('wp.shop'), data.unitName]].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-3 py-2"><dt className="text-muted">{k}</dt><dd className="num text-right font-medium text-ink">{v}</dd></div>
              ))}
            </dl>
          </Card>
          {data.ownerPhone && <a href={waMeLink(data.ownerPhone, t('wp.askText', { name: worker.name }))} target="_blank" rel="noreferrer" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-received px-5 text-lg font-medium text-white shadow-card"><MessageCircle aria-hidden="true" />{t('wp.ask')}</a>}
          <button type="button" onClick={() => setConfirmForget(true)} className="text-sm text-muted underline">{t('wp.notMyPhone')}</button>
          <ConfirmSheet open={confirmForget} onClose={() => setConfirmForget(false)} onConfirm={() => { forgetWorker(); navigate('/w/join', { replace: true }); }} title={t('wp.notMyPhone')} message={t('wp.notMyPhoneHint')} />
        </div>
      )}
    </WorkerShell>
  );
}
