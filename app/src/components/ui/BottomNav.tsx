import { NavLink } from 'react-router-dom';
import type { Role } from '../../db/types';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';
import { PRIMARY } from './nav-items';
import { useModule } from '../../app/useCan';

/** Phone bottom bar. SPEC-M17: the active destination gets a short indigo bar above it and ink text; the rest is muted. */
export function BottomNav({ role }: { role: Role }) {
  const { t } = useT();
  const on = useModule();
  return (
    <nav
      aria-label={t('nav.label')}
      data-testid="bottom-nav"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around md:max-w-3xl">
        {PRIMARY[role].filter((item) => !item.module || on(item.module)).map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => cn(
                  'relative flex min-h-14 flex-col items-center justify-center gap-1 py-1.5 text-xs font-medium transition-colors',
                  'focus-visible:outline focus-visible:outline-3 focus-visible:-outline-offset-2 focus-visible:outline-accent-ink',
                  isActive ? 'text-ink' : 'text-muted',
                )}
              >
                {({ isActive }) => (
                  <>
                    <span aria-hidden="true" className={cn('absolute top-0 h-0.5 w-8 rounded-b bg-primary transition-transform duration-200 ease-[var(--ease-out)]', isActive ? 'scale-x-100' : 'scale-x-0')} />
                    <Icon aria-hidden="true" size={22} strokeWidth={isActive ? 2 : 1.6} className={isActive ? 'text-primary' : undefined} />
                    <span>{t(item.labelKey)}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
