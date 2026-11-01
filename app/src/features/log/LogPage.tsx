import { useMemo, useState } from 'react';
import { Lock, Undo2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select, Textarea } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import { EmptyState } from '../../components/ui/Feedback';
import { useIsDesktop } from '../../components/ui/useIsDesktop';
import { useRecords } from '../../db/hooks';
import { reverse } from '../../db/repo';
import type { Rec, RecordType, ReversalP } from '../../db/types';
import { nameMaps } from '../../domain/masters';
import { useCan } from '../../app/useCan';
import { isRecordLocked, lockedMonths } from '../../domain/locks';
import { formatDay, formatTime } from '../../domain/dates';
import { istDay, todayIST } from '../../domain/ids';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';
import { describeRecord } from './describe';

/** Entry log: every record, newest first, with author, time, reversals and edits. Filter by user and type; a table on desktop. */
export default function LogPage() {
  const { t, lang } = useT();
  const { role, user } = useSession();
  const recs = useRecords();
  const isDesktop = useIsDesktop();
  const allowed = useCan();
  const [filterUser, setFilterUser] = useState('');
  const [filterType, setFilterType] = useState<RecordType | ''>('');
  const [target, setTarget] = useState<Rec | null>(null);
  const [reason, setReason] = useState('');
  const names = useMemo(() => nameMaps(recs), [recs]);

  const reversedBy = useMemo(() => {
    const m = new Map<string, Rec<ReversalP>>();
    for (const r of recs) if (r.type === 'reversal' && r.sync !== 'rejected') m.set((r.payload as ReversalP).targetId, r as Rec<ReversalP>);
    return m;
  }, [recs]);

  const byId = useMemo(() => new Map(recs.map((r) => [r.id, r])), [recs]);
  // SPEC-M14: unlocking a month and reversing a payment are steps of a correction, so they get their own rows.
  // SPEC-M15: so do releasing a reservation and undoing a sale or write-off.
  const listed = useMemo(() => {
    const isStep = (r: Rec) => r.type === 'reversal' && ['period_lock', 'wage_payment', 'carpet_reserve', 'carpet_out'].includes(byId.get((r.payload as ReversalP).targetId)?.type ?? '');
    return recs.filter((r) => r.type !== 'usage' && (r.type !== 'reversal' || isStep(r)));
  }, [recs, byId]);
  const types = useMemo(() => [...new Set(listed.map((r) => r.type))].sort((a, b) => t(`rec.${a}`).localeCompare(t(`rec.${b}`))), [listed, t]);
  const rows = useMemo(() => {
    const list = listed.filter((r) => (!filterUser || r.by === filterUser) && (!filterType || r.type === filterType));
    return [...list].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 300);
  }, [listed, filterUser, filterType]);

  const locked = useMemo(() => lockedMonths(recs), [recs]);
  const isLocked = (r: Rec) => isRecordLocked(locked, r);
  const canReverse = (r: Rec) => {
    if (!role) return false;
    if (reversedBy.has(r.id) || r.type === 'period_lock' || r.type === 'reversal') return false;
    if (isLocked(r)) return false; // SPEC-M16 §2: unlock the month first (owner, on the wage sheet)
    if (allowed('record.reverse.any')) return true;
    const today = todayIST();
    if (allowed('record.reverse.ownToday') && r.by === user?.id && r.day === today) return true;
    return allowed('record.reverse.past') && r.day < today; // "edit past entries" (SPEC-M13)
  };

  const doReverse = async () => {
    if (!target || !reason.trim()) return;
    await reverse(target.id, reason.trim());
    setTarget(null); setReason('');
  };

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label={t('log.filterType')} value={filterType} onChange={(e) => setFilterType(e.target.value as RecordType | '')} className="min-h-11 w-auto py-1 text-sm" data-testid="log-filter-type">
        <option value="">{t('log.allTypes')}</option>
        {types.map((ty) => <option key={ty} value={ty}>{t(`rec.${ty}`)}</option>)}
      </Select>
      <Select aria-label={t('log.filterUser')} value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="min-h-11 w-auto py-1 text-sm">
        <option value="">{t('common.all')}</option>
        {[...names.users].map(([id, n]) => <option key={id} value={id}>{n}</option>)}
      </Select>
    </div>
  );
  const byName = (id: string) => names.users.get(id) ?? id.slice(0, 8);
  const badges = (r: Rec) => {
    const rev = reversedBy.get(r.id);
    return (
      <>
        {r.replaces && <Badge tone="info">{t('common.edited')}</Badge>}
        {rev && <Badge tone="danger">{t('common.reversed')}</Badge>}
        {r.sync === 'rejected' && <Badge tone="danger">{t('common.rejected')}</Badge>}
      </>
    );
  };
  const lockMark = (r: Rec) => !reversedBy.has(r.id) && isLocked(r) && (
    <span className="inline-flex h-11 w-11 items-center justify-center text-muted" title={t('log.lockedMonth')} data-testid="log-locked">
      <Lock aria-hidden="true" size={18} /><span className="visually-hidden">{t('log.lockedMonth')}</span>
    </span>
  );
  const undoBtn = (r: Rec) => canReverse(r) && (
    <button type="button" onClick={() => setTarget(r)} aria-label={t('log.reverse')} title={t('log.reverse')} className="tap-48 inline-flex items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-given lg:h-11 lg:min-h-0 lg:w-11 lg:min-w-0"><Undo2 aria-hidden="true" /></button>
  );

  return (
    <section>
      <PageHeader title={t('log.title')} right={isDesktop ? <><span className="num text-sm text-muted">{t('log.shown', { n: rows.length })}</span>{filters}</> : undefined} />
      {!isDesktop && <div className="mb-3">{filters}</div>}
      {rows.length === 0 ? <EmptyState title={t('log.empty')} /> : isDesktop ? (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full border-collapse text-base" data-testid="log-table">
            <thead>
              <tr className="text-left text-sm text-muted">
                <th scope="col" className="w-44 border-b border-line px-4 py-3 font-medium">{t('log.colWhen')}</th>
                <th scope="col" className="w-40 border-b border-line px-4 py-3 font-medium">{t('log.colType')}</th>
                <th scope="col" className="border-b border-line px-4 py-3 font-medium">{t('log.colWhat')}</th>
                <th scope="col" className="w-44 border-b border-line px-4 py-3 font-medium">{t('log.colBy')}</th>
                <th scope="col" className="w-16 border-b border-line px-2 py-3"><span className="visually-hidden">{t('log.reverse')}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rev = reversedBy.get(r.id);
                const d = describeRecord(r, names, t, lang, byId);
                return (
                  <tr key={r.id} className={cn('align-top even:bg-bg/60', rev && 'text-muted')} data-testid="log-row">
                    <td className="border-b border-line px-4 py-2.5 text-sm">
                      <span className="num block text-ink">{formatDay(r.day, lang, 'short')}</span>
                      <span className="num block text-muted">{formatTime(r.at, lang)}{r.day !== istDay(r.at) ? ` · ${t('log.enteredOn', { day: formatDay(istDay(r.at), lang, 'short') })}` : ''}</span>
                    </td>
                    <td className="border-b border-line px-4 py-2.5"><Badge tone={d.tone}>{t(`rec.${r.type}`)}</Badge></td>
                    <td className="border-b border-line px-4 py-2.5">
                      <p className={cn('text-ink', rev && 'text-muted line-through')}>{d.text}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">{badges(r)}</div>
                      {rev && <p className="mt-1 text-sm text-given">{t('log.reason')}: {rev.payload.reason} — {t('common.by', { name: byName(rev.by) })}</p>}
                      {r.rejectReason && <p className="mt-1 text-sm text-given">{r.rejectReason}</p>}
                    </td>
                    <td className="border-b border-line px-4 py-2.5 text-sm text-ink">{byName(r.by)}</td>
                    <td className="border-b border-line px-2 py-1.5 text-right">{undoBtn(r) || lockMark(r)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r) => {
            const rev = reversedBy.get(r.id);
            const d = describeRecord(r, names, t, lang, byId);
            return (
              <li key={r.id}>
                <Card className={`flex gap-3 p-3 ${rev ? 'opacity-70' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={d.tone}>{t(`rec.${r.type}`)}</Badge>
                      {badges(r)}
                    </div>
                    <p className={`mt-1 text-base text-ink ${rev ? 'line-through' : ''}`}>{d.text}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {t('common.by', { name: byName(r.by) })} · {formatDay(r.day, lang, 'short')} · {formatTime(r.at, lang)}
                      {r.day !== istDay(r.at) && ` (${t('log.day')}: ${formatDay(r.day, lang, 'short')})`}
                    </p>
                    {rev && <p className="mt-1 text-sm text-given">{t('log.reason')}: {rev.payload.reason} — {t('common.by', { name: byName(rev.by) })}</p>}
                    {r.rejectReason && <p className="mt-1 text-sm text-given">{r.rejectReason}</p>}
                  </div>
                  <div className="self-start">{undoBtn(r) || lockMark(r)}</div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
      <Sheet open={Boolean(target)} onClose={() => setTarget(null)} title={t('log.reverse')}
        footer={<Button block variant="danger" disabled={!reason.trim()} onClick={() => void doReverse()}>{t('action.reverse')}</Button>}>
        {target && <p className="mb-3 text-ink">{describeRecord(target, names, t, lang, byId).text}</p>}
        <label className="mb-1 block text-sm font-medium text-muted" htmlFor="rev-reason">{t('log.reverseWhy')}</label>
        <Textarea id="rev-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
      </Sheet>
    </section>
  );
}
