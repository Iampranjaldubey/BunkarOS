import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Plus, Trash2, AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Field } from '../../components/ui/Field';
import { FtInInput } from '../../components/ui/FtInInput';
import { KgInput, MoneyInput } from '../../components/ui/NumberInputs';
import { PhotoCapture } from '../../components/ui/PhotoCapture';
import { ConfirmSheet } from '../../components/ui/Sheet';
import { Money } from '../../components/ui/Money';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { PiecePicker } from '../shared/pickers';
import { Stepper, Row, photoThresholdPaise, wastagePct, weaverById, today, ActionBar } from '../shared/helpers';
import { useRecords } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { BazaarP, Deduction, SlipP, TauliCause, TauliResult } from '../../db/types';
import { listPieces, rateForPiece, normFor, pieceYarn, peshgiBalance } from '../../domain/projections';
import { pieceQuality } from '../../domain/rates';
import { areaSqft, gramsToKgStr, formatFtIn } from '../../domain/units';
import { computeWage } from '../../domain/wage';
import { computeTauli } from '../../domain/tauli';
import { roundToRupee, formatINR } from '../../domain/money';
import { buildBazaarSlip } from '../../domain/slip';
import { slipToken } from '../../domain/ids';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

const CAUSES: TauliCause[] = ['moisture', 'less_wool_returned', 'wrong_weighing', 'other'];

export default function BazaarNewPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const [params] = useSearchParams();

  const [step, setStep] = useState(0);
  const [pieceId, setPieceId] = useState<string | undefined>(params.get('piece') ?? undefined);
  const [lengthIn, setLengthIn] = useState(0);
  const [widthIn, setWidthIn] = useState(0);
  const [carpetG, setCarpetG] = useState(0);
  const [cause, setCause] = useState<TauliCause | undefined>();
  const [weaverAck, setWeaverAck] = useState(false);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [peshgiRecover, setPeshgiRecover] = useState(0);
  const [cashPaise, setCashPaise] = useState(0);
  const [upiPaise, setUpiPaise] = useState(0);
  const [payPhotoId, setPayPhotoId] = useState<string | undefined>();
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const piece = useMemo(() => listPieces(recs).find((p) => p.pieceId === pieceId), [recs, pieceId]);
  const alreadyDone = Boolean(piece && piece.status === 'off_loom');

  // Prefill size from the piece/order when the piece is chosen.
  useEffect(() => {
    if (piece && lengthIn === 0 && widthIn === 0) {
      setLengthIn(piece.lengthIn);
      setWidthIn(piece.widthIn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece?.pieceId]);

  const area = areaSqft(lengthIn, widthIn);

  const rate = useMemo(() => (pieceId ? rateForPiece(recs, pieceId, today()) : undefined), [recs, pieceId]);
  const quality = useMemo(() => (pieceId ? pieceQuality(recs, pieceId) : undefined), [recs, pieceId]);
  const normG = quality ? normFor(recs, quality) : undefined;

  const yarn = useMemo(() => (pieceId ? pieceYarn(recs, pieceId) : { issuedG: 0, returnedG: 0 }), [recs, pieceId]);
  const noYarn = yarn.issuedG === 0;
  const pct = wastagePct(recs);

  const tauli: TauliResult = useMemo(
    () =>
      computeTauli({
        issuedG: yarn.issuedG,
        returnedG: yarn.returnedG,
        carpetG,
        wastagePct: pct,
        areaSqft: area,
        normGPerSqft: normG,
      }),
    [yarn.issuedG, yarn.returnedG, carpetG, pct, area, normG],
  );
  const short = noYarn ? 0 : tauli.shortG;
  const extra = noYarn ? 0 : tauli.extraG;

  const gross = rate ? computeWage({ areaSqft: area, ratePaise: rate.ratePaise, rateUnit: rate.unit }) : 0;
  const dedTotal = deductions.reduce((s, d) => s + d.amountPaise, 0);
  const grossAfterDed = Math.max(0, gross - dedTotal);

  const weaverId = piece?.weaverId;
  const peshgiBal = useMemo(
    () => (weaverId ? peshgiBalance(recs, 'weaver', weaverId) : 0),
    [recs, weaverId],
  );
  const maxRecover = Math.min(peshgiBal, grossAfterDed);
  const recoverTooMuch = peshgiRecover > maxRecover;
  const effRecover = Math.min(peshgiRecover, maxRecover);

  const net = gross - dedTotal - effRecover;
  const { paid, rounding } = roundToRupee(Math.max(0, net));

  const threshold = photoThresholdPaise(recs);
  const payNeedsPhoto = paid > threshold;
  const paySum = cashPaise + upiPaise;
  const paySumOk = paySum === paid;

  // ---- step validity ----
  const canNext = (s: number): boolean => {
    switch (s) {
      case 0:
        return Boolean(pieceId && piece && !alreadyDone);
      case 1:
        return lengthIn > 0 && widthIn > 0 && carpetG > 0;
      case 2:
        return noYarn ? weaverAck : short > 0 ? Boolean(cause) && weaverAck : true;
      case 3:
        return Boolean(rate) && !recoverTooMuch && deductions.every((d) => d.reason.trim() && d.amountPaise > 0 && d.photoId);
      case 4:
        return paySumOk && (!payNeedsPhoto || Boolean(payPhotoId));
      default:
        return true;
    }
  };

  const addDeduction = () => setDeductions((d) => [...d, { reason: '', amountPaise: 0, photoId: '' }]);
  const updateDeduction = (i: number, patch: Partial<Deduction>) =>
    setDeductions((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const removeDeduction = (i: number) => setDeductions((d) => d.filter((_, j) => j !== i));

  // Default the whole paid amount to cash when entering the payment step. Done in the
  // step transition (not a post-render effect) so step 5 paints with the default already
  // filled — no flash of an empty field, and nothing can overwrite what the user types.
  const goNext = () => {
    if (step === 3 && cashPaise === 0 && upiPaise === 0 && paid > 0) setCashPaise(paid);
    setStep((s) => s + 1);
  };

  const onSave = async () => {
    if (!piece || !rate || !weaverId) return;
    setSaving(true);
    try {
      const tauliFinal: TauliResult = {
        ...tauli,
        shortG: short,
        extraG: extra,
        ...(short > 0 ? { cause, weaverAck } : noYarn ? { weaverAck } : {}),
      };
      const payload: BazaarP = {
        pieceId: piece.pieceId,
        loomId: piece.loomId ?? '',
        weaverId,
        thekedarId: undefined,
        lengthIn,
        widthIn,
        areaSqft: area,
        carpetGrams: carpetG,
        rateId: rate.entityId,
        ratePaise: rate.ratePaise,
        rateUnit: rate.unit,
        grossPaise: gross,
        deductions,
        peshgiRecoveredPaise: effRecover,
        netPaise: net,
        paidPaise: paid,
        roundingPaise: rounding,
        payment: { cashPaise, upiPaise },
        tauli: tauliFinal,
      };
      const photoIds = deductions.map((d) => d.photoId).filter(Boolean);
      if (payPhotoId) photoIds.push(payPhotoId);
      const rec = await addRecord<BazaarP>('bazaar', payload, photoIds.length ? { photoIds } : {});

      // Build + store the weaver slip (buildBazaarSlip + slipToken).
      const weaver = weaverById(recs, weaverId);
      const draft = buildBazaarSlip({
        bazaar: payload,
        sourceId: rec.id,
        weaverName: weaver?.name ?? '',
        weaverPhone: weaver?.phone ?? '',
        peshgiBalanceAfterPaise: peshgiBal - effRecover,
      });
      const slip: SlipP = { ...draft, token: slipToken() } as SlipP;
      await addRecord<SlipP>('slip', slip);

      toast.show(t('bazaar.saved', { paid: formatINR(paid) }), 'success');
      navigate(`/bazaar/${rec.id}`);
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  };

  const STEP_TITLES = [
    t('bazaar.step.piece'),
    t('bazaar.step.measure'),
    t('bazaar.step.tauli'),
    t('bazaar.step.wage'),
    t('bazaar.step.payment'),
    t('bazaar.step.review'),
  ];

  const pieceList = listPieces(recs);
  const noPieces = pieceList.filter((p) => p.status === 'on_loom').length === 0 && !piece;

  return (
    <section data-testid="bazaar-area">
      <PageHeader title={`${t('bazaar.new')} · ${t('bazaar.step', { n: step + 1 })}`} back={step === 0 ? true : () => setStep((s) => s - 1)} />
      <Stepper step={step} total={6} />
      <h2 className="mb-3 text-xl">{STEP_TITLES[step]}</h2>

      {/* STEP 0 — pick piece */}
      {step === 0 && (
        <>
          {alreadyDone && piece ? (
            <EmptyState
              icon={<Info size={40} />}
              title={t('bazaar.alreadyDone')}
              hint={t('bazaar.alreadyDoneHint')}
              action={
                piece.bazaarId ? (
                  <Button onClick={() => navigate(`/bazaar/${piece.bazaarId}`)}>{t('bazaar.viewExisting')}</Button>
                ) : undefined
              }
            />
          ) : noPieces ? (
            <EmptyState title={t('bazaar.noPieces')} hint={t('bazaar.noPiecesHint')} />
          ) : (
            <Card>
              <PiecePicker recs={recs} value={pieceId} onSelect={setPieceId} />
            </Card>
          )}
        </>
      )}

      {/* STEP 1 — measure */}
      {step === 1 && (
        <Card>
          <p className="mb-3 text-sm text-muted">{t('bazaar.sizeHint')}</p>
          <Field label={t('bazaar.length')} required>
            {({ describedBy }) => <FtInInput value={lengthIn} onChange={setLengthIn} describedBy={describedBy} />}
          </Field>
          <Field label={t('bazaar.width')} required>
            {({ describedBy }) => <FtInInput value={widthIn} onChange={setWidthIn} describedBy={describedBy} />}
          </Field>
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-indigo/20 bg-indigo/5 p-3">
            <span className="text-base text-muted">{t('bazaar.area')}</span>
            <span className="num text-3xl font-bold text-indigo" data-testid="bazaar-area-value">
              {area.toFixed(2)} <span className="text-lg text-muted">{t('bazaar.areaUnit')}</span>
            </span>
          </div>
          <Field label={t('bazaar.carpetWeight')} required>
            {({ describedBy, invalid }) => (
              <KgInput value={carpetG} onChange={setCarpetG} describedBy={describedBy} invalid={invalid} aria-label={t('bazaar.carpetWeight')} />
            )}
          </Field>
        </Card>
      )}

      {/* STEP 2 — tauli */}
      {step === 2 && (
        <Card>
          {noYarn && (
            <Badge tone="warn" className="mb-3">
              <AlertTriangle aria-hidden="true" size={14} />
              {t('bazaar.tauli.noYarn')}
            </Badge>
          )}
          <Row label={t('bazaar.tauli.issued')}>
            <span className="text-madder">{gramsToKgStr(tauli.issuedG)} {t('common.kg')}</span>
          </Row>
          <Row label={t('bazaar.tauli.returned')}>
            <span className="text-ok">{gramsToKgStr(tauli.returnedG)} {t('common.kg')}</span>
          </Row>
          <Row label={t('bazaar.tauli.used')} strong>{gramsToKgStr(tauli.usedG)} {t('common.kg')}</Row>
          <div className="my-2 border-t border-line" />
          <Row label={t('bazaar.tauli.allowed', { pct })}>{gramsToKgStr(tauli.allowedG)} {t('common.kg')}</Row>
          <Row label={t('bazaar.tauli.gap')}>{gramsToKgStr(tauli.gapG)} {t('common.kg')}</Row>
          {normG !== undefined && (
            <Row label={t('bazaar.tauli.expected')}>{gramsToKgStr(tauli.expectedG ?? 0)} {t('common.kg')}</Row>
          )}

          {!noYarn && short > 0 && (
            <div className="mt-2 rounded-2xl border border-madder/30 bg-madder/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-madder">{t('bazaar.tauli.short')}</span>
                <span className="num text-2xl font-bold text-madder" data-testid="tauli-short">
                  {gramsToKgStr(short)} {t('common.kg')}
                </span>
              </div>
              <p className="mb-2 text-sm text-madder">{t('bazaar.tauli.shortWarn')}</p>
              <p className="mb-1.5 text-base font-medium text-ink">{t('bazaar.tauli.cause')}</p>
              <div className="flex flex-wrap gap-2">
                {CAUSES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={cause === c}
                    onClick={() => setCause(c)}
                    className={cn(
                      'min-h-12 rounded-full border px-4 text-base font-medium transition-colors focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink',
                      cause === c ? 'border-madder bg-madder text-white' : 'border-line bg-surface text-ink hover:bg-bg',
                    )}
                  >
                    {t(`bazaar.cause.${c}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!noYarn && extra > 0 && (
            <div className="mt-2 rounded-2xl border border-saffron/40 bg-saffron/10 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-saffron-ink">{t('bazaar.tauli.extra')}</span>
                <span className="num text-xl font-bold text-saffron-ink">{gramsToKgStr(extra)} {t('common.kg')}</span>
              </div>
              <p className="text-sm text-saffron-ink">{t('bazaar.tauli.extraInfo')}</p>
            </div>
          )}

          {(short > 0 || noYarn) && (
            <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-line p-3">
              <span>
                <span className="block text-base font-medium text-ink">{t('bazaar.tauli.ack')}</span>
                <span className="block text-sm text-muted">{t('bazaar.tauli.ackHint')}</span>
              </span>
              <input
                type="checkbox"
                checked={weaverAck}
                onChange={(e) => setWeaverAck(e.target.checked)}
                className="h-8 w-8 shrink-0 accent-indigo"
                aria-label={t('bazaar.tauli.ack')}
              />
            </label>
          )}
        </Card>
      )}

      {/* STEP 3 — wage */}
      {step === 3 && (
        <>
          {!rate ? (
            <Card className="border-madder/30 bg-madder/5">
              <p className="mb-1 flex items-center gap-2 text-lg font-semibold text-madder">
                <AlertTriangle aria-hidden="true" size={20} />
                {t('bazaar.wage.rateMissing')}
              </p>
              <p className="mb-3 text-base text-muted">{t('bazaar.wage.rateMissingHint')}</p>
              <Link to="/rates">
                <Button variant="danger">
                  {t('bazaar.wage.goRates')}
                  <ArrowRight aria-hidden="true" size={18} />
                </Button>
              </Link>
            </Card>
          ) : (
            <>
              <Card className="mb-4">
                <Row label={t('bazaar.wage.rateLocked')}>
                  {rate.unit === 'piece'
                    ? `${formatINR(rate.ratePaise)} ${t('rate.unit.piece')}`
                    : `${formatINR(rate.ratePaise)}${rate.unit === 'sqgaj' ? t('bazaar.wage.rateUnitSqgaj') : t('bazaar.wage.rateUnitSqft')}`}
                </Row>
                {rate.unit !== 'piece' && (
                  <Row label={`${t('bazaar.area')} × ${t('bazaar.wage.rate')}`}>{area.toFixed(2)} {t('bazaar.areaUnit')}</Row>
                )}
                <div className="my-1 border-t border-line" />
                <Row label={t('bazaar.wage.gross')} strong>
                  <span data-testid="bazaar-gross"><Money paise={gross} withPaise /></span>
                </Row>
              </Card>

              <Card className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-lg">{t('bazaar.wage.deductions')}</h3>
                  <Button variant="secondary" size="md" onClick={addDeduction}>
                    <Plus aria-hidden="true" size={18} />
                    {t('bazaar.wage.addDeduction')}
                  </Button>
                </div>
                {deductions.length === 0 && <p className="text-sm text-muted">{t('bazaar.wage.dedPhotoReq')}</p>}
                <ul className="flex flex-col gap-3">
                  {deductions.map((d, i) => (
                    <li key={i} className="rounded-2xl border border-line p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-muted">#{i + 1}</span>
                        <button type="button" onClick={() => removeDeduction(i)} className="tap-48 inline-flex items-center gap-1 text-madder focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink" aria-label={t('bazaar.wage.removeDeduction')}>
                          <Trash2 aria-hidden="true" size={18} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label={t('bazaar.wage.dedReason')} required>
                          {({ id }) => (
                            <Input id={id} value={d.reason} onChange={(e) => updateDeduction(i, { reason: e.target.value })} placeholder={t('bazaar.wage.dedReasonPh')} />
                          )}
                        </Field>
                        <Field label={t('bazaar.wage.dedAmount')} required>
                          {() => <MoneyInput value={d.amountPaise} onChange={(p) => updateDeduction(i, { amountPaise: p })} aria-label={t('bazaar.wage.dedAmount')} />}
                        </Field>
                      </div>
                      <PhotoCapture
                        value={d.photoId || undefined}
                        onChange={(pid) => updateDeduction(i, { photoId: pid ?? '' })}
                        required
                        label={t('bazaar.wage.dedPhoto')}
                        error={!d.photoId ? t('bazaar.wage.dedPhotoReq') : undefined}
                      />
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="mb-4">
                <h3 className="mb-2 text-lg">{t('bazaar.wage.peshgi')}</h3>
                {peshgiBal <= 0 ? (
                  <p className="text-base text-muted">{t('bazaar.wage.peshgiNone')}</p>
                ) : (
                  <>
                    <p className="mb-2 text-base text-madder">{t('bazaar.wage.peshgiBalance', { amount: formatINR(peshgiBal) })}</p>
                    <Field label={t('bazaar.wage.peshgi')} error={recoverTooMuch ? t('bazaar.wage.peshgiTooMuch') : undefined}>
                      {({ describedBy, invalid }) => (
                        <MoneyInput value={peshgiRecover} onChange={setPeshgiRecover} describedBy={describedBy} invalid={invalid} aria-label={t('bazaar.wage.peshgi')} />
                      )}
                    </Field>
                    <Button variant="ghost" size="md" onClick={() => setPeshgiRecover(maxRecover)}>
                      {formatINR(maxRecover)}
                    </Button>
                  </>
                )}
              </Card>

              <Card className="bg-ok/5 border-ok/20">
                <Row label={t('bazaar.wage.net')}>
                  <span data-testid="bazaar-net"><Money paise={net} withPaise /></span>
                </Row>
                <Row label={t('bazaar.wage.rounding', { amount: formatINR(rounding, { paise: true }) })}>
                  {formatINR(rounding, { paise: true })}
                </Row>
                <div className="my-1 border-t border-line" />
                <Row label={t('bazaar.wage.paid')} strong>
                  <span data-testid="bazaar-paid"><Money paise={paid} flow="received" size="xl" /></span>
                </Row>
              </Card>
            </>
          )}
        </>
      )}

      {/* STEP 4 — payment split */}
      {step === 4 && (
        <>
          <Card className="mb-4">
            <Row label={t('bazaar.wage.paid')} strong>
              <Money paise={paid} flow="received" />
            </Row>
          </Card>
          <Card className="mb-4">
            <p className="mb-3 text-base font-medium text-ink">{t('bazaar.pay.split')}</p>
            <Field label={t('bazaar.pay.cash')}>
              {() => <MoneyInput value={cashPaise} onChange={setCashPaise} allowPaise aria-label={t('bazaar.pay.cash')} />}
            </Field>
            <Field label={t('bazaar.pay.upi')} error={!paySumOk ? t('bazaar.pay.mustSum', { amount: formatINR(paid) }) : undefined}>
              {({ invalid }) => <MoneyInput value={upiPaise} onChange={setUpiPaise} allowPaise invalid={invalid} aria-label={t('bazaar.pay.upi')} />}
            </Field>
            <div className="flex items-center justify-between rounded-2xl bg-bg p-3">
              <span className="text-base text-muted">{t('bazaar.pay.cash')} + {t('bazaar.pay.upi')}</span>
              <span className={cn('num text-xl font-bold', paySumOk ? 'text-ok' : 'text-madder')}>{formatINR(paySum)}</span>
            </div>
          </Card>
          {payNeedsPhoto && (
            <Card>
              <PhotoCapture value={payPhotoId} onChange={setPayPhotoId} required label={t('bazaar.pay.photo')} error={!payPhotoId ? t('bazaar.pay.photoReq', { amount: formatINR(threshold) }) : undefined} />
            </Card>
          )}
        </>
      )}

      {/* STEP 5 — review */}
      {step === 5 && piece && rate && (
        <>
          <p className="mb-3 text-muted">{t('bazaar.review.lead')}</p>
          <Card className="mb-4">
            <Row label={t('bazaar.review.piece')}>{piece.pieceId}</Row>
            <Row label={t('bazaar.review.weaver')}>{weaverById(recs, weaverId)?.name ?? '—'}</Row>
            <Row label={t('bazaar.area')}>{area.toFixed(2)} {t('bazaar.areaUnit')} ({formatFtIn(lengthIn)}×{formatFtIn(widthIn)})</Row>
            <Row label={t('bazaar.carpetWeight')}>{gramsToKgStr(carpetG)} {t('common.kg')}</Row>
          </Card>
          <Card className="mb-4">
            <Row label={t('bazaar.wage.gross')}><Money paise={gross} withPaise /></Row>
            {deductions.map((d, i) => (
              <Row key={i} label={`${t('bazaar.wage.deductions')}: ${d.reason}`}>
                <Money paise={d.amountPaise} flow="given" signed withPaise size="md" />
              </Row>
            ))}
            {effRecover > 0 && (
              <Row label={t('bazaar.wage.peshgi')}>
                <Money paise={effRecover} flow="given" signed withPaise size="md" />
              </Row>
            )}
            <Row label={t('bazaar.wage.net')}><Money paise={net} withPaise /></Row>
            <div className="my-1 border-t border-line" />
            <Row label={t('bazaar.wage.paid')} strong>
              <Money paise={paid} flow="received" size="xl" />
            </Row>
            <p className="mt-1 text-right text-sm text-muted">
              {t('bazaar.pay.cash')} {formatINR(cashPaise)} · {t('bazaar.pay.upi')} {formatINR(upiPaise)}
            </p>
          </Card>
          {short > 0 && (
            <Card className="mb-4 border-madder/30 bg-madder/5">
              <Row label={t('bazaar.tauli.short')}>
                <span className="text-madder">{gramsToKgStr(short)} {t('common.kg')}</span>
              </Row>
              {cause && <Row label={t('bazaar.tauli.cause')}>{t(`bazaar.cause.${cause}`)}</Row>}
            </Card>
          )}
        </>
      )}

      {/* footer nav */}
      <ActionBar>
        {step < 5 ? (
          <>
            {!canNext(step) && (
              <p className="mb-2 text-center text-sm text-saffron-ink" role="status">
                {t(`bazaar.next.need.${step}`)}
              </p>
            )}
            <Button size="xl" disabled={!canNext(step)} onClick={goNext}>
              {t('action.next')}
              <ArrowRight aria-hidden="true" size={20} />
            </Button>
          </>
        ) : (
          <Button data-testid="bazaar-save" variant="success" size="xl" disabled={saving} onClick={() => setConfirm(true)}>
            {t('bazaar.save')}
          </Button>
        )}
      </ActionBar>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => void onSave()}
        title={t('bazaar.confirmTitle')}
        confirmLabel={t('bazaar.save')}
        message={t('bazaar.confirmMsg', { weaver: weaverById(recs, weaverId)?.name ?? '', paid: formatINR(paid) })}
      />
    </section>
  );
}
