import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, PauseCircle, PlayCircle, RefreshCw, XCircle } from 'lucide-react';
import { Card, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dot } from '../components/ui/Badge';
import { Field } from '../components/ui/Field';
import { Input, Textarea } from '../components/ui/Input';
import { Switch } from '../components/ui/Switch';
import { Sheet } from '../components/ui/Sheet';
import { StatTile, StatRow, EmptyState } from '../components/ui/Feedback';
import { useToast } from '../components/ui/Toast';
import { formatDay, formatTime } from '../domain/dates';
import { MODULES, effectiveModules } from '../domain/modules';
import { cn } from '../lib/utils';
import { AdminShell } from './AdminShell';
import { AdminLoginPage } from './AdminLoginPage';
import { fetchEvents, fetchUnit, getAdmin, groupCode, inviteAction, inviteUrl, MODULE_LABEL, setOrg, type InviteSecrets, type InviteState, type ModuleMap, type Org, type PlatformEvent, type Usage } from './api';
import { INDUSTRY_LABEL, ROLE_LABEL, STATUS_LABEL, STATUS_TONE, monthName } from './labels';

type Tab = 'overview' | 'modules' | 'people' | 'changes';
const TABS: { v: Tab; label: string }[] = [{ v: 'overview', label: 'Overview' }, { v: 'modules', label: 'Modules' }, { v: 'people', label: 'People' }, { v: 'changes', label: 'Changes' }];
const when = (iso: string | null | undefined) => (iso ? `${formatDay(iso.slice(0, 10), 'en', 'short')} ${formatTime(iso, 'en')}` : '—');
const ACTION_LABEL: Record<string, string> = { create: 'Created', invite_resend: 'Invite sent again', invite_cancel: 'Invite cancelled', joined: 'Owner opened the invite', modules: 'Modules changed', status: 'Status changed', org: 'Organisation changed' };

/** What changed between two org snapshots, in words ("Catalogue off", "Paused"). */
function changeText(e: PlatformEvent): string {
  const b = (e.before ?? {}) as Partial<Org>; const a = (e.after ?? {}) as Partial<Org>;
  const parts: string[] = [];
  if (a.modules && b.modules) for (const m of MODULES) if (a.modules[m] !== b.modules[m]) parts.push(`${MODULE_LABEL[m].name} ${a.modules[m] ? 'on' : 'off'}`);
  if (a.status && b.status && a.status !== b.status) parts.push(STATUS_LABEL[a.status]);
  return parts.join(', ');
}

/** /admin/units/:unitId — one organisation: usage, modules, people and the founders' changes (usage only, never records). */
export default function AdminUnitPage() {
  const { unitId = '' } = useParams();
  const toast = useToast();
  const [authed, setAuthed] = useState(() => Boolean(getAdmin()));
  const [data, setData] = useState<{ unit: { unitId: string; name: string; shortCode: string | null }; org: Org; invite?: InviteState; usage: Usage } | null>(null);
  const [events, setEvents] = useState<PlatformEvent[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [draft, setDraft] = useState<ModuleMap | null>(null);
  const [reason, setReason] = useState(''); const [reasonErr, setReasonErr] = useState(''); const [busy, setBusy] = useState(false);
  const [statusSheet, setStatusSheet] = useState(false); const [statusReason, setStatusReason] = useState('');
  const [secrets, setSecrets] = useState<InviteSecrets | null>(null);
  const fetchAll = useCallback(() => Promise.all([fetchUnit(unitId), fetchEvents(unitId)]), [unitId]);
  const apply = useCallback(([u, ev]: Awaited<ReturnType<typeof fetchAll>>) => {
    if (!u) { setAuthed(Boolean(getAdmin())); return; }
    setData(u); setEvents(ev?.events ?? []); setDraft(null);
  }, []);
  const load = useCallback(async () => apply(await fetchAll()), [apply, fetchAll]);
  useEffect(() => { if (authed) void fetchAll().then(apply); }, [authed, fetchAll, apply]);
  const current = data?.org.modules;
  const mods = draft ?? current;
  const changed = useMemo(() => (current && draft ? MODULES.filter((m) => draft[m] !== current[m]) : []), [current, draft]);
  if (!authed) return <AdminLoginPage onDone={() => setAuthed(true)} />;
  if (!data || !mods) return <AdminShell><p className="text-muted">Loading…</p></AdminShell>;
  const { org, usage, invite } = data;

  const saveModules = async () => {
    if (!reason.trim()) { setReasonErr('Write a reason. It goes into the changes log.'); return; }
    setBusy(true);
    try {
      const r = await setOrg(unitId, { modules: draft ?? undefined, reason: reason.trim() });
      if (!r.ok) { setReasonErr(r.error); return; }
      setReason(''); setReasonErr(''); toast.show('Modules saved', 'success'); await load();
    } finally { setBusy(false); }
  };
  const setStatus = async () => {
    if (!statusReason.trim()) return;
    const r = await setOrg(unitId, { status: org.status === 'paused' ? 'active' : 'paused', reason: statusReason.trim() });
    if (!r.ok) { toast.show(r.error, 'error'); return; }
    setStatusSheet(false); setStatusReason(''); toast.show(org.status === 'paused' ? 'Active again' : 'Paused', 'success'); await load();
  };
  const invite2 = async (action: 'resend' | 'cancel') => {
    const r = await inviteAction(unitId, action);
    if (!r.ok) { toast.show(r.error, 'error'); return; }
    setSecrets(r.data.invite ?? null); toast.show(action === 'resend' ? 'New invite made; the old one stopped working' : 'Invite cancelled', 'success'); await load();
  };
  const toggle = (m: keyof ModuleMap, v: boolean) => setDraft(effectiveModules({ ...mods, [m]: v, ...(m === 'wages' && v ? { attendance: true } : {}) }));
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.show('Copied', 'success'); } catch { /* ignore */ } };
  const ownerName = usage.byUser.find((u) => u.role === 'owner')?.name || invite?.ownerName || '—';

  return (
    <AdminShell>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted"><span>{INDUSTRY_LABEL[org.industry] ?? org.industry}</span><Dot tone={STATUS_TONE[org.status]}>{STATUS_LABEL[org.status]}</Dot>{data.unit.shortCode && <span className="num">Shop code {data.unit.shortCode}</span>}</p>
          <h1 className="text-3xl" data-testid="org-name">{data.unit.name}</h1>
        </div>
        {org.status !== 'invited' && (
          <Button size="md" variant="secondary" onClick={() => setStatusSheet(true)} data-testid="toggle-status">
            {org.status === 'paused' ? <><PlayCircle aria-hidden="true" size={18} />Make active</> : <><PauseCircle aria-hidden="true" size={18} />Pause</>}
          </Button>
        )}
      </header>
      <div role="tablist" aria-label="Organisation" className="mb-5 flex gap-1 border-b border-line">
        {TABS.map((x) => (
          <button key={x.v} role="tab" aria-selected={tab === x.v} onClick={() => setTab(x.v)} data-testid={`tab-${x.v}`}
            className={cn('relative -mb-px min-h-12 px-3 text-base transition-colors lg:min-h-11', tab === x.v ? 'font-medium text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary' : 'text-ink-2 hover:text-ink')}>{x.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="flex flex-col gap-5" data-testid="org-overview">
          <StatRow className="grid-cols-2 md:grid-cols-4">
            <StatTile label={`Entries in ${monthName(usage.month)}`} value={Object.values(usage.byModule).reduce((s, n) => s + n, 0)} testid="admin-entries" />
            <StatTile label="Logins" value={usage.logins} testid="admin-logins" />
            <StatTile label="Workers" value={usage.workers} testid="admin-workers" />
            <StatTile label="Owner opened the app" value={usage.ownerOpens} />
          </StatRow>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardTitle>Entries this month by module</CardTitle>
              <ul className="divide-y divide-line">{MODULES.map((m) => <li key={m} className="flex items-center justify-between py-2"><span className={org.modules[m] ? 'text-ink' : 'text-muted'}>{MODULE_LABEL[m].name}{!org.modules[m] && ' (off)'}</span><span className={cn('num', usage.byModule[m] ? 'text-ink' : 'text-muted')}>{usage.byModule[m] ?? 0}</span></li>)}</ul>
            </Card>
            <Card data-testid="admin-usage">
              <CardTitle>Who used it</CardTitle>
              {usage.byUser.length === 0 ? <p className="text-sm text-muted">No entries this month.</p> : (
                <ul className="divide-y divide-line">{usage.byUser.map((u) => <li key={u.name} className="flex items-center justify-between gap-3 py-2"><span className="text-ink">{u.name} <span className="text-sm text-muted">{ROLE_LABEL[u.role] ?? u.role}</span></span><span className="num text-sm text-ink-2">{u.entries} entries · {u.days} days</span></li>)}</ul>
              )}
              <p className="mt-3 text-sm text-muted">Last activity: {when(usage.lastAt)}</p>
            </Card>
          </div>
        </div>
      )}

      {tab === 'modules' && (
        <Card className="max-w-3xl" data-testid="org-modules">
          <ul className="divide-y divide-line">
            {MODULES.map((m) => (
              <li key={m} className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0"><p className="font-medium text-ink">{MODULE_LABEL[m].name}</p><p className="text-sm text-muted">{MODULE_LABEL[m].hint}</p></div>
                  <Switch checked={mods[m]} onChange={(v) => toggle(m, v)} label={MODULE_LABEL[m].name} testid={`module-${m}`} />
                </div>
                {changed.includes(m) && (
                  <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink" data-testid={`effect-${m}`}>
                    {mods[m] ? `On: ${usage.logins} logins see it again at their next sync.` : `Off: hidden for ${usage.logins} logins. Its entries are kept and shown again when it is turned back on. New entries for it are refused.`}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {changed.length > 0 && (
            <div className="mt-3 border-t border-line pt-4">
              <Field label="Reason" required error={reasonErr}>{({ id, describedBy, invalid }) => <Input id={id} value={reason} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => { setReason(e.target.value); setReasonErr(''); }} data-testid="modules-reason" />}</Field>
              <div className="flex gap-2"><Button onClick={() => void saveModules()} disabled={busy} data-testid="modules-save">Save changes</Button><Button variant="ghost" onClick={() => { setDraft(null); setReason(''); setReasonErr(''); }}>Undo</Button></div>
            </div>
          )}
        </Card>
      )}

      {tab === 'people' && (
        <div className="grid max-w-3xl gap-5" data-testid="org-people">
          <Card>
            <CardTitle>Owner</CardTitle>
            <p className="text-ink">{ownerName}</p>
            {invite && <p className="num text-sm text-muted">{invite.ownerPhone}</p>}
          </Card>
          <Card>
            <CardTitle>Invite</CardTitle>
            {!invite ? <p className="text-sm text-muted">Created before invites existed.</p> : (
              <>
                <p className="mb-3 text-ink-2" data-testid="invite-state">{invite.state === 'used' ? `Opened ${when(invite.usedAt)}` : invite.state === 'open' ? `Waiting · works until ${when(invite.expiresAt)}` : invite.state === 'expired' ? 'Expired. Send a new one.' : 'Cancelled.'}</p>
                {secrets && (
                  <div className="mb-3 rounded-xl border border-line bg-surface-2/60 p-3" data-testid="new-invite">
                    <p className="text-sm text-muted">New link and code</p>
                    <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{inviteUrl(secrets.token)}</p><button type="button" onClick={() => void copy(inviteUrl(secrets.token))} aria-label="Copy link" className="tap-48 inline-flex items-center justify-center rounded-xl text-ink-2 hover:bg-surface"><Copy aria-hidden="true" size={18} /></button></div>
                    <p className="num font-display text-2xl font-medium tracking-[0.15em] text-ink">{groupCode(secrets.code)}</p>
                  </div>
                )}
                {org.status === 'invited' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="md" variant="secondary" onClick={() => void invite2('resend')} data-testid="invite-resend"><RefreshCw aria-hidden="true" size={16} />Send a new invite</Button>
                    {invite.state === 'open' && <Button size="md" variant="ghost" onClick={() => void invite2('cancel')} data-testid="invite-cancel"><XCircle aria-hidden="true" size={16} />Cancel invite</Button>}
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {tab === 'changes' && (
        <Card className="max-w-3xl" data-testid="org-changes">
          {events.length === 0 ? <EmptyState title="No changes yet" /> : (
            <ol className="divide-y divide-line">
              {events.map((e) => (
                <li key={e.seq} className="py-3" data-testid="change-row">
                  <p className="text-ink"><span className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</span>{changeText(e) && ` · ${changeText(e)}`}</p>
                  {e.reason && <p className="text-sm text-ink-2">“{e.reason}”</p>}
                  <p className="text-sm text-muted">{when(e.at)} · {e.actor === 'owner' ? 'the owner' : e.actor}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      <Sheet open={statusSheet} onClose={() => setStatusSheet(false)} title={org.status === 'paused' ? 'Make active' : 'Pause organisation'}
        footer={<Button block disabled={!statusReason.trim()} onClick={() => void setStatus()} data-testid="status-confirm">{org.status === 'paused' ? 'Make active' : 'Pause'}</Button>}>
        <p className="mb-3 text-ink-2">{org.status === 'paused' ? 'People can add entries again; entries waiting on their phones are sent.' : 'People can still log in and see everything, but cannot add entries until you make it active again.'}</p>
        <Field label="Reason" required>{({ id }) => <Textarea id={id} rows={2} value={statusReason} onChange={(e) => setStatusReason(e.target.value)} data-testid="status-reason" />}</Field>
      </Sheet>
    </AdminShell>
  );
}
