import type { Lang } from '../../db/types';
import { useT, LANGS, LANG_LABEL } from '../../i18n';
import { cn } from '../../lib/utils';

const SHORT: Record<Lang, string> = { hi: 'हिं', hin: 'Hin', en: 'EN' };

/** हिंदी / Hinglish / EN — applies instantly and is remembered on this device. Short labels below md. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang, t } = useT();
  return (
    <div role="radiogroup" aria-label={t('lang.toggle')} className={cn('inline-flex rounded-2xl border border-line bg-bg p-1', className)}>
      {LANGS.map((l) => (
        <button key={l} type="button" role="radio" aria-checked={lang === l} aria-label={LANG_LABEL[l]} onClick={() => setLang(l)}
          className={cn('min-h-10 rounded-xl px-2.5 text-sm font-medium transition-colors md:min-h-11 md:px-4 md:text-base',
            'focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink',
            lang === l ? 'bg-surface text-primary shadow-card' : 'text-muted hover:text-ink')}>
          <span className="md:hidden">{SHORT[l]}</span><span className="hidden md:inline">{LANG_LABEL[l]}</span>
        </button>
      ))}
    </div>
  );
}
