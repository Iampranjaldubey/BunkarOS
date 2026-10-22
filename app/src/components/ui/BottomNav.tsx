import { NavLink } from 'react-router-dom';
import type { Role } from '../../db/types';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';
import { PRIMARY } from './nav-items';

export function BottomNav({ role }: { role: Role }) {
  const { t } = useT();
  return (
    <nav
      aria-label={t('nav.label')}
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around md:max-w-3xl">
        {PRIMARY[role].map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium',
                  'focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink',
                  isActive ? 'text-primary' : 'text-muted',
                )}
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('rounded-full px-3 py-0.5 transition-colors', isActive && 'bg-primary-soft')}>
                      <Icon aria-hidden="true" size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                    </span>
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
