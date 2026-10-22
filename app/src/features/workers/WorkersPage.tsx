import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Feedback';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { useRecords } from '../../db/hooks';
import type { WorkerP } from '../../db/types';
import { listWorkers } from '../../domain/masters';
import { allAdvanceBalances } from '../../domain/advances';
import { monthAttendance } from '../../domain/attendance';
import { formatINR } from '../../domain/money';
import { todayIST, monthOf } from '../../domain/ids';
import { can } from '../../domain/permissions';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { Avatar, PaySummary, JobBadge } from './shared';

export default function WorkersPage() {
  const { t } = useT();
  const { role } = useSession();
  const navigate = useNavigate();
  const recs = useRecords();
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const today = todayIST();
  const workers = useMemo(() => listWorkers(recs, !showInactive).filter((w) => w.name.toLowerCase().includes(q.trim().toLowerCase())), [recs, q, showInactive]);
  const balances = useMemo(() => allAdvanceBalances(recs, workers.map((w) => w.entityId)), [recs, workers]);
  const att = useMemo(() => new Map(workers.map((w) => [w.entityId, monthAttendance(recs, w.entityId, monthOf(today), today)])), [recs, workers, today]);
  const canManage = role ? can(role, 'worker.manage') : false;

  const card = (w: WorkerP) => (
    <Link to={`/workers/${w.entityId}`} className="card-hover flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card">
      <Avatar name={w.name} size={44} photoId={w.photoId} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{w.name}{!w.active && <Badge tone="neutral" className="ml-2">{t('common.inactive')}</Badge>}</p>
        <PaySummary w={w} />
      </div>
      <div className="text-right">
        <p className="num text-sm text-muted">P {att.get(w.entityId)?.present ?? 0} · A {att.get(w.entityId)?.absent ?? 0}</p>
        {(balances.get(w.entityId) ?? 0) > 0 && <p className="num text-sm font-medium text-given">{formatINR(balances.get(w.entityId)!)}</p>}
      </div>
    </Link>
  );

  return (
    <section>
      <PageHeader title={t('worker.title')} right={canManage && <Button size="md" onClick={() => navigate('/workers/new')}><Plus aria-hidden="true" size={18} />{t('action.add')}</Button>} />
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input aria-label={t('worker.search')} placeholder={t('worker.search')} value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
        </div>
        <label className="flex min-h-12 items-center gap-2 text-sm text-muted"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-5 w-5 accent-primary" />{t('worker.showInactive')}</label>
        <span className="num text-sm text-muted">{t('worker.count', { n: workers.length })}</span>
      </div>
      <ResponsiveTable<WorkerP>
        rows={workers}
        rowKey={(w) => w.entityId}
        onRowClick={(w) => navigate(`/workers/${w.entityId}`)}
        renderCard={card}
        empty={<EmptyState icon={<Users size={40} />} title={t('worker.empty')} hint={t('worker.emptyHint')} action={canManage && <Button onClick={() => navigate('/workers/new')}>{t('worker.new')}</Button>} />}
        columns={[
          { key: 'name', header: t('worker.name'), cell: (w) => <span className="flex items-center gap-2"><Avatar name={w.name} size={32} photoId={w.photoId} /><span className="font-medium">{w.name}</span>{!w.active && <Badge tone="neutral">{t('common.inactive')}</Badge>}</span> },
          { key: 'job', header: t('worker.jobTitle'), cell: (w) => <JobBadge w={w} /> },
          { key: 'pay', header: t('worker.payType'), cell: (w) => <PaySummary w={w} /> },
          { key: 'att', header: t('worker.thisMonth'), align: 'right', cell: (w) => <span className="num">P {att.get(w.entityId)?.present ?? 0} · H {att.get(w.entityId)?.half ?? 0} · A {att.get(w.entityId)?.absent ?? 0}</span> },
          { key: 'bal', header: t('worker.balance'), align: 'right', cell: (w) => <span className={`num ${(balances.get(w.entityId) ?? 0) > 0 ? 'text-given font-medium' : 'text-muted'}`}>{formatINR(balances.get(w.entityId) ?? 0)}</span> },
        ]}
      />
    </section>
  );
}
