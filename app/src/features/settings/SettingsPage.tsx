import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList, Grid3x3, Users as UsersIcon, HardHat, IndianRupee, Package,
  FileText, History, Store, Eye, EyeOff, Copy, UserPlus, RefreshCw, LogOut,
  KeyRound, Settings as SettingsIcon, Database, Lock, Smartphone, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Sheet, ConfirmSheet } from '../../components/ui/Sheet';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Field } from '../../components/ui/Field';
import { Input, Select } from '../../components/ui/Input';
import { MoneyInput } from '../../components/ui/NumberInputs';
import { useToast } from '../../components/ui/Toast';
import { useRecords, useSession } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import { getSettings, listUsers, listThekedars } from '../../domain/projections';
import { can } from '../../domain/permissions';
import { useSyncState, syncNow } from '../../sync/client';
import { authedFetch } from '../../sync';
import { getDeviceId } from '../../lib/session-store';
import { formatDay, formatTime } from '../../domain/dates';
import { getUnitMeta } from '../../app/session';
import { hashPin } from '../../lib/pin';
import { uuid, istDay } from '../../domain/ids';
import type { Lang, Role, SettingP, UserP } from '../../db/types';
import { loadDemoData } from '../demo/seed';
import { useT } from '../../i18n';
import { formatINR } from '../../lib/utils';

interface LinkDef { to: string; icon: LucideIcon; key: string; }
const LINKS: LinkDef[] = [
  { to: '/orders', icon: ClipboardList, key: 'orders' },
  { to: '/looms', icon: Grid3x3, key: 'looms' },
  { to: '/weavers', icon: UsersIcon, key: 'weavers' },
  { to: '/thekedars', icon: HardHat, key: 'thekedars' },
  { to: '/rates', icon: IndianRupee, key: 'rates' },
  { to: '/yarn', icon: Package, key: 'yarn' },
  { to: '/digest', icon: FileText, key: 'digest' },
  { to: '/audit', icon: History, key: 'audit' },
  { to: '/o/EX-118', icon: Store, key: 'exporter' },
];

export default function SettingsPage() {
  const { t, lang, setLang } = useT();
  const toast = useToast();
  const recs = useRecords();
  const { role, user, logout } = useSession();
  const settings = getSettings(recs);
  const users = useMemo(() => listUsers(recs), [recs]);
  const thekedars = useMemo(() => listThekedars(recs).filter((th) => th.active), [recs]);
  const sync = useSyncState();

  const isOwner = role === 'owner';
  const canManageUsers = role ? can(role, 'user.manage') : false;
  const canEditSettings = role ? can(role, 'settings.edit') : false;

  // Unit meta (code + key).
  const [meta, setMeta] = useState<{ unitId: string; unitKey: string; unitName: string } | null>(null);
  useEffect(() => { void getUnitMeta().then(setMeta); }, []);
  const [revealed, setRevealed] = useState(false);

  // Rejected records list.
  const rejected = useMemo(() => recs.filter((r) => r.sync === 'rejected'), [recs]);

  // ---- Phones (SPEC-014): owner-only device bindings ----
  interface DeviceRow {
    userId: string;
    deviceId: string;
    boundAt: string;
    lastSeenAt: string | null;
    revokedAt?: string;
    revokedBy?: string;
  }
  const thisDeviceId = useMemo(() => {
    try { return getDeviceId(); } catch { return ''; }
  }, []);
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [devicesErr, setDevicesErr] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [signoutUser, setSignoutUser] = useState<UserP | null>(null);

  const userName = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.entityId, u.name);
    return (id: string) => m.get(id) ?? t('devices.unknownUser');
  }, [users, t]);

  const loadDevices = useMemo(
    () => async () => {
      if (!isOwner || !sync.online) return;
      try {
        const res = await authedFetch('/api/devices', { method: 'GET' });
        if (!res.ok) { setDevicesErr(true); return; }
        const data = (await res.json()) as { devices: DeviceRow[] };
        setDevices(data.devices);
        setDevicesErr(false);
      } catch {
        setDevicesErr(true);
      }
    },
    [isOwner, sync.online],
  );

  useEffect(() => { void loadDevices(); }, [loadDevices]);

  const activeDevices = useMemo(
    () => (devices ?? []).filter((d) => !d.revokedAt),
    [devices],
  );
  const revokedDevices = useMemo(
    () => (devices ?? []).filter((d) => d.revokedAt),
    [devices],
  );

  const doSignout = async () => {
    if (!signoutUser) return;
    try {
      const res = await authedFetch(`/api/devices/${encodeURIComponent(signoutUser.entityId)}/signout`, { method: 'POST' });
      if (res.ok || res.status === 204) {
        toast.show(t('devices.signoutDone'), 'success');
        await loadDevices();
      } else {
        toast.show(t('devices.signoutFailed'), 'error');
      }
    } catch {
      toast.show(t('devices.signoutFailed'), 'error');
    } finally {
      setSignoutUser(null);
    }
  };

  const fmtDay = (iso: string | null | undefined): string => {
    if (!iso) return t('devices.lastSeenNever');
    const day = iso.slice(0, 10);
    try { return `${formatDay(day, lang, 'medium')} · ${formatTime(iso, lang)}`; } catch { return day; }
  };

  // ---- Add user sheet ----
  const [userOpen, setUserOpen] = useState(false);
  const [uName, setUName] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uRole, setURole] = useState<Exclude<Role, 'owner'>>('munshi');
  const [uThekedarId, setUThekedarId] = useState('');
  const [uPin, setUPin] = useState('');
  const [uPin2, setUPin2] = useState('');
  const [uErr, setUErr] = useState<Record<string, string>>({});
  const [savingUser, setSavingUser] = useState(false);

  const resetUser = () => { setUName(''); setUPhone(''); setURole('munshi'); setUThekedarId(''); setUPin(''); setUPin2(''); setUErr({}); };

  const saveUser = async () => {
    const e: Record<string, string> = {};
    if (!uName.trim()) e.name = t('valid.required');
    if (uRole === 'thekedar' && !uThekedarId) e.thekedar = t('valid.required');
    if (!/^\d{4}$/.test(uPin)) e.pin = t('valid.pin');
    else if (uPin !== uPin2) e.pin2 = t('valid.pinMismatch');
    setUErr(e);
    if (Object.keys(e).length) return;
    setSavingUser(true);
    try {
      const { pinHash, pinSalt } = await hashPin(uPin);
      const entityId = uuid();
      const payload: UserP = {
        entityId, name: uName.trim(), phone: uPhone.trim(), role: uRole,
        pinHash, pinSalt, active: true,
        // A thekedar login MUST be bound to a thekedar entity so visibleLoomIds
        // scopes the home board / check-in picker to that thekedar's looms.
        ...(uRole === 'thekedar' ? { thekedarId: uThekedarId } : {}),
      };
      await addRecord<UserP>('user', payload);
      toast.show(t('settings.user.saved'), 'success');
      setUserOpen(false);
      resetUser();
    } finally {
      setSavingUser(false);
    }
  };

  // ---- Deactivate user ----
  const [deactivate, setDeactivate] = useState<UserP | null>(null);
  const doDeactivate = async () => {
    if (!deactivate) return;
    const next: UserP = { ...deactivate, active: false };
    await addRecord<UserP>('user', next);
    toast.show(t('settings.user.deactivated'), 'success');
    setDeactivate(null);
  };

  // ---- Settings edit sheet ----
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [photoTh, setPhotoTh] = useState(settings?.photoRequiredAbovePaise ?? 200_000);
  const [wastage, setWastage] = useState(settings?.wastagePct ?? 3);
  const [yellow, setYellow] = useState(settings?.idleYellowDays ?? 4);
  const [red, setRed] = useState(settings?.idleRedDays ?? 7);
  const [openCash, setOpenCash] = useState(settings?.openingCashPaise ?? 0);
  const [openDay, setOpenDay] = useState(settings?.openingCashDay ?? istDay(new Date().toISOString()));
  const [ownerPhone, setOwnerPhone] = useState(settings?.ownerPhone ?? '');
  const [prefLang, setPrefLang] = useState<Lang>(settings?.lang ?? lang);

  useEffect(() => {
    if (!settings) return;
    setPhotoTh(settings.photoRequiredAbovePaise);
    setWastage(settings.wastagePct);
    setYellow(settings.idleYellowDays);
    setRed(settings.idleRedDays);
    setOpenCash(settings.openingCashPaise);
    setOpenDay(settings.openingCashDay);
    setOwnerPhone(settings.ownerPhone);
    setPrefLang(settings.lang);
  }, [settings]);

  const savePrefs = async () => {
    const base = settings;
    const payload: SettingP = {
      entityId: 'unit',
      unitName: base?.unitName ?? meta?.unitName ?? '',
      ownerPhone: ownerPhone.trim(),
      lang: prefLang,
      photoRequiredAbovePaise: photoTh,
      wastagePct: wastage,
      idleYellowDays: yellow,
      idleRedDays: red,
      openingCashPaise: openCash,
      openingCashDay: openDay,
    };
    await addRecord<SettingP>('setting', payload);
    setLang(prefLang);
    toast.show(t('settings.prefsSaved'), 'success');
    setPrefsOpen(false);
  };

  // ---- Demo + logout ----
  const [demoBusy, setDemoBusy] = useState(false);
  const doDemo = async () => {
    setDemoBusy(true);
    try {
      await loadDemoData();
      toast.show(t('settings.demoLoaded'), 'success');
    } catch {
      toast.show(t('common.empty'), 'error');
    } finally {
      setDemoBusy(false);
    }
  };
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.show(t('settings.copied'), 'success'); } catch { /* ignore */ }
  };

  const lastSync = sync.lastSyncAt
    ? t('settings.lastSync', { time: new Date(sync.lastSyncAt).toLocaleString(lang === 'en' ? 'en-IN' : 'hi-IN') })
    : t('settings.neverSynced');

  return (
    <section>
      <PageHeader title={t('settings.title')} />

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-6 lg:items-start">
      {/* Section links grid */}
      <Card className="mb-4">
        <CardTitle>{t('settings.sections')}</CardTitle>
        <div className="grid grid-cols-3 gap-3">
          {LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.key}
                to={l.to}
                className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-center text-ink shadow-card focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron"
              >
                <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo/10 text-indigo">
                  <Icon size={22} />
                </span>
                <span className="text-sm leading-tight">{t(`settings.link.${l.key}`)}</span>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Unit info */}
      <Card className="mb-4">
        <CardTitle>{t('settings.unit')}</CardTitle>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
          <dt className="text-muted">{t('settings.unitName')}</dt>
          <dd className="text-ink">{meta?.unitName || settings?.unitName || '—'}</dd>
        </dl>
        {isOwner && meta && (
          <div className="mt-3">
            <p className="mb-2 text-sm text-muted">{t('settings.revealHint')}</p>
            {revealed ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-line bg-bg p-3">
                  <KeyRound aria-hidden="true" size={18} className="text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted">{t('settings.unitCode')}</span>
                    <span className="num block truncate text-sm text-ink">{meta.unitId}</span>
                  </span>
                  <button type="button" aria-label={t('settings.copy')} onClick={() => void copy(meta.unitId)} className="tap-48 text-indigo"><Copy size={18} /></button>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-line bg-bg p-3">
                  <Lock aria-hidden="true" size={18} className="text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted">{t('settings.unitKey')}</span>
                    <span className="num block truncate text-sm text-ink">{meta.unitKey}</span>
                  </span>
                  <button type="button" aria-label={t('settings.copy')} onClick={() => void copy(meta.unitKey)} className="tap-48 text-indigo"><Copy size={18} /></button>
                </div>
                <Button variant="ghost" size="md" onClick={() => setRevealed(false)}>
                  <EyeOff aria-hidden="true" size={18} />{t('settings.hide')}
                </Button>
              </div>
            ) : (
              <Button variant="secondary" size="md" block onClick={() => setRevealed(true)}>
                <Eye aria-hidden="true" size={18} />{t('settings.reveal')}
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Users management (owner) */}
      {canManageUsers && (
        <Card className="mb-4">
          <CardTitle>{t('settings.users')}</CardTitle>
          <ul className="mb-3 flex flex-col gap-2">
            {users.map((u) => (
              <li key={u.entityId} className="flex items-center gap-3 rounded-xl border border-line bg-bg p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base text-ink">{u.name}</span>
                  <span className="text-sm text-muted">{t(`role.${u.role}`)}</span>
                </span>
                {u.active ? <Badge tone="received">{t('settings.user.active')}</Badge> : <Badge tone="neutral">{t('settings.user.inactive')}</Badge>}
                {u.active && u.entityId !== user?.id && (
                  <button type="button" onClick={() => setDeactivate(u)} className="text-sm font-medium text-madder lg:inline-flex lg:min-h-11 lg:items-center lg:rounded-xl lg:px-3 lg:hover:bg-madder/5">
                    {t('settings.user.deactivate')}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <Button variant="secondary" block onClick={() => { resetUser(); setUserOpen(true); }}>
            <UserPlus aria-hidden="true" size={20} />{t('settings.addUser')}
          </Button>
        </Card>
      )}

      {/* Unit settings (owner) */}
      <Card className="mb-4">
        <CardTitle>{t('settings.prefs')}</CardTitle>
        {canEditSettings ? (
          <>
            <dl className="mb-3 grid grid-cols-[1fr_auto] gap-y-1 text-base">
              <dt className="text-muted">{t('settings.photoThreshold')}</dt>
              <dd className="num text-ink">{formatINR(photoTh)}</dd>
              <dt className="text-muted">{t('settings.wastagePct')}</dt>
              <dd className="num text-ink">{wastage}%</dd>
              <dt className="text-muted">{t('settings.openingCash')}</dt>
              <dd className="num text-ink">{formatINR(openCash)}</dd>
              <dt className="text-muted">{t('settings.ownerPhone')}</dt>
              <dd className="num text-ink">{ownerPhone || '—'}</dd>
            </dl>
            <Button variant="secondary" block onClick={() => setPrefsOpen(true)}>
              <SettingsIcon aria-hidden="true" size={20} />{t('settings.savePrefs')}
            </Button>
          </>
        ) : (
          <p className="flex items-center gap-2 text-base text-muted"><Lock size={16} />{t('settings.ownerOnly')}</p>
        )}
      </Card>

      {/* Phones (SPEC-014) — owner only */}
      {isOwner && (
        <Card className="mb-4">
          <CardTitle>{t('devices.title')}</CardTitle>
          <p className="mb-3 text-sm text-muted">{t('devices.hint')}</p>
          {!sync.online ? (
            <p className="flex items-center gap-2 text-base text-muted"><Smartphone size={16} />{t('devices.offline')}</p>
          ) : devicesErr ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-base text-madder">{t('devices.loadFailed')}</p>
              <Button variant="secondary" size="md" data-testid="devices-retry" onClick={() => { setDevicesErr(false); setDevices(null); void loadDevices(); }}>
                {t('devices.retry')}
              </Button>
            </div>
          ) : devices === null ? (
            <p className="text-sm text-muted">{t('devices.loading')}</p>
          ) : activeDevices.length === 0 ? (
            <p className="text-sm text-muted">{t('devices.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {activeDevices.map((d) => {
                const isThis = thisDeviceId !== '' && d.deviceId === thisDeviceId;
                const last4 = d.deviceId.slice(-4);
                return (
                  <li key={`${d.userId}-${d.deviceId}`} className="rounded-xl border border-line bg-bg p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Smartphone aria-hidden="true" size={18} className="text-indigo" />
                      <span className="min-w-0 flex-1 truncate text-base text-ink">{userName(d.userId)}</span>
                      {isThis && <Badge tone="received">{t('devices.thisPhone')}</Badge>}
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                      <dt className="text-muted">{t('devices.phoneLabel')}</dt>
                      <dd className="num text-ink">…{last4}</dd>
                      <dt className="text-muted">{t('devices.boundSince')}</dt>
                      <dd className="num text-ink">{fmtDay(d.boundAt)}</dd>
                      <dt className="text-muted">{t('devices.lastSeen')}</dt>
                      <dd className="num text-ink">{fmtDay(d.lastSeenAt)}</dd>
                    </dl>
                    <Button
                      variant="danger"
                      size="md"
                      block
                      className="mt-2"
                      onClick={() => setSignoutUser(users.find((u) => u.entityId === d.userId) ?? { entityId: d.userId, name: userName(d.userId) } as UserP)}
                    >
                      <LogOut aria-hidden="true" size={18} />{t('devices.signout')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Collapsed history of revoked/old phones */}
          {devices !== null && revokedDevices.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="tap-48 flex items-center gap-1 text-sm font-medium text-indigo focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
                aria-expanded={showHistory}
              >
                {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {showHistory ? t('devices.historyHide') : t('devices.historyShow')}
              </button>
              {showHistory && (
                <ul className="mt-2 flex flex-col gap-1">
                  {revokedDevices.map((d, i) => (
                    <li key={`${d.userId}-${d.deviceId}-${i}`} className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-ink">{userName(d.userId)} · …{d.deviceId.slice(-4)}</span>
                      <span className="text-muted">{t('devices.revoked')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Sync */}
      <Card className="mb-4">
        <CardTitle>{t('settings.sync')}</CardTitle>
        <p className="mb-3 text-sm text-muted">{lastSync}</p>
        <Button variant="secondary" block onClick={() => void syncNow()} disabled={!sync.online}>
          <RefreshCw aria-hidden="true" size={20} className={sync.syncing ? 'animate-spin' : ''} />{t('settings.syncNow')}
        </Button>
        <div className="mt-3">
          <p className="mb-1 text-sm font-medium text-ink">{t('settings.rejected')}</p>
          {rejected.length === 0 ? (
            <p className="text-sm text-muted">{t('settings.noRejected')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {rejected.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-madder/5 px-3 py-2 text-sm">
                  <span className="text-ink">{r.type}</span>
                  <span className="text-madder">{r.rejectReason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Demo */}
      <Card className="mb-4">
        <CardTitle>{t('settings.demo')}</CardTitle>
        <p className="mb-3 text-sm text-muted">{t('settings.loadDemoHint')}</p>
        <Button variant="secondary" block data-testid="load-demo" disabled={demoBusy} onClick={() => void doDemo()}>
          <Database aria-hidden="true" size={20} />{t('settings.loadDemo')}
        </Button>
      </Card>
      </div>

      {/* Logout */}
      <Button variant="danger" block size="xl" onClick={() => setLogoutConfirm(true)}>
        <LogOut aria-hidden="true" size={20} />{t('settings.logout')}
      </Button>

      {/* ---- Sheets ---- */}
      <Sheet
        open={userOpen}
        onClose={() => setUserOpen(false)}
        title={t('settings.addUserTitle')}
        footer={
          <>
            <Button variant="secondary" block onClick={() => setUserOpen(false)}>{t('action.cancel')}</Button>
            <Button block disabled={savingUser} onClick={() => void saveUser()}>{t('settings.user.save')}</Button>
          </>
        }
      >
        <Field label={t('settings.user.name')} required error={uErr.name}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} value={uName} aria-describedby={describedBy} aria-invalid={invalid || undefined} onChange={(e) => setUName(e.target.value)} />
          )}
        </Field>
        <Field label={t('settings.user.phone')} hint={t('common.optional')}>
          {({ id }) => <Input id={id} type="tel" inputMode="numeric" value={uPhone} onChange={(e) => setUPhone(e.target.value)} />}
        </Field>
        <div className="mb-4">
          <span className="mb-1.5 block text-base font-medium text-ink">{t('settings.user.role')}</span>
          <SegmentedControl<Exclude<Role, 'owner'>>
            label={t('settings.user.role')}
            value={uRole}
            onChange={(r) => { setURole(r); if (r !== 'thekedar') setUThekedarId(''); }}
            className="w-full [&>button]:flex-1"
            options={[{ value: 'munshi', label: t('role.munshi') }, { value: 'thekedar', label: t('role.thekedar') }]}
          />
        </div>
        {uRole === 'thekedar' && (
          <Field label={t('role.thekedar')} required error={uErr.thekedar}>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                data-testid="user-thekedar-select"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={uThekedarId}
                onChange={(ev) => setUThekedarId(ev.target.value)}
              >
                <option value="">—</option>
                {thekedars.map((th) => (
                  <option key={th.entityId} value={th.entityId}>{th.name}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label={t('settings.user.pin')} required error={uErr.pin}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="tel" inputMode="numeric" maxLength={4} value={uPin} aria-describedby={describedBy} aria-invalid={invalid || undefined} onChange={(e) => setUPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          )}
        </Field>
        <Field label={t('settings.user.pinConfirm')} required error={uErr.pin2}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="tel" inputMode="numeric" maxLength={4} value={uPin2} aria-describedby={describedBy} aria-invalid={invalid || undefined} onChange={(e) => setUPin2(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          )}
        </Field>
      </Sheet>

      <Sheet
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        title={t('settings.prefs')}
        footer={
          <>
            <Button variant="secondary" block onClick={() => setPrefsOpen(false)}>{t('action.cancel')}</Button>
            <Button block onClick={() => void savePrefs()}>{t('settings.savePrefs')}</Button>
          </>
        }
      >
        <Field label={t('settings.photoThreshold')} hint={t('settings.photoThresholdHint')}>
          {({ describedBy }) => <MoneyInput value={photoTh} onChange={setPhotoTh} aria-label={t('settings.photoThreshold')} describedBy={describedBy} />}
        </Field>
        <Field label={t('settings.wastagePct')}>
          {({ id }) => <Input id={id} type="number" inputMode="decimal" min={0} value={wastage} onChange={(e) => setWastage(Number(e.target.value) || 0)} className="text-right" />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('settings.idleYellow')}>
            {({ id }) => <Input id={id} type="number" inputMode="numeric" min={1} value={yellow} onChange={(e) => setYellow(Number(e.target.value) || 0)} className="text-right" />}
          </Field>
          <Field label={t('settings.idleRed')}>
            {({ id }) => <Input id={id} type="number" inputMode="numeric" min={1} value={red} onChange={(e) => setRed(Number(e.target.value) || 0)} className="text-right" />}
          </Field>
        </div>
        <Field label={t('settings.openingCash')}>
          {({ describedBy }) => <MoneyInput value={openCash} onChange={setOpenCash} aria-label={t('settings.openingCash')} describedBy={describedBy} />}
        </Field>
        <Field label={t('settings.openingCashDay')}>
          {({ id }) => <Input id={id} type="date" value={openDay} onChange={(e) => setOpenDay(e.target.value)} />}
        </Field>
        <Field label={t('settings.ownerPhone')}>
          {({ id }) => <Input id={id} type="tel" inputMode="numeric" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />}
        </Field>
        <div className="mb-2">
          <span className="mb-1.5 block text-base font-medium text-ink">{t('settings.language')}</span>
          <SegmentedControl<Lang>
            label={t('settings.language')}
            value={prefLang}
            onChange={setPrefLang}
            options={[{ value: 'hi', label: 'हिंदी' }, { value: 'en', label: 'English' }]}
          />
        </div>
      </Sheet>

      <ConfirmSheet
        open={Boolean(deactivate)}
        onClose={() => setDeactivate(null)}
        onConfirm={() => void doDeactivate()}
        title={t('settings.user.confirmOff')}
        message={t('settings.user.confirmOffMsg', { name: deactivate?.name ?? '' })}
        danger
        confirmLabel={t('settings.user.deactivate')}
      />

      <ConfirmSheet
        open={Boolean(signoutUser)}
        onClose={() => setSignoutUser(null)}
        onConfirm={() => void doSignout()}
        title={t('devices.signoutConfirmTitle')}
        message={t('devices.signoutConfirmMsg', { name: signoutUser?.name ?? '' })}
        danger
        confirmLabel={t('devices.signout')}
      />

      <ConfirmSheet
        open={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        onConfirm={() => { setLogoutConfirm(false); logout(); }}
        title={t('settings.logoutConfirm')}
        message={t('settings.logoutMsg')}
        danger
        confirmLabel={t('settings.logout')}
      />
    </section>
  );
}
