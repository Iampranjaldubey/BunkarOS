import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n';

export interface PageHeaderProps {
  title: string;
  /** Show a back button (defaults to history back). */
  back?: boolean | (() => void);
  right?: ReactNode;
}

/**
 * Screen header with an optional back control and a right-hand slot.
 * Back arrow points right (ArrowRight) because the app is Hindi-first; "वापस"
 * reads naturally with the standard chevron and the aria-label is explicit.
 */
export function PageHeader({ title, back, right }: PageHeaderProps) {
  const navigate = useNavigate();
  const { t } = useT();

  const onBack = () => {
    if (typeof back === 'function') back();
    else navigate(-1);
  };

  return (
    <header className="mb-4 flex items-center gap-2">
      {back && (
        <button
          type="button"
          onClick={onBack}
          className="tap-48 -ml-2 inline-flex items-center justify-center rounded-full text-indigo hover:bg-indigo/10 focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
        >
          <ArrowRight aria-hidden="true" className="rotate-180" />
          <span className="visually-hidden">{t('action.back')}</span>
        </button>
      )}
      <h1 className="flex-1 text-2xl">{title}</h1>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  );
}
