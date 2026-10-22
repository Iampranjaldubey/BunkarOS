import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useToast } from '../components/ui/Toast';
import { useT } from '../i18n';
import { createUnit, joinUnit, useSession } from './session';
import { AuthShell } from './AuthShell';

type Mode = 'create' | 'join';

export default function SetupPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { refreshUnit } = useSession();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('create');
  const [busy, setBusy] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [joinId, setJoinId] = useState('');
  const [joinKey, setJoinKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateCreate = () => {
    const e: Record<string, string> = {};
    if (!unitName.trim()) e.unitName = t('valid.required');
    if (!ownerName.trim()) e.ownerName = t('valid.required');
    if (!ownerPhone.trim()) e.ownerPhone = t('valid.required');
    else if (!/^\d{10}$/.test(ownerPhone.replace(/\D/g, '').slice(-10))) e.ownerPhone = t('valid.phone');
    if (!/^\d{4}$/.test(pin)) e.pin = t('valid.pin');
    if (pin !== pin2) e.pin2 = t('valid.pinMismatch');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onCreate = async () => {
    if (!validateCreate()) return;
    setBusy(true);
    try {
      await createUnit({ unitName: unitName.trim(), ownerName: ownerName.trim(), ownerPhone: ownerPhone.trim(), pin });
      await refreshUnit();
      toast.show(t('action.done'), 'success');
      navigate('/login', { replace: true });
    } finally { setBusy(false); }
  };

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

  const pinInput = (id: string, describedBy: string | undefined, invalid: boolean, v: string, set: (s: string) => void) => (
    <Input id={id} type="password" inputMode="numeric" maxLength={4} value={v} aria-invalid={invalid || undefined} aria-describedby={describedBy}
      onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 4))} className="num text-center tracking-[0.5em]" />
  );

  return (
    <AuthShell>
      <SegmentedControl<Mode> label={t('route.setup')} value={mode} onChange={setMode} className="self-center"
        options={[{ value: 'create', label: t('setup.create') }, { value: 'join', label: t('setup.join') }]} />
      <p className="-mt-3 text-center text-sm text-muted">{t('setup.hint')}</p>
      <Card className="md:p-6">
        {mode === 'create' ? (
          <form onSubmit={(e) => { e.preventDefault(); void onCreate(); }}>
            <h2 className="mb-4 text-xl">{t('setup.title')}</h2>
            <Field label={t('setup.unitName')} required error={errors.unitName}>
              {({ id, describedBy, invalid }) => <Input id={id} value={unitName} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setUnitName(e.target.value)} autoComplete="organization" />}
            </Field>
            <div className="md:grid md:grid-cols-2 md:gap-x-4">
              <Field label={t('setup.ownerName')} required error={errors.ownerName}>
                {({ id, describedBy, invalid }) => <Input id={id} value={ownerName} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setOwnerName(e.target.value)} autoComplete="name" />}
              </Field>
              <Field label={t('setup.ownerPhone')} required error={errors.ownerPhone}>
                {({ id, describedBy, invalid }) => <Input id={id} type="tel" inputMode="numeric" value={ownerPhone} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setOwnerPhone(e.target.value)} autoComplete="tel" />}
              </Field>
              <Field label={t('setup.pin')} required error={errors.pin}>{({ id, describedBy, invalid }) => pinInput(id, describedBy, invalid, pin, setPin)}</Field>
              <Field label={t('setup.pinConfirm')} required error={errors.pin2}>{({ id, describedBy, invalid }) => pinInput(id, describedBy, invalid, pin2, setPin2)}</Field>
            </div>
            <Button type="submit" size="xl" disabled={busy}>{t('setup.createBtn')}</Button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void onJoin(); }}>
            <h2 className="mb-4 text-xl">{t('setup.join')}</h2>
            <Field label={t('setup.unitCode')} required error={errors.joinId}>
              {({ id, describedBy, invalid }) => <Input id={id} value={joinId} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setJoinId(e.target.value)} />}
            </Field>
            <Field label={t('setup.unitKey')} required error={errors.joinKey}>
              {({ id, describedBy, invalid }) => <Input id={id} value={joinKey} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setJoinKey(e.target.value)} />}
            </Field>
            <Button type="submit" size="xl" disabled={busy}>{t('setup.joinBtn')}</Button>
          </form>
        )}
      </Card>
    </AuthShell>
  );
}
