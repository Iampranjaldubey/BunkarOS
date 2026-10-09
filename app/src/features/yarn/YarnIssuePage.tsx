import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Field } from '../../components/ui/Field';
import { KgInput } from '../../components/ui/NumberInputs';
import { PhotoCapture } from '../../components/ui/PhotoCapture';
import { ConfirmSheet } from '../../components/ui/Sheet';
import { useToast } from '../../components/ui/Toast';
import { HolderPicker, PiecePicker } from '../shared/pickers';
import { holderLabel, ActionBar, today } from '../shared/helpers';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { Holder, YarnIssueP } from '../../db/types';
import { rateForPiece } from '../../domain/projections';
import { gramsToKgStr } from '../../domain/units';
import { formatINR } from '../../domain/money';
import { useT } from '../../i18n';

export default function YarnIssuePage() {
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();

  const [holder, setHolder] = useState<Holder | undefined>();
  const [piece, setPiece] = useState<string | undefined>();
  const [shade, setShade] = useState('');
  const [lot, setLot] = useState('');
  const [grams, setGrams] = useState(0);
  const [photoId, setPhotoId] = useState<string | undefined>();
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // When issuing to a loom, allow optionally attaching a piece (locks rate on first issue).
  const effHolder: Holder | undefined =
    holder?.kind === 'loom' && piece ? { kind: 'loom', loomId: holder.loomId, pieceId: piece } : holder;

  // Rate preview if this is the first yarn issue for the chosen piece.
  const rateInfo = useMemo(() => {
    if (!piece) return undefined;
    const r = rateForPiece(recs, piece, today());
    return r; // may be undefined
  }, [recs, piece]);

  const shadeErr = touched && !shade.trim() ? t('valid.required') : undefined;
  const lotErr = touched && !lot.trim() ? t('valid.required') : undefined;
  const gramsErr = touched && grams <= 0 ? t('valid.positive') : undefined;

  const valid = Boolean(holder) && shade.trim() && lot.trim() && grams > 0;

  const onSave = async () => {
    setSaving(true);
    try {
      const payload: YarnIssueP = { holder: effHolder!, shade: shade.trim(), lot: lot.trim(), grams };
      await addRecord<YarnIssueP>('yarn_issue', payload, photoId ? { photoIds: [photoId] } : {});
      toast.show(t('yarn.issue.saved', { kg: gramsToKgStr(grams) }), 'success');
      navigate('/yarn');
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  };

  return (
    <section>
      <PageHeader title={t('yarn.issue.title')} back />
      <p className="mb-4 text-muted">{t('yarn.issue.lead')}</p>

      <Card className="mb-4">
        <HolderPicker recs={recs} value={holder} onSelect={setHolder} label={t('tx.pick.holder')} />
      </Card>

      {holder?.kind === 'loom' && (
        <Card className="mb-4">
          <p className="mb-1 text-base font-medium text-ink">{t('yarn.issue.toPiece')}</p>
          <p className="mb-3 text-sm text-muted">{t('yarn.issue.toPieceHint')}</p>
          <PiecePicker
            recs={recs}
            value={piece}
            onSelect={(id) => setPiece((cur) => (cur === id ? undefined : id))}
            loomIds={[holder.loomId]}
          />
          {piece && (
            <div className="mt-3 rounded-2xl border border-indigo/20 bg-indigo/5 p-3">
              {rateInfo ? (
                <p className="flex items-start gap-2 text-base text-indigo">
                  <Info aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-semibold">
                      {t('yarn.issue.rateLocked', { rate: formatINR(rateInfo.ratePaise) })}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{t('yarn.issue.rateLockHint')}</span>
                  </span>
                </p>
              ) : (
                <p className="flex items-center gap-2 text-base text-saffron-ink">
                  <Info aria-hidden="true" size={18} />
                  {t('yarn.issue.rateNone')}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('yarn.issue.shade')} required error={shadeErr}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} value={shade} onChange={(e) => setShade(e.target.value)} placeholder={t('yarn.issue.shadePh')} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
            )}
          </Field>
          <Field label={t('yarn.issue.lot')} required error={lotErr}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} value={lot} onChange={(e) => setLot(e.target.value)} placeholder={t('yarn.issue.lotPh')} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="num" />
            )}
          </Field>
        </div>
        <Field label={t('yarn.issue.weight')} required error={gramsErr}>
          {({ describedBy, invalid }) => (
            <KgInput value={grams} onChange={setGrams} describedBy={describedBy} invalid={invalid} aria-label={t('yarn.issue.weight')} />
          )}
        </Field>
        <PhotoCapture value={photoId} onChange={setPhotoId} label={`${t('yarn.issue.scalePhoto')} (${t('common.optional')})`} />
      </Card>

      <ActionBar>
        <Button
          data-testid="yarn-issue-save"
          variant="danger"
          size="xl"
          disabled={saving}
          onClick={() => {
            setTouched(true);
            if (valid) setConfirm(true);
          }}
        >
          {t('yarn.issue.title')}
        </Button>
      </ActionBar>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => void onSave()}
        danger
        title={t('yarn.issue.confirmTitle')}
        confirmLabel={t('yarn.issue.title')}
        message={t('yarn.issue.confirmMsg', {
          holder: holder ? holderLabel(recs, effHolder!) : '',
          kg: gramsToKgStr(grams),
          shade,
        })}
      />
    </section>
  );
}
