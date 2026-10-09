import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Input';
import { KgInput } from '../../components/ui/NumberInputs';
import { ConfirmSheet } from '../../components/ui/Sheet';
import { FormGrid } from '../../components/ui/FormGrid';
import { useToast } from '../../components/ui/Toast';
import { HolderPicker } from '../shared/pickers';
import { holderLabel, ActionBar } from '../shared/helpers';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { Holder, YarnReturnP } from '../../db/types';
import { yarnBalances, listPieces } from '../../domain/projections';
import { gramsToKgStr } from '../../domain/units';
import { useT } from '../../i18n';

function holderKey(h: Holder): string {
  return h.kind === 'loom' ? `loom:${h.loomId}` : `thekedar:${h.thekedarId}`;
}

export default function YarnReturnPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();

  const [holder, setHolder] = useState<Holder | undefined>();
  const [shadeLot, setShadeLot] = useState('');
  const [grams, setGrams] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // Shade/lot balances held by the chosen holder (positive only).
  const held = useMemo(() => {
    if (!holder) return [];
    const hk = holderKey(holder);
    return yarnBalances(recs)
      .filter((r) => r.holderKey === hk && r.grams > 0)
      .sort((a, b) => `${a.shade}${a.lot}`.localeCompare(`${b.shade}${b.lot}`));
  }, [recs, holder]);

  const selected = held.find((r) => `${r.shade}|${r.lot}` === shadeLot);
  const heldG = selected?.grams ?? 0;

  const tooMuch = grams > heldG;
  const gramsErr = touched
    ? grams <= 0
      ? t('valid.positive')
      : tooMuch
        ? t('yarn.return.tooMuch', { kg: gramsToKgStr(heldG) })
        : undefined
    : undefined;

  const valid = Boolean(holder && selected) && grams > 0 && !tooMuch;

  const onSave = async () => {
    if (!holder || !selected) return;
    setSaving(true);
    try {
      // Attribute a loom return to the piece on that loom (if any) so the
      // piece's wool balance (pieceYarn → tauli) reflects the return. The issue
      // records already carry the pieceId; mirror that here. Without this a
      // loom-level return never reduces the piece's used wool.
      let effHolder: Holder = holder;
      if (holder.kind === 'loom' && !holder.pieceId) {
        const onLoom = listPieces(recs).find(
          (p) => p.loomId === holder.loomId && p.status === 'on_loom',
        );
        if (onLoom) effHolder = { kind: 'loom', loomId: holder.loomId, pieceId: onLoom.pieceId };
      }
      const payload: YarnReturnP = { holder: effHolder, shade: selected.shade, lot: selected.lot, grams };
      await addRecord<YarnReturnP>('yarn_return', payload);
      toast.show(t('yarn.return.saved', { kg: gramsToKgStr(grams) }), 'success');
      navigate('/yarn');
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  };

  return (
    <section>
      <PageHeader title={t('yarn.return.title')} back />
      <p className="mb-4 text-muted">{t('yarn.return.lead')}</p>

      <Card className="mb-4">
        <HolderPicker
          recs={recs}
          value={holder}
          onSelect={(h) => {
            setHolder(h);
            setShadeLot('');
            setGrams(0);
          }}
          label={t('tx.pick.holder')}
        />
      </Card>

      {holder && (
        <Card className="mb-4">
          {held.length === 0 ? (
            <p className="flex items-center gap-2 py-2 text-base text-muted">
              <Info aria-hidden="true" size={18} />
              {t('yarn.empty')}
            </p>
          ) : (
            <>
              <FormGrid>
                <Field label={t('yarn.shadeLot')} required>
                  {({ id, describedBy }) => (
                    <Select id={id} value={shadeLot} onChange={(e) => setShadeLot(e.target.value)} aria-describedby={describedBy}>
                      <option value="" disabled>
                        {t('yarn.return.pickFirst')}
                      </option>
                      {held.map((r) => (
                        <option key={`${r.shade}|${r.lot}`} value={`${r.shade}|${r.lot}`}>
                          {r.shade} · {r.lot} — {gramsToKgStr(r.grams)} {t('common.kg')}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                {selected && (
                  <div className="rounded-2xl border border-ok/20 bg-ok/5 p-3 text-base text-ok lg:order-last lg:col-span-2">
                    {t('yarn.return.held', { kg: gramsToKgStr(heldG) })}
                  </div>
                )}

                <Field label={t('yarn.issue.weight')} required error={gramsErr}>
                  {({ describedBy, invalid }) => (
                    <KgInput value={grams} onChange={setGrams} describedBy={describedBy} invalid={invalid} aria-label={t('yarn.issue.weight')} />
                  )}
                </Field>
              </FormGrid>
            </>
          )}
        </Card>
      )}

      <ActionBar>
        <Button
          variant="success"
          size="xl"
          disabled={saving}
          onClick={() => {
            setTouched(true);
            if (valid) setConfirm(true);
          }}
        >
          {t('yarn.return.title')}
        </Button>
      </ActionBar>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => void onSave()}
        title={t('yarn.return.confirmTitle')}
        confirmLabel={t('yarn.return.title')}
        message={t('yarn.return.confirmMsg', {
          holder: holder ? holderLabel(recs, holder) : '',
          kg: gramsToKgStr(grams),
          shade: selected?.shade ?? '',
        })}
      />
    </section>
  );
}
