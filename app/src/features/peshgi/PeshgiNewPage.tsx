import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Input';
import { Field } from '../../components/ui/Field';
import { MoneyInput } from '../../components/ui/NumberInputs';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { PhotoCapture } from '../../components/ui/PhotoCapture';
import { ConfirmSheet } from '../../components/ui/Sheet';
import { PreviewShareSheet } from '../../components/ui/PreviewShareSheet';
import { Money } from '../../components/ui/Money';
import { FormGrid } from '../../components/ui/FormGrid';
import { useToast } from '../../components/ui/Toast';
import { WeaverPicker } from '../shared/pickers';
import { photoThresholdPaise, weaverById, thekedarById, Row, ActionBar } from '../shared/helpers';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { PayMode, PeshgiP, SlipP } from '../../db/types';
import { peshgiBalance, listThekedars } from '../../domain/projections';
import { buildPeshgiSlip } from '../../domain/slip';
import { slipToken } from '../../domain/ids';
import { formatINR } from '../../domain/money';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

type Kind = 'weaver' | 'thekedar';

export default function PeshgiNewPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();

  const [kind, setKind] = useState<Kind>('weaver');
  const [personId, setPersonId] = useState<string | undefined>();
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<PayMode>('cash');
  const [note, setNote] = useState('');
  const [photoId, setPhotoId] = useState<string | undefined>();
  const [confirm, setConfirm] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [share, setShare] = useState<{ phone: string; name: string; text: string } | null>(null);

  const threshold = photoThresholdPaise(recs);
  const needsPhoto = amount > threshold;

  const balanceBefore = useMemo(
    () => (personId ? peshgiBalance(recs, kind, personId) : 0),
    [recs, kind, personId],
  );

  const thekedars = useMemo(() => listThekedars(recs).filter((x) => x.active), [recs]);

  const person = kind === 'weaver' ? weaverById(recs, personId) : thekedarById(recs, personId);
  const personName = person?.name ?? '';

  const amountErr = touched && amount <= 0 ? t('valid.positive') : undefined;
  const photoErr = touched && needsPhoto && !photoId ? t('peshgi.photoReq', { amount: formatINR(threshold) }) : undefined;

  const valid = Boolean(personId) && amount > 0 && (!needsPhoto || photoId);

  const doSave = async () => {
    if (!personId) return;
    setSaving(true);
    try {
      const payload: PeshgiP = { personKind: kind, personId, amountPaise: amount, mode, note: note.trim() || undefined };
      const rec = await addRecord<PeshgiP>('peshgi', payload, photoId ? { photoIds: [photoId] } : {});

      // For weavers, also create a peshgi slip so it can be shared/heard.
      if (kind === 'weaver') {
        const weaver = weaverById(recs, personId);
        const draft = buildPeshgiSlip({
          peshgi: payload,
          sourceId: rec.id,
          weaverName: weaver?.name ?? '',
          weaverPhone: weaver?.phone ?? '',
          balanceAfterPaise: balanceBefore + amount,
        });
        const token = slipToken();
        const slip: SlipP = { ...draft, token } as SlipP;
        await addRecord<SlipP>('slip', slip);
        if (weaver?.phone) setShare({ phone: weaver.phone, name: weaver.name, text: `${draft.textHi}\n${location.origin}/s/${token}` });
      }

      toast.show(t('peshgi.saved', { amount: formatINR(amount) }), 'success');
      if (kind !== 'weaver') navigate('/');
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  };

  return (
    <section>
      <PageHeader title={t('peshgi.new')} back />
      <p className="mb-4 text-muted">{t('peshgi.lead')}</p>

      <FormGrid>
      <Card className="lg:col-span-2">
        <p className="mb-2 text-base font-medium text-ink">{t('peshgi.who')}</p>
        <SegmentedControl
          label={t('peshgi.who')}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setPersonId(undefined);
          }}
          options={[
            { value: 'weaver', label: t('peshgi.kind.weaver') },
            { value: 'thekedar', label: t('peshgi.kind.thekedar') },
          ]}
          className="mb-3"
        />
        {kind === 'weaver' ? (
          <WeaverPicker recs={recs} value={personId} onSelect={setPersonId} />
        ) : thekedars.length === 0 ? (
          <p className="py-6 text-center text-muted">{t('tx.pick.none')}</p>
        ) : (
          <ul className="flex flex-col gap-2" role="listbox" aria-label={t('peshgi.kind.thekedar')}>
            {thekedars.map((th) => (
              <li key={th.entityId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={personId === th.entityId}
                  onClick={() => setPersonId(th.entityId)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink',
                    personId === th.entityId ? 'border-indigo bg-indigo/5' : 'border-line bg-surface hover:bg-bg',
                  )}
                >
                  <span>
                    <span className="block text-lg font-semibold text-ink">{th.name}</span>
                    <span className="block text-sm text-muted">{th.village}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {personId && (
        <>
          <Card>
            <Field label={t('peshgi.amount')} required error={amountErr}>
              {({ describedBy, invalid }) => (
                <MoneyInput value={amount} onChange={setAmount} describedBy={describedBy} invalid={invalid} aria-label={t('peshgi.amount')} />
              )}
            </Field>
            <div className="mb-4">
              <p className="mb-1.5 text-base font-medium text-ink">{t('peshgi.mode')}</p>
              <SegmentedControl
                label={t('peshgi.mode')}
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'cash', label: t('bazaar.pay.cash') },
                  { value: 'upi', label: t('bazaar.pay.upi') },
                ]}
              />
            </div>
            <Field label={`${t('peshgi.note')} (${t('common.optional')})`}>
              {({ id, describedBy }) => (
                <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('peshgi.notePh')} aria-describedby={describedBy} />
              )}
            </Field>
            <PhotoCapture
              value={photoId}
              onChange={setPhotoId}
              required={needsPhoto}
              label={needsPhoto ? t('peshgi.photo') : `${t('peshgi.photo')} (${t('common.optional')})`}
              error={photoErr}
            />
          </Card>

          <Card className="bg-madder/5 border-madder/20">
            <Row label={t('peshgi.balanceBefore')}>{formatINR(balanceBefore)}</Row>
            <div className="my-1 border-t border-line" />
            <Row label={t('peshgi.balanceAfter')} strong>
              <Money paise={balanceBefore + amount} flow="given" />
            </Row>
          </Card>
        </>
      )}
      </FormGrid>

      {!personId && <p className="px-6 py-8 text-center text-muted">{t('peshgi.pickWho')}</p>}

      <ActionBar>
        <Button
          data-testid="peshgi-save"
          variant="danger"
          size="xl"
          disabled={saving}
          onClick={() => {
            setTouched(true);
            if (valid) setConfirm(true);
          }}
        >
          {t('peshgi.save')}
        </Button>
      </ActionBar>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => void doSave()}
        danger
        title={t('peshgi.confirmTitle')}
        confirmLabel={t('peshgi.save')}
        message={t('peshgi.confirmMsg', { who: personName, amount: formatINR(amount) })}
      />

      {/* Peshgi slip share (weavers). After confirming the share, go home. */}
      <PreviewShareSheet
        open={Boolean(share)}
        onClose={() => {
          setShare(null);
          navigate('/');
        }}
        recipientName={share?.name ?? ''}
        phone={share?.phone ?? ''}
        text={share?.text ?? ''}
        onConfirm={() => toast.show(t('bazaar.detail.slipSent'), 'success')}
      />
    </section>
  );
}
