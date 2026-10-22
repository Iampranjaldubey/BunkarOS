import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pencil, Wallet, Link2, Copy, Ban, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatTile, EmptyState } from '../../components/ui/Feedback';
import { PageGrid } from '../../components/ui/PageGrid';
import { ConfirmSheet } from '../../components/ui/Sheet';
import { PreviewShareSheet } from '../../components/ui/PreviewShareSheet';
import { useToast } from '../../components/ui/Toast';
import { authedFetch } from '../../sync';
import { MonthGrid } from './MonthGrid';
import { newAccessCode } from './WorkerFormPage';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { WorkerP } from '../../db/types';
import { listWorkers, getSettings, nameMaps } from '../../domain/masters';
import { monthAttendance, monthPieces } from '../../domain/attendance';
import { advancesFor, advanceBalance, lastPayment } from '../../domain/advances';
import { formatINR } from '../../domain/money';
import { formatDay, formatMonth } from '../../domain/dates';
import { todayIST, monthOf, prevMonth, nextMonth } from '../../domain/ids';
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
  const toast = useToast();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
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

  // SPEC-M07: worker's own page — link (server-side token) + 4-digit access code (on the record).
  const workerUrl = (tok: string) => `${window.location.origin}/w/${tok}`;
  const getLink = async (regenerate = false): Promise<string | null> => {
    if (!navigator.onLine) { toast.show(t('worker.linkOffline'), 'error'); return null; }
    setLinkBusy(true);
    try {
      const r = await authedFetch('/api/worker-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workerId: w.entityId, regenerate }) });
      if (!r.ok) { toast.show(t('wp.error'), 'error'); return null; }
      const b = (await r.json()) as { token: string };
      setLinkToken(b.token);
      return b.token;
    } catch { toast.show(t('worker.linkOffline'), 'error'); return null; } finally { setLinkBusy(false); }
  };
  const sendLink = async () => { const tok = await getLink(); if (tok) setShareOpen(true); };
  const copyLink = async () => { const tok = linkToken ?? (await getLink()); if (!tok) return; try { await navigator.clipboard.writeText(workerUrl(tok)); toast.show(t('worker.linkCopied'), 'success'); } catch { /* ignore */ } };
  const cancelLink = async () => {
    if (!navigator.onLine) { toast.show(t('worker.linkOffline'), 'error'); return; }
    const r = await authedFetch('/api/worker-links/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workerId: w.entityId }) });
    if (r.ok || r.status === 204) { setLinkToken(null); toast.show(t('worker.linkCancelled'), 'success'); }
  };
  const regenerateCode = async () => { await addRecord<WorkerP>('worker', { ...w, accessCode: newAccessCode() }); toast.show(t('action.done'), 'success'); };
  const linkText = t('worker.linkText', { name: w.name, unit: settings?.unitName ?? '', url: linkToken ? workerUrl(linkToken) : '' });

  return (
    <section>
      <PageHeader title={w.name} back right={canManage && <Button size="md" variant="secondary" onClick={() => navigate(`/workers/${w.entityId}/edit`)}><Pencil aria-hidden="true" size={16} />{t('action.edit')}</Button>} />
      <PageGrid
        aside={
          <div className="flex flex-col gap-4">
            <Card className="flex items-center gap-3">
              <Avatar name={w.name} size={56} photoId={w.photoId} />
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
            {canManage && w.active && (
              <Card data-testid="worker-link-card">
                <CardTitle className="flex items-center gap-2"><Link2 aria-hidden="true" size={18} />{t('worker.link')}</CardTitle>
                <div className="mb-3 flex items-center justify-between rounded-xl bg-surface-2 p-3">
                  <div><p className="text-xs text-muted">{t('worker.accessCode')}</p><p className="num text-2xl font-bold tracking-[0.3em] text-ink" data-testid="worker-access-code">{w.accessCode ?? '—'}</p></div>
                  <Button size="md" variant="ghost" onClick={() => void regenerateCode()} aria-label={t('worker.newCode')}><RefreshCw aria-hidden="true" size={16} />{t('worker.newCode')}</Button>
                </div>
                <p className="mb-3 text-xs text-muted">{t('worker.accessCodeHint')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="md" disabled={linkBusy} onClick={() => void sendLink()} data-testid="send-link"><Link2 aria-hidden="true" size={16} />{t('worker.sendLink')}</Button>
                  <Button size="md" variant="secondary" disabled={linkBusy} onClick={() => void copyLink()} data-testid="copy-link"><Copy aria-hidden="true" size={16} />{t('worker.copyLink')}</Button>
                  <Button size="md" variant="ghost" className="col-span-2 text-given" onClick={() => void cancelLink()} data-testid="cancel-link"><Ban aria-hidden="true" size={16} />{t('worker.cancelLink')}</Button>
                </div>
              </Card>
            )}
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
            <MonthGrid att={att} today={today} holidays={settings?.holidays} />
            {w.payType === 'piece' && pieces && <p className="mt-2 text-sm text-ink">{t('att.pieces')}: <span className="num font-medium">{pieces.count}</span> · {formatINR(pieces.amountPaise)}</p>}
            {last && <p className="mt-2 text-sm text-muted">{t('worker.lastPayment')}: {formatMonth(last.payload.month, lang)} · {formatINR(last.payload.paidPaise)} · {t('common.by', { name: names.users.get(last.by) ?? '' })}</p>}
            <Link to={`/wages/${month}/${w.entityId}`} className="mt-3 inline-block text-sm font-medium text-primary">{t('nav.wages')} →</Link>
          </Card>
        }
      />
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} onConfirm={() => void toggleActive()} title={w.active ? t('worker.deactivate') : t('worker.reactivate')} message={w.name} />
      <PreviewShareSheet open={shareOpen} onClose={() => setShareOpen(false)} recipientName={w.name} phone={w.phone ?? ''} text={linkText} />
    </section>
  );
}
