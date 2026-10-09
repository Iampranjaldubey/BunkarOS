import { NavLink } from 'react-router-dom';
import {
  Home,
  ClipboardList,
  Grid3x3,
  Wallet,
  MoreHorizontal,
  ShoppingBag,
  Package,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../../db/types';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: string;
}

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  owner: [
    { to: '/', icon: Home, labelKey: 'nav.home' },
    { to: '/orders', icon: ClipboardList, labelKey: 'nav.orders' },
    { to: '/looms', icon: Grid3x3, labelKey: 'nav.loomsWeavers' },
    { to: '/roker', icon: Wallet, labelKey: 'nav.roker' },
    { to: '/settings', icon: MoreHorizontal, labelKey: 'nav.more' },
  ],
  munshi: [
    { to: '/', icon: Home, labelKey: 'nav.home' },
    { to: '/bazaar/new', icon: ShoppingBag, labelKey: 'nav.bazaar' },
    { to: '/yarn', icon: Package, labelKey: 'nav.yarn' },
    { to: '/roker', icon: Wallet, labelKey: 'nav.roker' },
    { to: '/settings', icon: MoreHorizontal, labelKey: 'nav.more' },
  ],
  thekedar: [
    { to: '/', icon: Home, labelKey: 'nav.home' },
    { to: '/checkin/new', icon: MapPin, labelKey: 'nav.checkin' },
  ],
};

export function BottomNav({ role }: { role: Role }) {
  const { t } = useT();
  const items = NAV_BY_ROLE[role];

  return (
    <nav
      aria-label={t('nav.home')}
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-medium',
                    'focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink',
                    isActive ? 'text-indigo' : 'text-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon aria-hidden="true" size={24} strokeWidth={isActive ? 2.4 : 1.8} />
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
