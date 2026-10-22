import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Building2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { StatTile, EmptyState } from '../components/ui/Feedback';
import { formatDay, formatTime } from '../domain/dates';
import { AdminShell } from './AdminShell';
import { AdminLoginPage } from './AdminLoginPage';
import { fetchUnits, getAdmin, type AdminUnitRow } from './api';

/** /admin — every unit on the server with pilot activity counts for the current month. */
export default function AdminUnitsPage() {
  const [authed, setAuthed] = useState(() => Boolean(getAdmin()));
  const [data, setData] = useState<{ month: string; units: AdminUnitRow[] } | null>(null);
  const [q, setQ] = useState('');
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => {
    if (!authed) return;
    void fetchUnits().then((d) => { if (!d) { setAuthed(Boolean(getAdmin())); setState('error'); return; } setData(d); setState('ok'); });
  }, [authed]);
  const rows = useMemo(() => (data?.units ?? []).filter((u) => `${u.name} ${u.ownerName} ${u.shortCode ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => ((b.lastAt ?? '') < (a.lastAt ?? '') ? -1 : 1)), [data, q]);
  if (!authed) return <AdminLoginPage onDone={() => setAuthed(true)} />;
  const totals = (data?.units ?? []).reduce((t, u) => ({ units: t.units + 1, workers: t.workers + u.workers, users: t.users + u.users, entries: t.entries + u.monthEntries }), { units: 0, workers: 0, users: 0, entries: 0 });
  return (
    <AdminShell>
      <h1 className="mb-1 text-2xl">All units</h1>
      <p className="mb-4 text-sm text-muted">{data ? `Month ${data.month}` : ''}</p>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Units" value={totals.units} testid="admin-units-count" />
        <StatTile label="Logins (owner + staff)" value={totals.users} />
        <StatTile label="Workers" value={totals.workers} />
        <StatTile label="Entries this month" value={totals.entries} tone="info" />
      </div>
      <div className="relative mb-3">
        <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input aria-label="Search units" placeholder="Search by unit, owner or shop code" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
      </div>
      {state === 'error' && <p role="alert" className="mb-3 text-given">Could not load units.</p>}
      {rows.length === 0 && state === 'ok' ? <EmptyState icon={<Building2 size={40} />} title="No units yet" hint="Units appear here as soon as an owner creates one in the app." /> : (
        <Card className="overflow-x-auto p-0">
          <table className="admin-table w-full text-sm" data-testid="admin-units">
            <thead><tr className="text-left text-muted"><th className="px-4 py-2 font-medium">Unit</th><th className="px-2 py-2 font-medium">Owner</th><th className="px-2 py-2 font-medium">Shop code</th><th className="px-2 py-2 text-right font-medium">Logins</th><th className="px-2 py-2 text-right font-medium">Workers</th><th className="px-2 py-2 text-right font-medium">Entries / days (month)</th><th className="px-2 py-2 font-medium">Last activity</th><th className="px-2 py-2 font-medium">Created</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.unitId} className="border-t border-line odd:bg-surface-2/40 hover:bg-primary-soft/40">
                  <td className="px-4 py-2"><Link to={`/admin/units/${u.unitId}`} className="font-medium text-primary hover:underline">{u.name}</Link></td>
                  <td className="px-2 py-2">{u.ownerName}{u.ownerPhone ? <span className="num block text-xs text-muted">{u.ownerPhone}</span> : null}</td>
                  <td className="num px-2 py-2">{u.shortCode ?? '—'}</td>
                  <td className="num px-2 py-2 text-right">{u.users}</td>
                  <td className="num px-2 py-2 text-right">{u.workers}</td>
                  <td className="num px-2 py-2 text-right">{u.monthEntries} / {u.monthDays}{u.monthDays === 0 && <Badge tone="warn" className="ml-2">idle</Badge>}</td>
                  <td className="px-2 py-2 text-muted">{u.lastAt ? `${formatDay(u.lastAt.slice(0, 10), 'en', 'short')} ${formatTime(u.lastAt, 'en')}` : '—'}</td>
                  <td className="px-2 py-2 text-muted">{formatDay(u.createdAt.slice(0, 10), 'en', 'short')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AdminShell>
  );
}
