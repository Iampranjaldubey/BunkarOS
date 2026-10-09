import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Volume2, VolumeX, Undo2, CheckCircle2, XCircle, Clock, Mic, Loader2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Field } from '../../components/ui/Field';
import { Textarea } from '../../components/ui/Input';
import { Money } from '../../components/ui/Money';
import { EmptyState } from '../../components/ui/Feedback';
import { Sheet } from '../../components/ui/Sheet';
import { PageGrid } from '../../components/ui/PageGrid';
import { PreviewShareSheet } from '../../components/ui/PreviewShareSheet';
import { useToast } from '../../components/ui/Toast';
import { Row, weaverById, today } from '../shared/helpers';
import { useRecords, useSession } from '../../db/hooks';
import { reverse } from '../../db/repo';
import type { Rec, BazaarP, SlipP, SlipResponseP } from '../../db/types';
import { peshgiBalance, formatDay } from '../../domain/projections';
import { can } from '../../domain/permissions';
import { gramsToKgStr, formatFtIn } from '../../domain/units';
import { formatINR } from '../../domain/money';
import { useT } from '../../i18n';

export default function BazaarDetailPage() {
  const { t, lang } = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const { role, user } = useSession();

  const [share, setShare] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState('');
  const [speaking, setSpeaking] = useState(false);
  // Voice-note (audio clip) share flow.
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [online, setOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  // Revoke the object URL when the sheet closes / component unmounts.
  useEffect(() => () => { if (voiceUrl) URL.revokeObjectURL(voiceUrl); }, [voiceUrl]);

  const rec = useMemo(() => recs.find((r) => r.id === id && r.type === 'bazaar') as Rec<BazaarP> | undefined, [recs, id]);
  const reversed = useMemo(
    () => recs.some((r) => r.type === 'reversal' && r.sync !== 'rejected' && (r.payload as { targetId: string }).targetId === id),
    [recs, id],
  );
  const slip = useMemo(
    () => recs.find((r) => r.type === 'slip' && (r.payload as SlipP).sourceId === id) as Rec<SlipP> | undefined,
    [recs, id],
  );
  const response = useMemo(
    () =>
      slip
        ? (recs.find(
            (r) => r.type === 'slip_response' && (r.payload as SlipResponseP).token === (slip.payload as SlipP).token,
          ) as Rec<SlipResponseP> | undefined)
        : undefined,
    [recs, slip],
  );
  const [slipSent, setSlipSent] = useState(false);

  if (!rec) {
    return (
      <section>
        <PageHeader title={t('bazaar.detail.title')} back />
        <EmptyState title={t('bazaar.detail.notFound')} action={<Button onClick={() => navigate('/')}>{t('nav.home')}</Button>} />
      </section>
    );
  }

  const b = rec.payload;
  const weaver = weaverById(recs, b.weaverId);
  const slipText = slip ? (slip.payload as SlipP).textHi : undefined;
  const token = slip ? (slip.payload as SlipP).token : undefined;
  const shareText = slipText ? `${slipText}\n${location.origin}/s/${token}` : '';

  // Reverse permission (N2): owner any day; munshi only own records from today.
  const canReverse = role
    ? can(role, 'record.reverse.any') || (can(role, 'record.reverse.ownToday') && rec.by === user?.id && rec.day === today())
    : false;

  const peshgiAfter = peshgiBalance(recs, 'weaver', b.weaverId);

  const speak = () => {
    if (!('speechSynthesis' in window) || !slipText) {
      toast.show(t('bazaar.detail.voiceNA'), 'error');
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(slipText);
    u.lang = 'hi-IN';
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  // Prepare the voice note: the slip must be synced (so the server has it) and
  // we must be online to fetch the generated clip. Clear Hindi messages otherwise.
  const openVoiceShare = async () => {
    if (!token) return;
    if (!online) { toast.show(t('audio.needOnline'), 'error'); return; }
    if (slip && slip.sync !== 'synced') { toast.show(t('audio.needSync'), 'error'); return; }
    setVoiceBusy(true);
    try {
      const res = await fetch(`/api/slips/${encodeURIComponent(token)}/audio`);
      if (!res.ok) {
        // 503 tts_unavailable / offline → fall back to the existing text+link share.
        toast.show(t('audio.unavailable'), 'error');
        setShare(true);
        return;
      }
      const blob = await res.blob();
      if (voiceUrl) URL.revokeObjectURL(voiceUrl);
      setVoiceBlob(blob);
      setVoiceUrl(URL.createObjectURL(blob));
      setVoiceOpen(true);
    } catch {
      toast.show(t('audio.unavailable'), 'error');
      setShare(true);
    } finally {
      setVoiceBusy(false);
    }
  };

  const doVoiceShare = async () => {
    if (!voiceBlob) return;
    const file = new File([voiceBlob], `slip-${b.pieceId.replace(/\//g, '-')}.wav`, { type: 'audio/wav' });
    const nav = navigator as Navigator & {
      canShare?: (d: ShareData) => boolean;
      share?: (d: ShareData) => Promise<void>;
    };
    const data: ShareData = { files: [file], text: shareText, title: t('audio.sheetTitle') };
    if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      try {
        await nav.share(data);
        setSlipSent(true);
        toast.show(t('audio.shared'), 'success');
      } catch {
        // User cancelled or share failed — stay on the sheet, no error noise.
      }
    } else {
      // No Web Share with files → fall back to the existing text+link share.
      setVoiceOpen(false);
      setShare(true);
      return;
    }
    setVoiceOpen(false);
  };

  const doReverse = async () => {
    await reverse(rec.id, reverseReason.trim() || '—');
    toast.show(t('bazaar.detail.reverseDone'), 'success');
    setReverseOpen(false);
    navigate('/');
  };

  const sent = slipSent || Boolean(response);

  return (
    <section>
      <PageHeader title={`${t('bazaar.detail.title')} · ${b.pieceId}`} back />

      <PageGrid
        asideSticky
        className="gap-0 lg:gap-6"
        main={
          <>
      {reversed && (
        <Badge tone="danger" className="mb-4">
          {t('bazaar.detail.reversed')}
        </Badge>
      )}

      {/* Receipt summary */}
      <Card className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-lg font-semibold text-ink">{weaver?.name ?? '—'}</span>
          <span className="text-sm text-muted">{formatDay(rec.day, lang, 'medium')}</span>
        </div>
        <Row label={t('bazaar.area')}>
          {b.areaSqft.toFixed(2)} {t('bazaar.areaUnit')} ({formatFtIn(b.lengthIn)}×{formatFtIn(b.widthIn)})
        </Row>
        <Row label={t('bazaar.wage.rateLocked')}>
          {formatINR(b.ratePaise)}{b.rateUnit === 'sqgaj' ? t('bazaar.wage.rateUnitSqgaj') : t('bazaar.wage.rateUnitSqft')}
        </Row>
        <div className="my-1 border-t border-line" />
        <Row label={t('bazaar.wage.gross')}><Money paise={b.grossPaise} withPaise size="md" /></Row>
        {b.deductions.map((d, i) => (
          <Row key={i} label={`${t('bazaar.wage.deductions')}: ${d.reason}`}>
            <Money paise={d.amountPaise} flow="given" signed withPaise size="md" />
          </Row>
        ))}
        {b.peshgiRecoveredPaise > 0 && (
          <Row label={t('bazaar.wage.peshgi')}>
            <Money paise={b.peshgiRecoveredPaise} flow="given" signed withPaise size="md" />
          </Row>
        )}
        <Row label={t('bazaar.wage.net')}><Money paise={b.netPaise} withPaise size="md" /></Row>
        <Row label={t('bazaar.wage.rounding', { amount: formatINR(b.roundingPaise, { paise: true }) })}>
          {formatINR(b.roundingPaise, { paise: true })}
        </Row>
        <div className="my-1 border-t border-line" />
        <Row label={t('bazaar.wage.paid')} strong>
          <Money paise={b.paidPaise} flow="received" size="xl" />
        </Row>
        <p className="mt-1 text-right text-sm text-muted">
          {t('bazaar.pay.cash')} {formatINR(b.payment.cashPaise)} · {t('bazaar.pay.upi')} {formatINR(b.payment.upiPaise)}
        </p>
      </Card>

      {/* Tauli section */}
      <Card className="mb-4">
        <h2 className="mb-2 text-lg">{t('bazaar.detail.tauli')}</h2>
        <Row label={t('bazaar.tauli.issued')}>{gramsToKgStr(b.tauli.issuedG)} {t('common.kg')}</Row>
        <Row label={t('bazaar.tauli.returned')}>{gramsToKgStr(b.tauli.returnedG)} {t('common.kg')}</Row>
        <Row label={t('bazaar.tauli.used')}>{gramsToKgStr(b.tauli.usedG)} {t('common.kg')}</Row>
        <Row label={t('bazaar.tauli.allowed', { pct: b.tauli.wastagePct })}>{gramsToKgStr(b.tauli.allowedG)} {t('common.kg')}</Row>
        {b.tauli.shortG > 0 && (
          <Row label={t('bazaar.tauli.short')} strong>
            <span className="text-madder">{gramsToKgStr(b.tauli.shortG)} {t('common.kg')}</span>
          </Row>
        )}
        {b.tauli.extraG > 0 && (
          <Row label={t('bazaar.tauli.extra')}>
            <span className="text-saffron-ink">{gramsToKgStr(b.tauli.extraG)} {t('common.kg')}</span>
          </Row>
        )}
        {b.tauli.cause && <Row label={t('bazaar.tauli.cause')}>{t(`bazaar.cause.${b.tauli.cause}`)}</Row>}
      </Card>
          </>
        }
        aside={
          <>
      {/* Slip status */}
      <Card className="mb-4">
        <h2 className="mb-2 text-lg">{t('bazaar.detail.slip')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {sent ? (
            <Badge tone="received"><Send aria-hidden="true" size={14} />{t('bazaar.detail.slipSent')}</Badge>
          ) : (
            <Badge tone="neutral"><Clock aria-hidden="true" size={14} />{t('bazaar.detail.slipNotSent')}</Badge>
          )}
          {response?.payload.answer === 'agree' && (
            <Badge tone="received"><CheckCircle2 aria-hidden="true" size={14} />{t('bazaar.detail.agreed')}</Badge>
          )}
          {response?.payload.answer === 'dispute' && (
            <Badge tone="danger"><XCircle aria-hidden="true" size={14} />{t('bazaar.detail.disputed')}</Badge>
          )}
          {!response && sent && <Badge tone="warn"><Clock aria-hidden="true" size={14} />{t('bazaar.detail.noResponse')}</Badge>}
        </div>
        <p className="mt-2 text-sm text-muted">{t('bazaar.wage.peshgiBalance', { amount: formatINR(peshgiAfter) })}</p>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button data-testid="slip-share" disabled={!slip || !weaver?.phone} onClick={() => setShare(true)}>
          <Send aria-hidden="true" size={20} />
          {t('bazaar.detail.sendWa')}
        </Button>
        <Button
          data-testid="slip-voice-share"
          variant="secondary"
          disabled={!slip || voiceBusy}
          onClick={() => void openVoiceShare()}
        >
          {voiceBusy ? <Loader2 aria-hidden="true" className="animate-spin" size={20} /> : <Mic aria-hidden="true" size={20} />}
          {voiceBusy ? t('audio.preparing') : t('audio.send')}
        </Button>
        <Button variant="secondary" onClick={speak} disabled={!slipText}>
          {speaking ? <VolumeX aria-hidden="true" size={20} /> : <Volume2 aria-hidden="true" size={20} />}
          {speaking ? t('bazaar.detail.voiceOff') : t('bazaar.detail.playVoice')}
        </Button>
        {!reversed && canReverse && (
          <Button variant="ghost" onClick={() => setReverseOpen(true)}>
            <Undo2 aria-hidden="true" size={20} />
            {t('bazaar.detail.reverse')}
          </Button>
        )}
        {!reversed && !canReverse && (
          <p className="text-center text-sm text-muted">{t('bazaar.detail.cannotReverseHint')}</p>
        )}
      </div>
          </>
        }
      />

      <PreviewShareSheet
        open={share}
        onClose={() => setShare(false)}
        recipientName={weaver?.name ?? ''}
        phone={weaver?.phone ?? ''}
        text={shareText}
        onConfirm={() => {
          setSlipSent(true);
          toast.show(t('bazaar.detail.slipSent'), 'success');
        }}
      />

      <Sheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        title={t('audio.sheetTitle')}
        footer={
          <>
            <Button variant="secondary" block onClick={() => setVoiceOpen(false)}>{t('action.cancel')}</Button>
            <Button variant="success" block data-testid="voice-confirm" onClick={() => void doVoiceShare()}>
              <Send aria-hidden="true" size={20} />
              {t('audio.confirmSend')}
            </Button>
          </>
        }
      >
        <dl className="mb-3">
          <dt className="text-sm text-muted">{t('audio.recipient')}</dt>
          <dd className="text-lg font-medium text-ink">
            {weaver?.name ?? '—'} <span className="num text-muted">· {weaver?.phone ?? ''}</span>
          </dd>
        </dl>
        <p className="mb-1 text-sm text-muted">{t('audio.previewLabel')}</p>
        {voiceUrl && (
          <audio
            data-testid="voice-preview"
            controls
            src={voiceUrl}
            className="w-full"
            aria-label={t('audio.previewLabel')}
          />
        )}
      </Sheet>

      <Sheet
        open={reverseOpen}
        onClose={() => setReverseOpen(false)}
        title={t('bazaar.detail.reverse')}
        footer={
          <>
            <Button variant="secondary" block onClick={() => setReverseOpen(false)}>{t('action.cancel')}</Button>
            <Button variant="danger" block onClick={() => void doReverse()}>{t('action.reverse')}</Button>
          </>
        }
      >
        <p className="mb-3 text-base text-muted">{t('bazaar.detail.reverseHint')}</p>
        <Field label={t('bazaar.detail.reverseReason')} required>
          {({ id }) => <Textarea id={id} value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} />}
        </Field>
      </Sheet>
    </section>
  );
}
