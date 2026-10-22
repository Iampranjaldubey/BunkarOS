import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Delete, Store } from 'lucide-react';
import { getUnitName } from './unit-name';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PersonPicker, type Person } from '../components/ui/PersonPicker';
import { EmptyState } from '../components/ui/Feedback';
import type { UserP } from '../db/types';
import { useT } from '../i18n';
import { bootstrapUsers } from '../sync';
import { getUnitMeta, listLoginUsers, loginWithPin, lockoutSecondsLeft, useSession } from './session';
import { AuthShell } from './AuthShell';

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
    setError(left > 0 ? t('login.lockedOut', { s: left }) : t('login.wrongPin'));
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
      {unitName && <div className="-mt-2 flex items-center justify-center gap-2 text-ink"><Store aria-hidden="true" size={18} className="text-primary" /><span className="font-medium">{unitName}</span></div>}
      {!picked ? (
        <Card className="md:p-6">
          {users && users.length === 0 ? (
            <EmptyState title={t('login.noUsers')} action={<Button variant="secondary" onClick={() => navigate('/setup')}>{t('route.setup')}</Button>} />
          ) : (
            <PersonPicker people={people} onSelect={(id) => { setPicked(users?.find((x) => x.entityId === id) ?? null); setPin(''); setError(''); }} />
          )}
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-5 md:p-6">
          <p className="text-lg font-medium text-ink">{picked.name}</p>
          <div className="flex gap-3" aria-label={t('login.enterPin')} aria-live="polite">
            {[0, 1, 2, 3].map((i) => <span key={i} className={`h-4 w-4 rounded-full border-2 transition-colors ${i < pin.length ? 'border-primary bg-primary' : 'border-line'}`} aria-hidden="true" />)}
          </div>
          {error && <p role="alert" className="text-base font-medium text-given">{error}</p>}
          <div className="grid w-full max-w-xs grid-cols-3 gap-3">
            {KEYS.map((k) => k === 'clear' ? (
              <button key={k} type="button" onClick={() => press(k)} className="num tap-48 rounded-2xl text-base font-medium text-muted hover:bg-surface-2">{t('login.clear')}</button>
            ) : k === 'del' ? (
              <button key={k} type="button" onClick={() => press(k)} aria-label={t('action.delete')} className="tap-48 flex items-center justify-center rounded-2xl text-muted hover:bg-surface-2"><Delete aria-hidden="true" /></button>
            ) : (
              <button key={k} type="button" onClick={() => press(k)} disabled={lockLeft > 0}
                className="num min-h-[4.5rem] rounded-2xl border border-line bg-surface text-3xl font-bold text-ink shadow-card transition-colors hover:bg-surface-2 active:bg-primary-soft disabled:opacity-50">{k}</button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setPicked(null)}>{t('action.back')}</Button>
        </Card>
      )}
    </AuthShell>
  );
}
