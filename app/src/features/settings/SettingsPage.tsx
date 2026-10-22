import { useMemo, useState } from 'react';
import { Copy, LogOut, UserPlus } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { LanguageSwitch } from '../../components/ui/LanguageSwitch';
import { useToast } from '../../components/ui/Toast';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { Role, SettingP, UserP } from '../../db/types';
import { getSettings, listUsers } from '../../domain/masters';
import { can } from '../../domain/permissions';
import { uuid } from '../../domain/ids';
import { hashPin } from '../../lib/pin';
import { getUnitMeta, useSession } from '../../app/session';
import { authedFetch } from '../../sync';
import { useT } from '../../i18n';
import { useEffect } from 'react';

type Theme = 'auto' | 'light' | 'dark';
function getTheme(): Theme { try { return (localStorage.getItem('bunkar.theme') as Theme) || 'auto'; } catch { return 'auto'; } }
export function applyTheme(th: Theme) {
  try { localStorage.setItem('bunkar.theme', th); } catch { /* ignore */ }
  if (th === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = th;
}

export default function SettingsPage() {
  const { t } = useT();
  const { role, logout } = useSession();
  const toast = useToast();
  const recs = useRecords();
  const settings = useMemo(() => getSettings(recs), [recs]);
  const users = useMemo(() => listUsers(recs), [recs]);
  const isOwner = role === 'owner' && can(role, 'settings.edit');

  const [workingDays, setWorkingDays] = useState<string>('');
  const [photoAbove, setPhotoAbove] = useState<string>('');
  const [unitName, setUnitName] = useState<string>('');
  const [theme, setTheme] = useState<Theme>(getTheme);
  const [meta, setMeta] = useState<{ unitId: string; unitKey: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [nu, setNu] = useState({ name: '', phone: '', role: 'staff' as Role, pin: '' });
  const [nuErr, setNuErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) { setWorkingDays(String(settings.workingDaysPerMonth)); setPhotoAbove(String(settings.photoRequiredAbovePaise / 100)); setUnitName(settings.unitName); }
  }, [settings]);
  const [shopCode, setShopCode] = useState<string>('');
  useEffect(() => { void getUnitMeta().then((m) => m && setMeta({ unitId: m.unitId, unitKey: m.unitKey })); }, []);
  useEffect(() => {
    if (!navigator.onLine) return;
    void authedFetch('/api/units/me').then(async (r) => { if (r.ok) { const b = (await r.json()) as { shortCode?: string }; if (b.shortCode) setShopCode(b.shortCode); } }).catch(() => undefined);
  }, []);

  const saveSettings = async () => {
    if (!settings) return;
    const wd = Number(workingDays); const pa = Number(photoAbove);
    if (!Number.isInteger(wd) || wd < 1 || wd > 31 || !Number.isFinite(pa) || pa < 0) { toast.show(t('valid.number'), 'error'); return; }
    const next: SettingP = { ...settings, unitName: unitName.trim() || settings.unitName, workingDaysPerMonth: wd, photoRequiredAbovePaise: Math.round(pa * 100) };
    await addRecord<SettingP>('setting', next);
    toast.show(t('settings.saved'), 'success');
  };

  const addUser = async () => {
    const e: Record<string, string> = {};
    if (!nu.name.trim()) e.name = t('valid.required');
    if (!/^\d{4}$/.test(nu.pin)) e.pin = t('valid.pin');
    setNuErr(e);
    if (Object.keys(e).length) return;
    const { pinHash, pinSalt } = await hashPin(nu.pin);
    await addRecord<UserP>('user', { entityId: uuid(), name: nu.name.trim(), phone: nu.phone.trim(), role: nu.role, pinHash, pinSalt, active: true });
    setAddOpen(false); setNu({ name: '', phone: '', role: 'staff', pin: '' });
    toast.show(t('action.done'), 'success');
  };

  const toggleUser = async (u: UserP) => { await addRecord<UserP>('user', { ...u, active: !u.active }); };

  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.show(t('settings.copied'), 'success'); } catch { /* ignore */ } };

  return (
    <section className="lg:grid lg:grid-cols-2 lg:gap-6">
      <div className="lg:col-span-2"><PageHeader title={t('nav.settings')} /></div>

      <Card className="mb-4 lg:mb-0">
        <CardTitle>{t('settings.language')}</CardTitle>
        <LanguageSwitch className="mb-4" />
        <p className="mb-1 text-sm font-medium text-muted">{t('settings.theme')}</p>
        <SegmentedControl<Theme> label={t('settings.theme')} value={theme} onChange={(v) => { setTheme(v); applyTheme(v); }}
          options={[{ value: 'auto', label: t('settings.theme.auto') }, { value: 'light', label: t('settings.theme.light') }, { value: 'dark', label: t('settings.theme.dark') }]} />
      </Card>

      <Card className="mb-4 lg:mb-0">
        <CardTitle>{t('settings.unit')}</CardTitle>
        <Field label={t('setup.unitName')}>{({ id }) => <Input id={id} value={unitName} disabled={!isOwner} onChange={(e) => setUnitName(e.target.value)} />}</Field>
        <Field label={t('settings.workingDays')} hint={t('settings.workingDaysHint')}>
          {({ id }) => <Input id={id} inputMode="numeric" value={workingDays} disabled={!isOwner} onChange={(e) => setWorkingDays(e.target.value.replace(/\D/g, ''))} className="num" />}
        </Field>
        <Field label={t('settings.photoAbove')}>{({ id }) => <Input id={id} inputMode="numeric" value={photoAbove} disabled={!isOwner} onChange={(e) => setPhotoAbove(e.target.value.replace(/[^\d]/g, ''))} className="num" />}</Field>
        {isOwner && <Button block onClick={() => void saveSettings()}>{t('action.save')}</Button>}
      </Card>

      <Card className="mb-4 lg:mb-0">
        <div className="mb-2 flex items-center justify-between"><CardTitle className="mb-0">{t('settings.users')}</CardTitle>
          {isOwner && <Button size="md" variant="secondary" onClick={() => setAddOpen(true)}><UserPlus aria-hidden="true" size={18} />{t('settings.addUser')}</Button>}</div>
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u.entityId} className="flex items-center gap-3 py-3">
              <div className="flex-1"><p className="font-medium text-ink">{u.name}</p><p className="text-sm text-muted">{t(`role.${u.role}`)}{u.phone ? ` · ${u.phone}` : ''}</p></div>
              <Badge tone={u.active ? 'received' : 'neutral'}>{u.active ? t('common.active') : t('common.inactive')}</Badge>
              {isOwner && u.role !== 'owner' && <Button size="md" variant="ghost" onClick={() => void toggleUser(u)}>{u.active ? t('settings.deactivate') : t('common.active')}</Button>}
            </li>
          ))}
        </ul>
      </Card>

      {shopCode && (
        <Card className="mb-4 lg:mb-0 bg-primary-soft/40" data-testid="shop-code-card">
          <CardTitle>{t('settings.shopCode')}</CardTitle>
          <div className="flex items-center gap-3">
            <p className="num text-4xl font-bold tracking-[0.25em] text-ink" data-testid="shop-code">{shopCode}</p>
            <button type="button" onClick={() => void copy(shopCode)} aria-label={t('settings.copy')} className="tap-48 rounded-xl text-primary hover:bg-primary-soft"><Copy aria-hidden="true" size={20} /></button>
          </div>
          <p className="mt-1 text-sm text-muted">{t('settings.shopCodeHint')}</p>
        </Card>
      )}
      {isOwner && meta && (
        <Card className="mb-4 lg:mb-0">
          <CardTitle>{t('settings.joinInfo')}</CardTitle>
          <p className="mb-3 text-sm text-muted">{t('settings.joinHint')}</p>
          {[['setup.unitCode', meta.unitId], ['setup.unitKey', meta.unitKey]].map(([k, v]) => (
            <div key={k} className="mb-2 flex items-center gap-2 rounded-xl bg-surface-2 p-3">
              <div className="min-w-0 flex-1"><p className="text-xs text-muted">{t(k)}</p><p className="num truncate font-mono text-sm text-ink">{v}</p></div>
              <button type="button" onClick={() => void copy(v)} aria-label={t('settings.copy')} className="tap-48 rounded-xl text-primary hover:bg-primary-soft"><Copy aria-hidden="true" size={20} /></button>
            </div>
          ))}
        </Card>
      )}

      <div className="lg:col-span-2"><Button variant="secondary" onClick={logout}><LogOut aria-hidden="true" size={18} />{t('action.logout')}</Button></div>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={t('settings.addUser')} footer={<Button block onClick={() => void addUser()}>{t('action.save')}</Button>}>
        <Field label={t('settings.userName')} required error={nuErr.name}>{({ id }) => <Input id={id} value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} />}</Field>
        <Field label={t('settings.userPhone')}>{({ id }) => <Input id={id} type="tel" inputMode="numeric" value={nu.phone} onChange={(e) => setNu({ ...nu, phone: e.target.value })} />}</Field>
        <Field label={t('settings.userRole')}>{({ id }) => <Select id={id} value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })}><option value="staff">{t('role.staff')}</option><option value="owner">{t('role.owner')}</option></Select>}</Field>
        <Field label={t('settings.userPin')} required error={nuErr.pin}>{({ id }) => <Input id={id} type="password" inputMode="numeric" maxLength={4} value={nu.pin} onChange={(e) => setNu({ ...nu, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })} className="num text-center tracking-[0.5em]" />}</Field>
      </Sheet>
    </section>
  );
}
