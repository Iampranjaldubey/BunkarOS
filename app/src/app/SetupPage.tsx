import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Store } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useToast } from '../components/ui/Toast';
import { useT } from '../i18n';
import { joinUnit, useSession } from './session';
import { claimInviteAndSetup, lookupInvite, type InviteError, type InviteInfo } from './invite';
import { AuthShell, AuthCard } from './AuthShell';

type Mode = 'invite' | 'join';

/** "ABCD2345" → "ABCD-2345" while typing. */
const formatCode = (v: string) => { const c = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c; };

/**
 * SPEC-M18 §4: an owner opens the unit the founders created, from the invite link (/join/:token) or by typing its code.
 * Two steps on one card: find the invite, then set a PIN.
 */
function InviteForm({ token }: { token?: string }) {
  const { t } = useT();
  const navigate = useNavigate();
  const { refreshUnit } = useSession();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [err, setErr] = useState<InviteError | ''>('');
  const [pin, setPin] = useState(''); const [pin2, setPin2] = useState('');
  const [pinErr, setPinErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const ref = token ? { token } : { code: code.replace('-', '') };

  useEffect(() => {
    if (!token) return;
    let live = true;
    void lookupInvite({ token }).then((r) => { if (!live) return; if (r.ok) setInfo(r.info); else setErr(r.error); });
    return () => { live = false; };
  }, [token]);

  const find = async () => {
    setErr(''); setBusy(true);
    try { const r = await lookupInvite(ref); if (r.ok) setInfo(r.info); else setErr(r.error); } finally { setBusy(false); }
  };
  const open = async () => {
    const e: Record<string, string> = {};
    if (!/^\d{4}$/.test(pin)) e.pin = t('valid.pin');
    if (pin !== pin2) e.pin2 = t('valid.pinMismatch');
    setPinErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await claimInviteAndSetup(ref, pin);
      if (!r.ok) { setErr(r.error); setInfo(null); return; }
      await refreshUnit();
      toast.show(t('action.done'), 'success');
      navigate('/login', { replace: true });
    } finally { setBusy(false); }
  };
  const errText = err ? t(err === 'error' ? 'wp.error' : `join.${err === 'not_found' ? 'notFound' : err}`) : '';
  const pinInput = (id: string, describedBy: string | undefined, invalid: boolean, v: string, set: (s: string) => void) => (
    <Input id={id} type="password" inputMode="numeric" maxLength={4} value={v} aria-invalid={invalid || undefined} aria-describedby={describedBy}
      onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 4))} className="num text-center tracking-[0.5em]" />
  );

  if (info) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); void open(); }} data-testid="invite-pin">
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3">
          <Store aria-hidden="true" size={22} strokeWidth={1.6} className="shrink-0 text-muted" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink" data-testid="invite-unit">{info.unitName}</p>
            <p className="truncate text-sm text-muted">{t('join.owner')}: {info.ownerName}</p>
          </div>
        </div>
        <div className="md:grid md:grid-cols-2 md:gap-x-4">
          <Field label={t('join.pin')} required error={pinErr.pin}>{({ id, describedBy, invalid }) => pinInput(id, describedBy, invalid, pin, setPin)}</Field>
          <Field label={t('join.pin2')} required error={pinErr.pin2}>{({ id, describedBy, invalid }) => pinInput(id, describedBy, invalid, pin2, setPin2)}</Field>
        </div>
        <Button type="submit" size="xl" disabled={busy}>{t('join.open')}</Button>
      </form>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); void find(); }}>
      <h2 className="mb-4 text-lg">{token ? t('join.title') : t('setup.title')}</h2>
      {!token && (
        <Field label={t('join.codeLabel')} hint={t('join.codeHint')} required error={errText}>
          {({ id, describedBy, invalid }) => <Input id={id} value={code} autoComplete="off" autoCapitalize="characters" aria-invalid={invalid || undefined} aria-describedby={describedBy}
            onChange={(e) => { setCode(formatCode(e.target.value)); setErr(''); }} className="num text-center text-xl tracking-[0.2em]" data-testid="invite-code" />}
        </Field>
      )}
      {token && errText && <p role="alert" className="mb-4 text-base font-medium text-given">{errText}</p>}
      {!token && <Button type="submit" size="xl" disabled={busy || code.replace('-', '').length < 8}>{t('join.check')}</Button>}
    </form>
  );
}

export default function SetupPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { token } = useParams();
  const { refreshUnit } = useSession();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('invite');
  const [busy, setBusy] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [joinKey, setJoinKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onJoin = async () => {
    const e: Record<string, string> = {};
    if (!joinId.trim()) e.joinId = t('valid.required');
    if (joinKey.trim().length < 22) e.joinKey = t('valid.required');
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await joinUnit(joinId.trim(), joinKey.trim());
      await refreshUnit();
      toast.show(t('action.done'), 'success');
      navigate('/login', { replace: true });
    } finally { setBusy(false); }
  };

  if (token) return <AuthShell><AuthCard><InviteForm token={token} /></AuthCard></AuthShell>;

  return (
    <AuthShell>
      <SegmentedControl<Mode> label={t('route.setup')} value={mode} onChange={setMode} className="self-center"
        options={[{ value: 'invite', label: t('join.haveInvite') }, { value: 'join', label: t('setup.join') }]} />
      <p className="-mt-3 text-center text-sm text-ink-2">{t('join.hint')}</p>
      <AuthCard>
        {mode === 'invite' ? <InviteForm /> : (
          <form onSubmit={(e) => { e.preventDefault(); void onJoin(); }}>
            <h2 className="mb-4 text-lg">{t('setup.join')}</h2>
            <Field label={t('setup.unitCode')} required error={errors.joinId}>
              {({ id, describedBy, invalid }) => <Input id={id} value={joinId} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setJoinId(e.target.value)} />}
            </Field>
            <Field label={t('setup.unitKey')} required error={errors.joinKey}>
              {({ id, describedBy, invalid }) => <Input id={id} value={joinKey} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setJoinKey(e.target.value)} />}
            </Field>
            <Button type="submit" size="xl" disabled={busy}>{t('setup.joinBtn')}</Button>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}
