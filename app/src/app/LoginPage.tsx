import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Delete } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PersonPicker, type Person } from '../components/ui/PersonPicker';
import type { UserP } from '../db/types';
import { useT } from '../i18n';
import { bootstrapUsers } from '../sync';
import {
  getUnitMeta,
  listLoginUsers,
  loginWithPin,
  lockoutSecondsLeft,
  takeLogoutReason,
  useSession,
} from './session';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];

export default function LoginPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { refreshUnit } = useSession();
  const [users, setUsers] = useState<UserP[]>([]);
  const [picked, setPicked] = useState<UserP | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [lockLeft, setLockLeft] = useState(0);
  // SPEC-014: a persistent notice shown above the picker — set when the owner
  // signed this phone out (device_revoked) or a munshi/thekedar login is bound
  // to another phone (device_bound). Cleared when a user is picked.
  const [notice, setNotice] = useState('');

  // Show the one-shot logout reason (owner remote sign-out) once on mount.
  useEffect(() => {
    const reason = takeLogoutReason();
    if (reason === 'device_revoked') setNotice(t('login.deviceRevoked'));
  }, [t]);

  useEffect(() => {
    void (async () => {
      const meta = await getUnitMeta();
      if (!meta) {
        navigate('/setup', { replace: true });
        return;
      }
      let list = await listLoginUsers(meta.unitId);
      // Two-device bootstrap: a freshly-joined device has the unit key but no
      // local user records yet, so the picker would be empty and login would be
      // impossible. Pull the unit's `user` records (token-less, server-permitted)
      // and re-list so the operator can pick an identity and enter their PIN.
      if (list.length === 0) {
        await bootstrapUsers();
        list = await listLoginUsers(meta.unitId);
      }
      setUsers(list);
    })();
  }, [navigate]);

  // Lockout countdown.
  useEffect(() => {
    if (lockLeft <= 0) return;
    const id = window.setInterval(() => {
      const left = lockoutSecondsLeft();
      setLockLeft(left);
      if (left <= 0) setError('');
    }, 1000);
    return () => window.clearInterval(id);
  }, [lockLeft]);

  const submit = async (fullPin: string) => {
    if (!picked) return;
    const meta = await getUnitMeta();
    if (!meta) return;
    const result = await loginWithPin(picked, fullPin, meta.unitId);
    if (result.ok) {
      await refreshUnit();
      navigate('/', { replace: true });
    } else if (result.deviceBound) {
      // SPEC-014 AC1: login bound to another phone — no session started.
      setNotice(t('login.deviceBound'));
      setError('');
      setPin('');
    } else {
      const left = lockoutSecondsLeft();
      setLockLeft(left);
      setError(left > 0 ? t('login.lockedOut', { s: left }) : t('login.wrongPin'));
      setPin('');
    }
  };

  const press = (k: string) => {
    if (lockLeft > 0) return;
    setError('');
    if (k === 'clear') {
      setPin('');
      return;
    }
    if (k === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) void submit(next);
  };

  const people: Person[] = users.map((u) => ({
    id: u.entityId,
    name: u.name,
    photoId: undefined,
  }));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <h1 className="text-center text-3xl">
        {picked ? t('login.enterPin') : t('login.title')}
      </h1>

      {notice && (
        <p
          role="alert"
          className="rounded-2xl border border-madder/30 bg-madder/10 px-4 py-3 text-center text-base font-medium text-madder"
        >
          {notice}
        </p>
      )}

      {!picked ? (
        <Card>
          <PersonPicker
            people={people}
            onSelect={(id) => {
              const u = users.find((x) => x.entityId === id) ?? null;
              setPicked(u);
              setPin('');
              setError('');
              setNotice('');
            }}
          />
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-5">
          <p className="text-lg font-medium text-ink">{picked.name}</p>

          {/* PIN dots */}
          <div className="flex gap-3" aria-label={t('login.enterPin')} aria-live="polite">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full border-2 ${
                  i < pin.length ? 'border-indigo bg-indigo' : 'border-line'
                }`}
                aria-hidden="true"
              />
            ))}
          </div>

          {error && (
            <p role="alert" className="text-base font-medium text-madder">
              {error}
            </p>
          )}

          {/* numeric keypad */}
          <div className="grid w-full max-w-xs grid-cols-3 gap-3">
            {KEYS.map((k) => {
              if (k === 'clear') {
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => press(k)}
                    className="num tap-48 rounded-2xl text-base font-medium text-muted focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
                  >
                    {t('login.clear')}
                  </button>
                );
              }
              if (k === 'del') {
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => press(k)}
                    aria-label={t('action.delete')}
                    className="tap-48 flex items-center justify-center rounded-2xl text-muted focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
                  >
                    <Delete aria-hidden="true" />
                  </button>
                );
              }
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  disabled={lockLeft > 0}
                  className="num min-h-16 rounded-2xl border border-line bg-surface text-2xl font-bold text-ink hover:bg-bg focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink disabled:opacity-50"
                >
                  {k}
                </button>
              );
            })}
          </div>

          <Button variant="ghost" onClick={() => setPicked(null)}>
            {t('action.back')}
          </Button>
        </Card>
      )}
    </main>
  );
}
