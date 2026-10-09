import { NavLink } from 'react-router-dom';
import {
  Home,
  ClipboardList,
  Grid3x3,
  Users,
  HardHat,
  Package,
  Wallet,
  ShoppingBag,
  BadgeIndianRupee,
  FileText,
  History,
  Settings as SettingsIcon,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../../db/types';
import { can, type Action } from '../../domain/permissions';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  /** When set, only shown if `can(role, action)` is true. */
  action?: Action;
}

// Primary destinations per role — mirror BottomNav icon choices so the two
// navs feel like the same product. The side nav then adds the "More" group.
const PRIMARY_BY_ROLE: Record<Role, NavItem[]> = {
  owner: [
    { to: '/', icon: Home, labelKey: 'nav.home' },
    { to: '/orders', icon: ClipboardList, labelKey: 'nav.orders' },
    { to: '/looms', icon: Grid3x3, labelKey: 'nav.looms' },
    { to: '/weavers', icon: Users, labelKey: 'nav.weavers' },
    { to: '/roker', icon: Wallet, labelKey: 'nav.roker' },
  ],
  munshi: [
    { to: '/', icon: Home, labelKey: 'nav.home' },
    { to: '/bazaar/new', icon: ShoppingBag, labelKey: 'nav.bazaar' },
    { to: '/yarn', icon: Package, labelKey: 'nav.yarn' },
    { to: '/roker', icon: Wallet, labelKey: 'nav.roker' },
  ],
  thekedar: [
    { to: '/', icon: Home, labelKey: 'nav.home' },
    { to: '/checkin/new', icon: MapPin, labelKey: 'nav.checkin' },
  ],
};

// "More" destinations — the ones reachable from the mobile "More"/Settings
// screen. Each is gated by a `can()` action so a munshi never sees owner-only
// destinations (rates), and a thekedar sees none of these.
const MORE_ITEMS: NavItem[] = [
  { to: '/orders', icon: ClipboardList, labelKey: 'nav.orders', action: 'order.create' },
  { to: '/looms', icon: Grid3x3, labelKey: 'nav.looms', action: 'loom.manage' },
  { to: '/weavers', icon: Users, labelKey: 'nav.weavers', action: 'weaver.manage' },
  { to: '/thekedars', icon: HardHat, labelKey: 'nav.thekedars', action: 'loom.manage' },
  { to: '/yarn', icon: Package, labelKey: 'nav.yarn', action: 'yarn.issue' },
  { to: '/rates', icon: BadgeIndianRupee, labelKey: 'nav.rates', action: 'rate.edit' },
  { to: '/digest', icon: FileText, labelKey: 'nav.digest', action: 'digest.view' },
  { to: '/audit', icon: History, labelKey: 'nav.audit', action: 'audit.view' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-base font-medium',
    'focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink focus-visible:outline-offset-2',
    isActive ? 'bg-indigo/10 text-indigo' : 'text-muted hover:bg-bg hover:text-ink',
  );

function NavRow({ item }: { item: NavItem }) {
  const { t } = useT();
  const Icon = item.icon;
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.to === '/'}
        className={linkClass}
        aria-current={undefined}
      >
        {({ isActive }) => (
          <>
            <Icon aria-hidden="true" size={22} strokeWidth={isActive ? 2.4 : 1.8} />
            <span className="truncate">{t(item.labelKey)}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}

export interface SideNavProps {
  role: Role;
  /** Unit / brand name shown at the top. */
  unitName: string;
}

/**
 * Desktop/tablet (lg+) left navigation. Rendered inside the fixed rail by
 * AppLayout; brand/unit name at top, primary role destinations, then a "More"
 * group filtered by `can()`. Active route is highlighted (NavLink sets
 * `aria-current="page"` automatically). No logout — Settings owns that.
 */
export function SideNav({ role, unitName }: SideNavProps) {
  const { t } = useT();
  const primary = PRIMARY_BY_ROLE[role];
  // Never list a destination twice (the primary group already has some of them).
  const primaryTo = new Set(primary.map((p) => p.to));
  const more = MORE_ITEMS.filter((it) => !primaryTo.has(it.to) && (!it.action || can(role, it.action)));

  return (
    <nav
      aria-label={t('desktop.nav.label')}
      data-testid="side-nav"
      className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4"
    >
      <div className="mb-3 px-3">
        <span className="block truncate text-lg font-medium text-ink">
          {unitName || t('app.name')}
        </span>
        <span className="block text-sm text-muted">{t(`role.${role}`)}</span>
      </div>

      <ul className="flex flex-col gap-0.5">
        {primary.map((item) => (
          <NavRow key={`p-${item.to}`} item={item} />
        ))}
      </ul>

      {more.length > 0 && (
        <>
          <div className="mt-4 mb-1 px-3 text-xs font-medium uppercase tracking-wide text-muted">
            {t('nav.more')}
          </div>
          <ul className="flex flex-col gap-0.5">
            {more.map((item) => (
              <NavRow key={`m-${item.to}`} item={item} />
            ))}
          </ul>
        </>
      )}

      <div className="mt-auto pt-4">
        <ul>
          <NavRow item={{ to: '/settings', icon: SettingsIcon, labelKey: 'nav.settings' }} />
        </ul>
      </div>
    </nav>
  );
}
