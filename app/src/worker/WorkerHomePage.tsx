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
import { unitRules } from '../domain/settings';
import { monthAttendance, monthPieces } from '../domain/attendance';
import { wageInputsFor, computeGross, settle, rateOf, paidView, liveView } from '../domain/wage';
import { wageLineText, signedINR } from '../features/wages/lines';
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
import { effectiveModules } from '../domain/modules';

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
  const tabOn = (x: Tab) => { const m = effectiveModules(data?.org?.modules); return x === 'month' ? m.attendance : x === 'pay' ? m.wages : x === 'advance' ? m.advances : true; };
  const [tabPick, setTab] = useState<Tab>('month');
  const tab: Tab = tabOn(tabPick) ? tabPick : (TABS.find((x) => tabOn(x.v))?.v ?? 'profile');
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
  const rules = useMemo(() => unitRules(settings), [settings]);
  const worker = data?.worker;
  const att = useMemo(() => (worker ? monthAttendance(recs, worker.entityId, month, month === monthOf(today) ? today : `${month}-31`, settings) : null), [recs, worker, month, today, settings]);
  const pieces = useMemo(() => (worker ? monthPieces(recs, worker.entityId, month) : null), [recs, worker, month]);
  const estimate = useMemo(() => {
    if (!worker) return null;
    const inputs = wageInputsFor(recs, worker, month, settings);
    const b = computeGross(inputs);
    const paid = recsOfType<WagePaymentP>(recs, 'wage_payment').find((r) => r.payload.workerId === worker.entityId && r.payload.month === month);
    const outstanding = advanceBalance(recs, worker.entityId);
    const s = settle(b, [], outstanding);
    // SPEC-M16 §1: a paid month shows only what was saved with the payment.
    return { s, paid, view: paid ? paidView(paid.payload) : liveView(inputs, b, s) };
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
  // SPEC-M16 §1: the same lines as the owner's pay screen, built only from the saved payment.
  // SPEC-M14 AC5: a line the owner changed is marked "मालिक ने बदला".
  const slipLines = (p: WagePaymentP): [string, number, boolean][] => paidView(p).lines.map((l) => [l.kind === 'advance' ? t('wp.advanceCut') : wageLineText(l, t), l.amountPaise, 'override' in l && Boolean(l.override)]);
  const showOt = (otPaise = 0) => rules.overtimeEnabled || otPaise !== 0;
  const monthCounts = estimate.paid
    ? { present: estimate.view.present, half: estimate.view.half, absent: estimate.view.absent, otHours: estimate.view.otHours }
    : { present: att.present, half: att.half, absent: att.absent, otHours: att.otHours };

  return (
    <WorkerShell industry={data.org?.industry} header={
      <div className="flex items-center gap-3">
        <Avatar name={worker.name} size={48} />
        <div className="min-w-0"><p className="truncate text-sm text-muted">{data.unitName}</p><h1 className="truncate text-2xl">{t('wp.hello', { name: worker.name })}</h1></div>
      </div>
    }>
      <p className="mb-3 text-sm text-muted">{state === 'stale' ? t('wp.offline') + ' · ' : ''}{t('wp.updated', { time: formatTime(data.fetchedAt, lang) })}</p>
      <div className="mb-4 grid grid-flow-col auto-cols-fr gap-1 rounded-2xl border border-line bg-surface-2 p-1" role="tablist" aria-label={t('wp.title')}>
        {TABS.filter((x) => tabOn(x.v)).map((x) => (
          <button key={x.v} role="tab" aria-selected={tab === x.v} onClick={() => setTab(x.v)} className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-medium transition-colors [&_svg]:stroke-[1.75]', tab === x.v ? 'border-line bg-surface text-ink [&_svg]:text-primary' : 'border-transparent text-muted hover:text-ink')}>{x.icon}<span>{t(x.key)}</span></button>
        ))}
      </div>

      {tab === 'month' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setMonth(prevMonth(month))} aria-label={t('action.back')} className="tap-48 rounded-xl text-muted hover:bg-surface-2"><ChevronLeft aria-hidden="true" /></button>
            <span className="text-lg font-medium text-ink">{formatMonth(month, lang)}</span>
            <button type="button" onClick={() => setMonth(nextMonth(month))} disabled={month >= monthOf(today)} aria-label={t('action.next')} className="tap-48 rounded-xl text-muted hover:bg-surface-2 disabled:opacity-30"><ChevronRight aria-hidden="true" /></button>
          </div>
          <Card>
            <p className="text-sm text-muted">{estimate.paid ? t('wp.paid') : t('wp.expected')}</p>
            <p className="num font-display text-4xl font-medium text-ink" data-testid="wp-estimate">{formatINR(estimate.view.paidPaise)}</p>
            {!estimate.paid && estimate.s.advanceRecoveredPaise > 0 && <p className="mt-1 text-sm text-muted">{t('wp.afterAdvance')} · {t('wp.advanceCut')}: {formatINR(estimate.s.advanceRecoveredPaise)}</p>}
            <p className="mt-1 text-sm text-muted">{estimate.paid ? t('wp.paidOn', { date: formatDay(estimate.paid.day, lang, 'medium') }) : t('wp.expectedHint')}</p>
          </Card>
          <div className="grid grid-flow-col auto-cols-fr gap-px overflow-hidden rounded-2xl border border-line bg-line text-center">
            {[[t('wp.present'), monthCounts.present, 'text-received'], [t('wp.half'), monthCounts.half, 'text-accent-ink'], [t('wp.absent'), monthCounts.absent, 'text-given'], ...(showOt(estimate.paid?.payload.otPaise) ? [[t('wp.ot'), `${monthCounts.otHours}h`, 'text-ink']] : [])].map(([l, v, c]) => (
              <div key={String(l)} className="bg-surface px-2 py-3" data-testid={`wp-count-${String(l)}`}><p className={`num text-2xl font-medium ${v === 0 ? 'text-muted' : c}`}>{v}</p><p className="text-sm text-muted">{l}</p></div>
            ))}
          </div>
          {worker.payType === 'piece' && pieces && <p className="text-sm text-ink">{t('wp.pieces')}: <span className="num font-medium">{pieces.count}</span> · {formatINR(pieces.amountPaise)}</p>}
          <Card><MonthGrid att={att} today={today} holidays={settings?.holidays} showOt={rules.overtimeEnabled} /></Card>
        </div>
      )}

      {tab === 'pay' && (
        <div className="flex flex-col gap-4">
          {byYear.length === 0 && <Card className="text-center text-muted">{t('wp.noPay')}</Card>}
          {byYear.map(([year, list]) => (
            <Card key={year}>
              <div className="mb-2 flex items-center justify-between"><CardTitle className="mb-0">{year}</CardTitle><span className="num text-lg font-medium text-received" data-testid={`year-total-${year}`}>{formatINR(list.reduce((s, p) => s + p.payload.paidPaise, 0))}</span></div>
              <p className="mb-2 text-sm text-muted">{t('wp.yearTotal', { year })}</p>
              <ul className="divide-y divide-line">
                {list.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setOpenPay(openPay === p.id ? null : p.id)} className="flex w-full items-center gap-3 py-3 text-left" aria-expanded={openPay === p.id}>
                      <div className="flex-1"><p className="font-medium text-ink">{formatMonth(p.payload.month, lang)}</p><p className="text-sm text-muted">{t('wp.paidOn', { date: formatDay(p.day, lang, 'short') })} · {t(`common.${p.payload.mode}`)}</p></div>
                      <span className="num text-lg font-medium text-ink">{formatINR(p.payload.paidPaise)}</span>
                      <ChevronDown aria-hidden="true" className={cn('text-muted transition-transform', openPay === p.id && 'rotate-180')} size={18} />
                    </button>
                    {openPay === p.id && (
                      <dl className="mb-3 rounded-xl bg-surface-2 p-3 text-sm">
                        <p className="num mb-1 text-sm text-muted">P {p.payload.snapshot.present} · H {p.payload.snapshot.half} · A {p.payload.snapshot.absent}{showOt(p.payload.otPaise) ? ` · OT ${p.payload.snapshot.otHours}h` : ''}</p>
                        {slipLines(p.payload).map(([l, v, changed], i) => <div key={i} className="flex justify-between py-0.5" data-testid="wp-slip-line"><dt className="text-ink">{l}{changed && <span className="ml-1 rounded-md bg-accent-soft px-1.5 text-sm font-medium text-accent-ink" data-testid="wp-owner-changed">{t('wp.ownerChanged')}</span>}</dt><dd className={`num ${v < 0 ? 'text-given' : 'text-ink'}`}>{signedINR(v)}</dd></div>)}
                        <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold"><dt>{t('wp.paid')}</dt><dd className="num">{formatINR(p.payload.paidPaise)}</dd></div>
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
          <Card><p className="text-sm text-muted">{t('wp.balance')}</p><p className={`num font-display text-4xl font-medium ${balance > 0 ? 'text-given' : 'text-muted'}`} data-testid="wp-balance">{formatINR(balance)}</p></Card>
          <Card>
            {advances.length === 0 ? <p className="text-muted">{t('wp.noAdvance')}</p> : (
              <ul className="divide-y divide-line">{advances.map((a) => <li key={a.recId} className="flex items-center justify-between py-3"><div><p className="text-ink">{formatDay(a.day, lang, 'medium')}</p><p className="text-sm text-muted">{t('wp.taken')} · {t(`common.${a.mode}`)}{a.note ? ` · ${a.note}` : ''}</p></div><span className="num text-lg font-medium text-given">{formatINR(a.amountPaise)}</span></li>)}</ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'profile' && (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="mb-3 flex items-center gap-3"><Avatar name={worker.name} size={56} /><div><p className="text-xl font-medium text-ink">{worker.name}</p><Badge tone="neutral">{t(`worker.job.${worker.jobTitle}`)}</Badge></div></div>
            <dl className="divide-y divide-line text-base">
              {[[t('wp.payType'), t(`worker.payType.${worker.payType}`)], [t('wp.rate'), `${formatINR(rate)} / ${rateUnit}`], ...(rules.overtimeEnabled ? [[t('wp.otRate'), `${formatINR(worker.otRatePaise)} / h`]] : []), [t('wp.joined'), formatDay(worker.joinedOn, lang, 'medium')], [t('wp.phone'), worker.phone ?? '—'], [t('wp.shop'), data.unitName]].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-3 py-2"><dt className="text-muted">{k}</dt><dd className="num text-right font-medium text-ink">{v}</dd></div>
              ))}
            </dl>
          </Card>
          {data.ownerPhone && <a href={waMeLink(data.ownerPhone, t('wp.askText', { name: worker.name }))} target="_blank" rel="noreferrer" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-received px-5 text-lg font-medium text-on-fill transition-transform active:scale-[0.98]"><MessageCircle aria-hidden="true" />{t('wp.ask')}</a>}
          <button type="button" onClick={() => setConfirmForget(true)} className="min-h-11 text-sm text-muted underline underline-offset-4 hover:text-ink">{t('wp.notMyPhone')}</button>
          <ConfirmSheet open={confirmForget} onClose={() => setConfirmForget(false)} onConfirm={() => { forgetWorker(); navigate('/w/join', { replace: true }); }} title={t('wp.notMyPhone')} message={t('wp.notMyPhoneHint')} />
        </div>
      )}
    </WorkerShell>
  );
}
