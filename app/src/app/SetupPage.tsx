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

type Mode = 'create' | 'join';

export default function SetupPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { refreshUnit } = useSession();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('create');
  const [busy, setBusy] = useState(false);

  // create fields
  const [unitName, setUnitName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');

  // join fields
  const [joinId, setJoinId] = useState('');
  const [joinKey, setJoinKey] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateCreate = () => {
    const e: Record<string, string> = {};
    if (!unitName.trim()) e.unitName = t('valid.required');
    if (!ownerName.trim()) e.ownerName = t('valid.required');
    if (!/^\d{10}$/.test(ownerPhone.replace(/\D/g, '').slice(-10)) && ownerPhone.trim())
      e.ownerPhone = t('valid.phone');
    if (!ownerPhone.trim()) e.ownerPhone = t('valid.required');
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
    } finally {
      setBusy(false);
    }
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lg:flex lg:min-h-dvh lg:flex-col lg:items-center lg:justify-center lg:bg-bg lg:px-4 lg:py-10">
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10 lg:min-h-0 lg:w-full lg:py-0">
        <div className="text-center">
          <h1 className="text-4xl">{t('app.name')}</h1>
          <p className="mt-1 text-muted">{t('app.tagline')}</p>
        </div>

      <SegmentedControl<Mode>
        label={t('route.setup')}
        value={mode}
        onChange={setMode}
        className="self-center"
        options={[
          { value: 'create', label: t('setup.create') },
          { value: 'join', label: t('setup.join') },
        ]}
      />

      <Card>
        {mode === 'create' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onCreate();
            }}
          >
            <h2 className="mb-4 text-xl">{t('setup.title')}</h2>
            <Field label={t('setup.unitName')} required error={errors.unitName}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} value={unitName} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setUnitName(e.target.value)} autoComplete="organization" />
              )}
            </Field>
            <Field label={t('setup.ownerName')} required error={errors.ownerName}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} value={ownerName} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setOwnerName(e.target.value)} autoComplete="name" />
              )}
            </Field>
            <Field label={t('setup.ownerPhone')} required error={errors.ownerPhone}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} type="tel" inputMode="numeric" value={ownerPhone} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setOwnerPhone(e.target.value)} autoComplete="tel" />
              )}
            </Field>
            <Field label={t('setup.pin')} required error={errors.pin}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} type="password" inputMode="numeric" maxLength={4} value={pin} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className="num text-center tracking-[0.5em]" />
              )}
            </Field>
            <Field label={t('setup.pinConfirm')} required error={errors.pin2}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} type="password" inputMode="numeric" maxLength={4} value={pin2} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 4))} className="num text-center tracking-[0.5em]" />
              )}
            </Field>
            <Button type="submit" size="xl" disabled={busy}>
              {t('setup.createBtn')}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onJoin();
            }}
          >
            <h2 className="mb-4 text-xl">{t('setup.join')}</h2>
            <Field label={t('setup.unitCode')} required error={errors.joinId}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} value={joinId} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setJoinId(e.target.value)} />
              )}
            </Field>
            <Field label={t('setup.unitKey')} required error={errors.joinKey}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} value={joinKey} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => setJoinKey(e.target.value)} />
              )}
            </Field>
            <Button type="submit" size="xl" disabled={busy}>
              {t('setup.joinBtn')}
            </Button>
          </form>
        )}
      </Card>
    </main>
    </div>
  );
}
