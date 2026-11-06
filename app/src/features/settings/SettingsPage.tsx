import { useMemo, useState } from 'react';
import { CalendarPlus, Copy, LogOut, UserPlus, X } from 'lucide-react';
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
import { uuid } from '../../domain/ids';
import { formatDay } from '../../domain/dates';
import { WageRulesCard, OperatorsCard } from './RulesCards';
import { unitRules } from '../../domain/settings';
import { hashPin } from '../../lib/pin';
import { getUnitMeta, useSession } from '../../app/session';
import { authedFetch } from '../../sync';
import { useT } from '../../i18n';
import { useEffect } from 'react';
import { useCan, useOrg } from '../../app/useCan';
import { MODULES } from '../../domain/modules';
import { Dot } from '../../components/ui/Badge';

type Theme = 'auto' | 'light' | 'dark';
function getTheme(): Theme { try { return (localStorage.getItem('bunkar.theme') as Theme) || 'auto'; } catch { return 'auto'; } }
export function applyTheme(th: Theme) {
  try { localStorage.setItem('bunkar.theme', th); } catch { /* ignore */ }
  if (th === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = th;
}

export default function SettingsPage() {
  const { t, lang } = useT();
  const { role, logout } = useSession();
  const toast = useToast();
  const recs = useRecords();
  const settings = useMemo(() => getSettings(recs), [recs]);
  const users = useMemo(() => listUsers(recs), [recs]);
  const allowed = useCan();
  const isOwner = role === 'owner' && allowed('settings.edit');
  const org = useOrg();

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

  // SPEC-M10: holidays are part of the unit setting (sorted, unique; a new version per change).
  const holidays = useMemo(() => [...new Set(settings?.holidays ?? [])].sort(), [settings]);
  const [holidayDay, setHolidayDay] = useState('');
  const writeHolidays = async (next: string[]) => {
    if (!settings) return;
    await addRecord<SettingP>('setting', { ...settings, holidays: [...new Set(next)].sort() });
  };
  const addHoliday = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDay)) return;
    if (!holidays.includes(holidayDay)) await writeHolidays([...holidays, holidayDay]);
    setHolidayDay(''); toast.show(t('settings.saved'), 'success');
  };
  const removeHoliday = async (d: string) => { await writeHolidays(holidays.filter((x) => x !== d)); toast.show(t('settings.saved'), 'success'); };

  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.show(t('settings.copied'), 'success'); } catch { /* ignore */ } };

  return (
    <section className="lg:grid lg:grid-cols-2 lg:gap-6">
      <div className="lg:col-span-2"><PageHeader title={t('nav.settings')} /></div>

      <Card className="mb-4 lg:mb-0">
        <CardTitle>{t('settings.language')}</CardTitle>
        <LanguageSwitch className="mb-4" />
        <p className="mb-1.5 text-base font-medium text-ink">{t('settings.theme')}</p>
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

      <Card className="mb-4 lg:mb-0" data-testid="holidays-card">
        <CardTitle>{t('settings.holidays')}</CardTitle>
        <p className="mb-3 text-sm text-muted">{t('settings.holidaysHint')}</p>
        {isOwner && (
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <Field label={t('settings.holidayDate')} className="mb-0 min-w-44 flex-1">
              {({ id }) => <Input id={id} type="date" value={holidayDay} onChange={(e) => setHolidayDay(e.target.value)} className="num" />}
            </Field>
            <Button variant="secondary" onClick={() => void addHoliday()} disabled={!holidayDay}><CalendarPlus aria-hidden="true" size={18} />{t('settings.holidayAdd')}</Button>
          </div>
        )}
        {holidays.length === 0 ? <p className="text-sm text-muted">{t('settings.holidaysEmpty')}</p> : (
          <ul className="flex flex-wrap gap-2">
            {holidays.map((d) => (
              <li key={d} data-testid={`holiday-${d}`} className="flex items-center gap-1 rounded-lg border border-line bg-surface-2/60 py-1 pl-3 pr-1 text-sm text-ink">
                <span className="num">{formatDay(d, lang, 'medium')}</span>
                {isOwner ? (
                  <button type="button" onClick={() => void removeHoliday(d)} aria-label={t('settings.holidayRemove', { day: formatDay(d, lang, 'medium') })} className="tap-48 -my-2 inline-flex items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-given"><X aria-hidden="true" size={16} /></button>
                ) : <span className="pr-2" />}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4 lg:mb-0" data-testid="modules-card">
        <CardTitle>{t('m18.yourModules')}</CardTitle>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {MODULES.map((m) => (
            <li key={m} className="flex min-h-11 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
              <span className="text-ink">{t(`m18.mod.${m}`)}</span>
              <Dot tone={org.modules[m] ? 'received' : 'neutral'}>{org.modules[m] ? t('m18.on') : t('m18.off')}</Dot>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">{t('m18.yourModulesHint')}</p>
      </Card>

      {settings && <WageRulesCard key={JSON.stringify(unitRules(settings))} settings={settings} isOwner={isOwner} />}
      {settings && <OperatorsCard key={JSON.stringify(unitRules(settings).operatorPerms)} settings={settings} isOwner={isOwner} />}

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
        <Card className="mb-4 lg:mb-0" data-testid="shop-code-card">
          <CardTitle>{t('settings.shopCode')}</CardTitle>
          <div className="flex items-center gap-3">
            <p className="num font-display text-4xl font-medium tracking-[0.2em] text-ink" data-testid="shop-code">{shopCode}</p>
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
            <div key={k} className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 p-3">
              <div className="min-w-0 flex-1"><p className="text-sm text-muted">{t(k)}</p><p className="num truncate font-mono text-sm text-ink" data-testid={k === 'setup.unitCode' ? 'join-unit-id' : 'join-unit-key'}>{v}</p></div>
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
