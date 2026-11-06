import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Dot } from '../components/ui/Badge';
import { StatTile, StatRow, EmptyState } from '../components/ui/Feedback';
import { ResponsiveTable } from '../components/ui/ResponsiveTable';
import { formatDay, formatTime } from '../domain/dates';
import { AdminShell } from './AdminShell';
import { AdminLoginPage } from './AdminLoginPage';
import { fetchUnits, getAdmin, type AdminUnitRow } from './api';
import { INDUSTRY_LABEL, STATUS_LABEL, STATUS_TONE, monthName } from './labels';

const when = (iso: string | null) => (iso ? `${formatDay(iso.slice(0, 10), 'en', 'short')} ${formatTime(iso, 'en')}` : '—');

/** /admin — every organisation with its industry, status and this month's use (SPEC-M18 §7). */
export default function AdminUnitsPage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => Boolean(getAdmin()));
  const [data, setData] = useState<{ month: string; units: AdminUnitRow[] } | null>(null);
  const [q, setQ] = useState('');
  const [industry, setIndustry] = useState('');
  const [status, setStatus] = useState('');
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => {
    if (!authed) return;
    void fetchUnits().then((d) => { if (!d) { setAuthed(Boolean(getAdmin())); setState('error'); return; } setData(d); setState('ok'); });
  }, [authed]);
  const rows = useMemo(() => (data?.units ?? [])
    .filter((u) => (!industry || u.industry === industry) && (!status || u.status === status))
    .filter((u) => `${u.name} ${u.ownerName || u.invite?.ownerName || ''} ${u.shortCode ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => ((b.lastAt ?? b.createdAt) < (a.lastAt ?? a.createdAt) ? -1 : 1)), [data, q, industry, status]);
  if (!authed) return <AdminLoginPage onDone={() => setAuthed(true)} />;
  const all = data?.units ?? [];
  const totals = { orgs: all.length, active: all.filter((u) => u.status === 'active').length, invited: all.filter((u) => u.status === 'invited').length, entries: all.reduce((s, u) => s + u.monthEntries, 0) };
  return (
    <AdminShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><p className="mb-0.5 text-sm text-muted">{data ? monthName(data.month) : ''}</p><h1 className="text-3xl">Organisations</h1></div>
        <Button size="md" onClick={() => navigate('/admin/new')} data-testid="new-org"><Plus aria-hidden="true" size={18} />New organisation</Button>
      </header>
      <StatRow className="mb-6 grid-cols-2 md:grid-cols-4">
        <StatTile label="Organisations" value={totals.orgs} testid="admin-units-count" />
        <StatTile label="Active" value={totals.active} />
        <StatTile label="Waiting for the owner" value={totals.invited} />
        <StatTile label="Entries this month" value={totals.entries} />
      </StatRow>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input aria-label="Search organisations" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
        </div>
        <Select aria-label="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="md:w-44"><option value="">All industries</option><option value="carpet">Carpet</option><option value="bags">Bags</option></Select>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="md:w-44"><option value="">All statuses</option><option value="active">Active</option><option value="invited">Invited</option><option value="paused">Paused</option></Select>
      </div>
      {state === 'error' && <p role="alert" className="mb-3 text-given">Could not load organisations.</p>}
      <ResponsiveTable<AdminUnitRow>
        rows={rows} rowKey={(u) => u.unitId} testid="admin-units" onRowClick={(u) => navigate(`/admin/units/${u.unitId}`)}
        empty={state === 'ok' ? <EmptyState icon={<Building2 size={36} />} title={all.length ? 'No organisation matches' : 'No organisations yet'} hint={all.length ? undefined : 'Create one and send the owner the invite.'} action={!all.length && <Button onClick={() => navigate('/admin/new')}>New organisation</Button>} /> : undefined}
        renderCard={(u) => (
          <button type="button" onClick={() => navigate(`/admin/units/${u.unitId}`)} className="card-hover flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left">
            <div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{u.name}</p><p className="truncate text-sm text-muted">{INDUSTRY_LABEL[u.industry] ?? u.industry} · {u.ownerName || u.invite?.ownerName || '—'}</p></div>
            <div className="flex flex-col items-end gap-1"><Dot tone={STATUS_TONE[u.status]}>{STATUS_LABEL[u.status]}</Dot><span className="num text-sm text-muted">{u.monthEntries}</span></div>
          </button>
        )}
        columns={[
          { key: 'name', header: 'Name', cell: (u) => <span className="font-medium">{u.name}</span> },
          { key: 'industry', header: 'Industry', cell: (u) => <span className="text-ink-2">{INDUSTRY_LABEL[u.industry] ?? u.industry}</span> },
          { key: 'owner', header: 'Owner', cell: (u) => <span>{u.ownerName || u.invite?.ownerName || '—'}<span className="num block text-sm text-muted">{u.ownerPhone || u.invite?.ownerPhone || ''}</span></span> },
          { key: 'status', header: 'Status', cell: (u) => <Dot tone={STATUS_TONE[u.status]}>{STATUS_LABEL[u.status]}{u.status === 'invited' && u.invite && u.invite.state !== 'open' ? ` · invite ${u.invite.state}` : ''}</Dot> },
          { key: 'last', header: 'Last used', cell: (u) => <span className="text-sm text-ink-2">{when(u.lastAt)}</span> },
          { key: 'entries', header: 'Entries this month', align: 'right', cell: (u) => <span className={u.monthEntries ? 'num' : 'num text-muted'}>{u.monthEntries}</span> },
        ]}
      />
    </AdminShell>
  );
}
