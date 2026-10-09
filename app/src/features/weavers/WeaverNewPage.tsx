import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import {
  Button,
  Field,
  Input,
  Select,
  SegmentedControl,
  PhotoCapture,
  useToast,
} from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import { listLooms } from '../../domain/projections';
import type { WeaverP, PhoneType } from '../../db/types';
import { uuid } from '../../domain/ids';
import { useT } from '../../i18n';

export default function WeaverNewPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const looms = useMemo(() => listLooms(recs).filter((l) => l.active), [recs]);

  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [village, setVillage] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneType, setPhoneType] = useState<PhoneType>('keypad');
  const [upi, setUpi] = useState('');
  const [loomId, setLoomId] = useState('');
  const [photoId, setPhotoId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const errName = touched && !name.trim() ? t('valid.required') : undefined;
  const errFather = touched && !fatherName.trim() ? t('valid.required') : undefined;
  const errVillage = touched && !village.trim() ? t('valid.required') : undefined;
  const errPhone = touched && phone.trim() && !/^\d{10}$/.test(phone.trim()) ? t('valid.phone') : undefined;
  const errPhoto = touched && !photoId ? t('valid.photoRequired') : undefined;
  const valid = name.trim() && fatherName.trim() && village.trim() && !errPhone && Boolean(photoId);

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    setSaving(true);
    try {
      const payload: WeaverP = {
        entityId: uuid(),
        name: name.trim(),
        fatherName: fatherName.trim(),
        village: village.trim(),
        phone: phone.trim(),
        phoneType,
        upi: upi.trim() || undefined,
        loomId: loomId || undefined,
        photoId,
        active: true,
      };
      await addRecord<WeaverP>('weaver', payload, photoId ? { photoIds: [photoId] } : {});
      toast.show(t('weaver.saved'), 'success');
      navigate('/weavers', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <PageHeader title={t('route.weaverNew')} back />

      <PhotoCapture value={photoId} onChange={setPhotoId} label={t('weaver.photo')} required error={errPhoto} />

      <Field label={t('weaver.field.name')} required error={errName}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={name} onChange={(e) => setName(e.target.value)} />
        )}
      </Field>

      <Field label={t('weaver.field.father')} required error={errFather}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
        )}
      </Field>

      <Field label={t('weaver.field.village')} required error={errVillage}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={village} onChange={(e) => setVillage(e.target.value)} />
        )}
      </Field>

      <Field label={t('weaver.field.phone')} hint={t('common.optional')} error={errPhone}>
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

      <div className="mb-4">
        <p className="mb-1.5 text-base font-medium text-ink">{t('weaver.field.phoneType')}</p>
        <SegmentedControl<PhoneType>
          label={t('weaver.field.phoneType')}
          value={phoneType}
          onChange={setPhoneType}
          options={[
            { value: 'smartphone', label: t('weaver.phoneType.smartphone') },
            { value: 'keypad', label: t('weaver.phoneType.keypad') },
            { value: 'shared', label: t('weaver.phoneType.shared') },
          ]}
        />
      </div>

      <Field label={t('weaver.field.upi')}>
        {({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@bank" />
        )}
      </Field>

      <Field label={t('weaver.field.loom')}>
        {({ id, describedBy }) => (
          <Select id={id} aria-describedby={describedBy} value={loomId} onChange={(e) => setLoomId(e.target.value)}>
            <option value="">{t('weaver.field.loom.none')}</option>
            {looms.map((l) => (
              <option key={l.entityId} value={l.entityId}>
                {l.code} — {l.village}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Button size="xl" onClick={save} disabled={saving || (touched && !valid)}>
        <Check aria-hidden="true" size={22} />
        {t('weaver.save')}
      </Button>
    </section>
  );
}
