import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Volume2, Square, Check, X, WifiOff, Loader2, Clock } from 'lucide-react';
import { useT } from '../../i18n';
import { formatINR } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface SlipLine {
  label: string;
  amountPaise?: number;
  value?: string;
  sign?: '+' | '-';
}
interface SlipView {
  kind: 'bazaar' | 'peshgi';
  weaverName: string;
  lines: SlipLine[];
  textHi: string;
  textEn: string;
  speechHi?: string;   // spoken Hindi script (server audio + TTS fallback)
}
interface SlipResponse {
  // The server returns the response as { answer, at }. Accept the nested
  // { payload: { answer } } shape too for forward-compatibility.
  answer?: 'agree' | 'dispute';
  payload?: { answer?: 'agree' | 'dispute'; note?: string };
}

type Status =
  | { kind: 'loading' }
  | { kind: 'offline' }
  | { kind: 'notfound' }
  | { kind: 'gone' }
  | { kind: 'ready'; slip: SlipView }
  | { kind: 'answered'; answer: 'agree' | 'dispute' }
  | { kind: 'done'; answer: 'agree' | 'dispute' };

export default function PublicSlipPage() {
  const { token = '' } = useParams();
  const { t, lang, setLang } = useT();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [slip, setSlip] = useState<SlipView | null>(null);
  const [showDisputeNote, setShowDisputeNote] = useState(false);
  const [note, setNote] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  // Audio-clip player (server WAV). 'idle' | 'loading' | 'playing' | 'fallback'.
  const [audioState, setAudioState] = useState<'idle' | 'loading' | 'playing' | 'fallback'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    setStatus({ kind: 'loading' });
    try {
      const res = await fetch(`/api/slips/${encodeURIComponent(token)}`);
      if (res.status === 404) { setStatus({ kind: 'notfound' }); return; }
      if (res.status === 410) { setStatus({ kind: 'gone' }); return; }
      if (!res.ok) { setStatus({ kind: 'offline' }); return; }
      const data = (await res.json()) as { slip: SlipView; response?: SlipResponse };
      setSlip(data.slip);
      const answered = data.response?.answer ?? data.response?.payload?.answer;
      if (answered) {
        setStatus({ kind: 'answered', answer: answered });
      } else {
        setStatus({ kind: 'ready', slip: data.slip });
      }
    } catch {
      setStatus({ kind: 'offline' });
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  // Document language + title for the public page (outside the app shell).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Stop any speech + audio when leaving.
  useEffect(() => () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, []);

  // Fallback: on-device TTS. Reads the spoken Hindi script (speechHi) when the
  // server provides it, else the slip text; English users get textEn.
  const speakFallback = () => {
    if (!slip) return;
    if (!('speechSynthesis' in window)) { setNoVoice(true); return; }
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const text = lang === 'en' ? slip.textEn : (slip.speechHi || slip.textHi);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'en' ? 'en-IN' : 'hi-IN';
    const voices = synth.getVoices();
    const hindi = voices.find((v) => v.lang === 'hi-IN' || v.lang.startsWith('hi'));
    if (lang !== 'en' && voices.length > 0 && !hindi) {
      // No Hindi voice available — tell the user to read instead.
      setNoVoice(true);
    }
    if (hindi) u.voice = hindi;
    u.onend = () => setSpeaking(false);
    u.onerror = () => { setSpeaking(false); setNoVoice(true); };
    setSpeaking(true);
    synth.speak(u);
  };

  // Primary: play the server-generated Hindi clip. On any error, fall back to
  // on-device speechSynthesis so the weaver always hears something.
  const playClip = () => {
    // Toggle off if already playing the clip or TTS.
    if (audioState === 'playing') {
      audioRef.current?.pause();
      setAudioState('idle');
      return;
    }
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }

    setNoVoice(false);
    setAudioState('loading');
    const el = new Audio(`/api/slips/${encodeURIComponent(token)}/audio`);
    audioRef.current = el;
    el.onplaying = () => setAudioState('playing');
    el.onended = () => setAudioState('idle');
    el.onerror = () => {
      // Clip unavailable (503/offline) → device-TTS fallback.
      audioRef.current = null;
      setAudioState('fallback');
      speakFallback();
    };
    void el.play().catch(() => {
      audioRef.current = null;
      setAudioState('fallback');
      speakFallback();
    });
  };

  const respond = async (answer: 'agree' | 'dispute') => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/slips/${encodeURIComponent(token)}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer, note: answer === 'dispute' ? note.trim() || undefined : undefined }),
      });
      if (res.status === 409) { setStatus({ kind: 'answered', answer }); return; }
      if (!res.ok) { setStatus({ kind: 'offline' }); return; }
      setStatus({ kind: 'done', answer });
    } catch {
      setStatus({ kind: 'offline' });
    } finally {
      setSubmitting(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-dvh bg-bg">
      <header className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3">
        <span className="text-lg font-bold text-indigo">{t('slip.poweredBy')}</span>
        <div className="inline-flex rounded-2xl border border-line bg-bg p-1">
          <button
            type="button"
            onClick={() => setLang('hi')}
            aria-pressed={lang === 'hi'}
            className={cn('min-h-12 min-w-12 rounded-xl px-4 text-base font-medium', lang === 'hi' ? 'bg-surface text-indigo shadow-card' : 'text-muted')}
          >
            {t('slip.toggleHi')}
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
            className={cn('min-h-12 min-w-12 rounded-xl px-4 text-base font-medium', lang === 'en' ? 'bg-surface text-indigo shadow-card' : 'text-muted')}
          >
            {t('slip.toggleEn')}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-6">{children}</main>
    </div>
  );

  if (status.kind === 'loading') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-20 text-center text-muted">
          <Loader2 aria-hidden="true" className="animate-spin" size={40} />
          <p className="text-xl">{t('slip.loading')}</p>
        </div>
      </Shell>
    );
  }

  if (status.kind === 'offline') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <WifiOff aria-hidden="true" size={48} className="text-saffron-ink" />
          <p className="text-2xl text-ink">{t('slip.offline')}</p>
          <p className="max-w-xs text-base text-muted">{t('slip.offlineHint')}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="min-h-14 rounded-2xl bg-indigo px-6 text-xl font-medium text-white"
          >
            {t('slip.retry')}
          </button>
        </div>
      </Shell>
    );
  }

  if (status.kind === 'notfound') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <X aria-hidden="true" size={48} className="text-madder" />
          <p className="text-2xl text-ink">{t('slip.notFound')}</p>
          <p className="max-w-xs text-base text-muted">{t('slip.notFoundHint')}</p>
        </div>
      </Shell>
    );
  }

  if (status.kind === 'gone') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <Clock aria-hidden="true" size={48} className="text-saffron-ink" />
          <p className="text-2xl text-ink">{t('slip.gone')}</p>
          <p className="max-w-xs text-base text-muted">{t('slip.goneHint')}</p>
        </div>
      </Shell>
    );
  }

  if (status.kind === 'answered' || status.kind === 'done') {
    const agreed = status.answer === 'agree';
    const msg = status.kind === 'done'
      ? agreed ? t('slip.thanksAgree') : t('slip.thanksDispute')
      : agreed ? t('slip.alreadyAgree') : t('slip.alreadyDispute');
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className={cn('flex h-20 w-20 items-center justify-center rounded-full', agreed ? 'bg-ok/15 text-ok' : 'bg-madder/12 text-madder')}>
            {agreed ? <Check aria-hidden="true" size={44} /> : <X aria-hidden="true" size={44} />}
          </span>
          {status.kind === 'answered' && <p className="text-lg text-muted">{t('slip.already')}</p>}
          <p className="text-2xl font-medium text-ink">{msg}</p>
        </div>
      </Shell>
    );
  }

  // ready
  const s = status.slip;
  const title = s.kind === 'peshgi' ? t('slip.titlePeshgi') : t('slip.title');

  return (
    <Shell>
      <h1 className="mb-1 text-2xl font-bold text-ink">{title}</h1>
      <p className="mb-5 text-lg text-muted">
        {t('slip.weaver')}: <span className="font-medium text-ink">{s.weaverName}</span>
      </p>

      {/* Listen button — big and prominent (plays the server clip, falls back to TTS) */}
      <button
        type="button"
        data-testid="slip-speak"
        onClick={playClip}
        aria-busy={audioState === 'loading'}
        className={cn(
          'mb-5 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl text-xl font-bold text-white shadow-card',
          'focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink',
          audioState === 'playing' || speaking ? 'bg-saffron-ink' : 'bg-indigo',
        )}
      >
        {audioState === 'loading' ? (
          <Loader2 aria-hidden="true" className="animate-spin" size={28} />
        ) : audioState === 'playing' || speaking ? (
          <Square aria-hidden="true" size={26} />
        ) : (
          <Volume2 aria-hidden="true" size={28} />
        )}
        {audioState === 'loading'
          ? t('audio.loading')
          : audioState === 'playing' || speaking
            ? t('audio.playing')
            : t('audio.listen')}
      </button>
      {audioState === 'fallback' && !noVoice && (
        <p className="mb-5 text-center text-sm text-muted">{t('audio.fallbackTts')}</p>
      )}
      {noVoice && (
        <p className="mb-5 rounded-2xl border border-saffron/40 bg-saffron/15 p-3 text-center text-base text-saffron-ink">
          {t('slip.noVoice')}
        </p>
      )}

      {/* Slip lines — large text */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
        {s.lines.map((line, i) => {
          const given = line.sign === '-';
          const recv = line.sign === '+';
          const amt =
            line.amountPaise !== undefined
              ? `${line.sign === '-' ? '−' : line.sign === '+' ? '+' : ''}${formatINR(Math.abs(line.amountPaise), { paise: true })}`
              : (line.value ?? '');
          return (
            <div key={i} className="flex items-center justify-between gap-3 border-b border-line px-4 py-4 last:border-0">
              <span className="text-lg text-ink">{line.label}</span>
              <span className={cn('num text-xl font-bold', given ? 'text-madder' : recv ? 'text-ok' : 'text-ink')}>
                {amt}
              </span>
            </div>
          );
        })}
      </div>

      {/* Dispute note */}
      {showDisputeNote && (
        <div className="mb-4">
          <label htmlFor="dispute-note" className="mb-1.5 block text-lg font-medium text-ink">
            {t('slip.disputeNote')}
          </label>
          <textarea
            id="dispute-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-lg text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
          />
          <button
            type="button"
            data-testid="slip-dispute"
            disabled={submitting}
            onClick={() => void respond('dispute')}
            className="mt-3 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-madder text-xl font-bold text-white disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" size={26} />}
            {t('slip.disputeSend')}
          </button>
        </div>
      )}

      {/* Agree / Dispute */}
      {!showDisputeNote && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="slip-agree"
            disabled={submitting}
            onClick={() => void respond('agree')}
            className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-ok text-xl font-bold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
          >
            <Check aria-hidden="true" size={30} />
            {t('slip.agree')}
          </button>
          <button
            type="button"
            onClick={() => setShowDisputeNote(true)}
            className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-madder text-xl font-bold text-white focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
          >
            <X aria-hidden="true" size={30} />
            {t('slip.dispute')}
          </button>
        </div>
      )}
    </Shell>
  );
}
