import { useMemo, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select, Textarea } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import { EmptyState } from '../../components/ui/Feedback';
import { useRecords } from '../../db/hooks';
import { reverse } from '../../db/repo';
import type { Rec, ReversalP } from '../../db/types';
import { nameMaps } from '../../domain/masters';
import { can } from '../../domain/permissions';
import { formatDay, formatTime } from '../../domain/dates';
import { todayIST } from '../../domain/ids';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { describeRecord } from './describe';

/** Entry log: every record, newest first, with author, time, reversals and edits. */
export default function LogPage() {
  const { t, lang } = useT();
  const { role, user } = useSession();
  const recs = useRecords();
  const [filterUser, setFilterUser] = useState('');
  const [target, setTarget] = useState<Rec | null>(null);
  const [reason, setReason] = useState('');
  const names = useMemo(() => nameMaps(recs), [recs]);

  const reversedBy = useMemo(() => {
    const m = new Map<string, Rec<ReversalP>>();
    for (const r of recs) if (r.type === 'reversal' && r.sync !== 'rejected') m.set((r.payload as ReversalP).targetId, r as Rec<ReversalP>);
    return m;
  }, [recs]);

  const rows = useMemo(() => {
    const list = recs.filter((r) => r.type !== 'usage' && r.type !== 'reversal' && (!filterUser || r.by === filterUser));
    return [...list].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 300);
  }, [recs, filterUser]);

  const canReverse = (r: Rec) => {
    if (!role) return false;
    if (reversedBy.has(r.id) || r.type === 'period_lock') return false;
    if (can(role, 'record.reverse.any')) return true;
    return can(role, 'record.reverse.ownToday') && r.by === user?.id && r.day === todayIST();
  };

  const doReverse = async () => {
    if (!target || !reason.trim()) return;
    await reverse(target.id, reason.trim());
    setTarget(null); setReason('');
  };

  return (
    <section>
      <PageHeader title={t('log.title')} right={
        <Select aria-label={t('log.filterUser')} value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="min-h-10 py-1 text-sm">
          <option value="">{t('common.all')}</option>
          {[...names.users].map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </Select>
      } />
      {rows.length === 0 ? <EmptyState title={t('log.empty')} /> : (
        <ol className="flex flex-col gap-2">
          {rows.map((r) => {
            const rev = reversedBy.get(r.id);
            const d = describeRecord(r, names, t, lang);
            return (
              <li key={r.id}>
                <Card className={`flex gap-3 p-3 ${rev ? 'opacity-70' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={d.tone}>{t(`rec.${r.type}`)}</Badge>
                      {r.replaces && <Badge tone="info">{t('common.edited')}</Badge>}
                      {rev && <Badge tone="danger">{t('common.reversed')}</Badge>}
                      {r.sync === 'rejected' && <Badge tone="danger">{t('common.rejected')}</Badge>}
                    </div>
                    <p className={`mt-1 text-base text-ink ${rev ? 'line-through' : ''}`}>{d.text}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {t('common.by', { name: names.users.get(r.by) ?? r.by.slice(0, 8) })} · {formatDay(r.day, lang, 'short')} · {formatTime(r.at, lang)}
                      {r.day !== r.at.slice(0, 10) && ` (${t('log.day')}: ${formatDay(r.day, lang, 'short')})`}
                    </p>
                    {rev && <p className="mt-1 text-sm text-given">{t('log.reason')}: {rev.payload.reason} — {t('common.by', { name: names.users.get(rev.by) ?? '' })}</p>}
                    {r.rejectReason && <p className="mt-1 text-sm text-given">{r.rejectReason}</p>}
                  </div>
                  {canReverse(r) && (
                    <button type="button" onClick={() => setTarget(r)} aria-label={t('log.reverse')} className="tap-48 self-start rounded-xl text-muted hover:bg-surface-2 hover:text-given"><Undo2 aria-hidden="true" /></button>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      )}
      <Sheet open={Boolean(target)} onClose={() => setTarget(null)} title={t('log.reverse')}
        footer={<Button block variant="danger" disabled={!reason.trim()} onClick={() => void doReverse()}>{t('action.reverse')}</Button>}>
        {target && <p className="mb-3 text-ink">{describeRecord(target, names, t, lang).text}</p>}
        <label className="mb-1 block text-sm font-medium text-muted" htmlFor="rev-reason">{t('log.reverseWhy')}</label>
        <Textarea id="rev-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
      </Sheet>
    </section>
  );
}
