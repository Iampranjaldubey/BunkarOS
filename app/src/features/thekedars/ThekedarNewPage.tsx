import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Button, Field, Input, PhotoCapture, useToast } from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { addRecord } from '../../db/repo';
import type { ThekedarP } from '../../db/types';
import { uuid } from '../../domain/ids';
import { useT } from '../../i18n';

export default function ThekedarNewPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [photoId, setPhotoId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const errName = touched && !name.trim() ? t('valid.required') : undefined;
  const errVillage = touched && !village.trim() ? t('valid.required') : undefined;
  const errPhone = touched && phone.trim() && !/^\d{10}$/.test(phone.trim()) ? t('valid.phone') : undefined;
  const valid = name.trim() && village.trim() && !errPhone;

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      const payload: ThekedarP = {
        entityId: uuid(),
        name: name.trim(),
        phone: phone.trim(),
        village: village.trim(),
        photoId,
        active: true,
      };
      await addRecord<ThekedarP>('thekedar', payload, photoId ? { photoIds: [photoId] } : {});
      toast.show(t('thekedar.saved'), 'success');
      navigate('/thekedars', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <PageHeader title={t('route.thekedarNew')} back />

      <PhotoCapture value={photoId} onChange={setPhotoId} label={t('thekedar.photo')} />

      <Field label={t('thekedar.field.name')} required error={errName}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={name} onChange={(e) => setName(e.target.value)} />
        )}
      </Field>

      <Field label={t('thekedar.field.phone')} hint={t('common.optional')} error={errPhone}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="tel"
            inputMode="numeric"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="98XXXXXXXX"
          />
        )}
      </Field>

      <Field label={t('thekedar.field.village')} required error={errVillage}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={village} onChange={(e) => setVillage(e.target.value)} />
        )}
      </Field>

      <Button size="xl" onClick={save} disabled={saving || (touched && !valid)}>
        <Check aria-hidden="true" size={22} />
        {t('thekedar.save')}
      </Button>
    </section>
  );
}
