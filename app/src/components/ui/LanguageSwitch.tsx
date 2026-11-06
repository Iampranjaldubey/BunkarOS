import type { Lang } from '../../db/types';
import { useT, LANGS, LANG_LABEL } from '../../i18n';
import { cn } from '../../lib/utils';

const SHORT: Record<Lang, string> = { hi: 'हिं', hin: 'Hin', en: 'EN' };

/** हिंदी / Hinglish / EN — applies instantly and is remembered on this device. Short labels below md. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang, t } = useT();
  const idx = Math.max(0, LANGS.indexOf(lang));
  return (
    <div role="radiogroup" aria-label={t('lang.toggle')} className={cn('relative inline-grid grid-cols-3 rounded-xl border border-line bg-surface-2 p-1', className)}>
      <span aria-hidden="true" className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg border border-line bg-surface transition-transform duration-200 ease-[var(--ease-out)]"
        style={{ transform: `translateX(${idx * 100}%)` }} />
      {LANGS.map((l) => (
        <button key={l} type="button" role="radio" aria-checked={lang === l} aria-label={LANG_LABEL[l]} onClick={() => setLang(l)}
          className={cn('relative min-h-12 min-w-12 rounded-lg px-2 text-sm font-medium transition-colors md:min-w-0 md:px-3 lg:min-h-11',
            'focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink',
            lang === l ? 'text-ink' : 'text-muted hover:text-ink')}>
          <span className="md:hidden">{SHORT[l]}</span><span className="hidden md:inline">{LANG_LABEL[l]}</span>
        </button>
      ))}
    </div>
  );
}
