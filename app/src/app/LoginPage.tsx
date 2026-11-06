import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Delete, Store } from 'lucide-react';
import { getUnitName } from './unit-name';
import { Button } from '../components/ui/Button';
import { PersonPicker, type Person } from '../components/ui/PersonPicker';
import { EmptyState } from '../components/ui/Feedback';
import type { UserP } from '../db/types';
import { useT } from '../i18n';
import { bootstrapUsers } from '../sync';
import { getUnitMeta, listLoginUsers, loginWithPin, lockoutSecondsLeft, useSession } from './session';
import { AuthShell, AuthCard } from './AuthShell';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];

export default function LoginPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { refreshUnit } = useSession();
  const [users, setUsers] = useState<UserP[] | null>(null);
  const [picked, setPicked] = useState<UserP | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [lockLeft, setLockLeft] = useState(0);

  useEffect(() => {
    void (async () => {
      const meta = await getUnitMeta();
      if (!meta) { navigate('/setup', { replace: true }); return; }
      let list = await listLoginUsers(meta.unitId);
      if (list.length === 0) { await bootstrapUsers(); list = await listLoginUsers(meta.unitId); }
      setUsers(list);
    })();
  }, [navigate]);

  useEffect(() => {
    if (lockLeft <= 0) return;
    const id = window.setInterval(() => { const left = lockoutSecondsLeft(); setLockLeft(left); if (left <= 0) setError(''); }, 1000);
    return () => window.clearInterval(id);
  }, [lockLeft]);

  const submit = async (fullPin: string) => {
    if (!picked) return;
    const meta = await getUnitMeta();
    if (!meta) return;
    const result = await loginWithPin(picked, fullPin, meta.unitId);
    if (result.ok) { await refreshUnit(); navigate('/', { replace: true }); return; }
    const left = lockoutSecondsLeft();
    setLockLeft(left);
    setError(left > 0 ? t('login.lockedOut', { s: left })
      : result.reason === 'needs_internet' ? t('login.needsInternet')
      : result.reason === 'rate_limited' ? t('login.rateLimited')
      : t('login.wrongPin'));
    setPin('');
  };

  const press = (k: string) => {
    if (lockLeft > 0) return;
    setError('');
    if (k === 'clear') { setPin(''); return; }
    if (k === 'del') { setPin((p) => p.slice(0, -1)); return; }
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) void submit(next);
  };

  const people: Person[] = (users ?? []).map((u) => ({ id: u.entityId, name: u.name, subtitle: t(`role.${u.role}`) }));
  const unitName = getUnitName();

  return (
    <AuthShell subtitle={picked ? t('login.enterPin') : t('login.title')}>
      {unitName && <div className="-mt-2 flex items-center justify-center gap-2 text-ink-2"><Store aria-hidden="true" size={18} strokeWidth={1.75} className="text-muted" /><span className="font-medium text-ink">{unitName}</span></div>}
      {!picked ? (
        <AuthCard>
          {users && users.length === 0 ? (
            <EmptyState title={t('login.noUsers')} action={<Button variant="secondary" onClick={() => navigate('/setup')}>{t('route.setup')}</Button>} />
          ) : (
            <PersonPicker people={people} onSelect={(id) => { setPicked(users?.find((x) => x.entityId === id) ?? null); setPin(''); setError(''); }} />
          )}
        </AuthCard>
      ) : (
        <AuthCard className="[&>div:last-child]:flex [&>div:last-child]:flex-col [&>div:last-child]:items-center [&>div:last-child]:gap-5">
          <p className="text-lg font-medium text-ink">{picked.name}</p>
          {/* The PIN fills in as four knots. */}
          <div className="flex gap-3" aria-label={t('login.enterPin')} aria-live="polite">
            {[0, 1, 2, 3].map((i) => <span key={i} className={`h-4 w-4 rounded-[4px] transition-[background-color,box-shadow,transform] duration-150 ${i < pin.length ? 'knot-tie bg-primary shadow-[inset_0_0_0_2px_var(--color-primary)]' : 'shadow-[inset_0_0_0_2px_var(--color-line-strong)]'}`} aria-hidden="true" />)}
          </div>
          {error && <p role="alert" className="text-base font-medium text-given">{error}</p>}
          <div className="grid w-full max-w-xs grid-cols-3 gap-3">
            {KEYS.map((k) => k === 'clear' ? (
              <button key={k} type="button" onClick={() => press(k)} className="num tap-48 rounded-xl text-base font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink">{t('login.clear')}</button>
            ) : k === 'del' ? (
              <button key={k} type="button" onClick={() => press(k)} aria-label={t('action.delete')} className="tap-48 flex items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink"><Delete aria-hidden="true" strokeWidth={1.75} /></button>
            ) : (
              <button key={k} type="button" onClick={() => press(k)} disabled={lockLeft > 0}
                className="num min-h-[4.5rem] rounded-xl border border-line bg-surface-2/50 text-3xl font-medium text-ink transition-[background-color,border-color,transform] duration-100 hover:border-line-strong hover:bg-surface-2 active:scale-[0.96] active:bg-primary-soft disabled:opacity-50">{k}</button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setPicked(null)}>{t('action.back')}</Button>
        </AuthCard>
      )}
    </AuthShell>
  );
}
