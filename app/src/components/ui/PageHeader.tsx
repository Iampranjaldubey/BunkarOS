import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n';

export interface PageHeaderProps {
  title: string;
  /** Quiet line above the title (the period, the unit). */
  kicker?: ReactNode;
  /** Show a back button (defaults to history back). */
  back?: boolean | (() => void);
  right?: ReactNode;
}

/** Screen header: page title in Eczar, an optional back control and a right-hand slot. */
export function PageHeader({ title, kicker, back, right }: PageHeaderProps) {
  const navigate = useNavigate();
  const { t } = useT();

  const onBack = () => {
    if (typeof back === 'function') back();
    else navigate(-1);
  };

  return (
    <header className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 lg:mb-6">
      {back && (
        <button type="button" onClick={onBack}
          className="tap-48 -ml-3 inline-flex items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink">
          <ArrowLeft aria-hidden="true" size={22} strokeWidth={1.75} />
          <span className="visually-hidden">{t('action.back')}</span>
        </button>
      )}
      <div className="min-w-0 flex-1">
        {kicker && <p className="mb-0.5 text-sm text-muted">{kicker}</p>}
        <h1 className="text-2xl [overflow-wrap:anywhere] md:text-3xl">{title}</h1>
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </header>
  );
}
