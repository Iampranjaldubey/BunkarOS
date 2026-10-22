import { NavLink } from 'react-router-dom';
import type { Role } from '../../db/types';
import { can } from '../../domain/permissions';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';
import { PRIMARY, MORE, type NavItem } from './nav-items';

const linkClass = ({ isActive }: { isActive: boolean }) => cn(
  'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-base font-medium transition-colors',
  'focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink focus-visible:outline-offset-2',
  isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-ink',
);

function NavRow({ item }: { item: NavItem }) {
  const { t } = useT();
  const Icon = item.icon;
  return (
    <li>
      <NavLink to={item.to} end={item.to === '/'} className={linkClass}>
        {({ isActive }) => (<><Icon aria-hidden="true" size={22} strokeWidth={isActive ? 2.4 : 1.8} /><span className="truncate">{t(item.labelKey)}</span></>)}
      </NavLink>
    </li>
  );
}

export interface SideNavProps { role: Role; unitName: string; }

/** Left rail at lg+: brand, primary destinations, then the "More" group filtered by can(). */
export function SideNav({ role, unitName }: SideNavProps) {
  const { t } = useT();
  const primary = PRIMARY[role].filter((i) => i.to !== '/more');
  const more = MORE.filter((it) => !it.action || can(role, it.action));
  return (
    <nav aria-label={t('nav.label')} data-testid="side-nav" className="flex h-full flex-col gap-1 overflow-y-auto px-3 py-4">
      <div className="mb-3 px-3">
        <span className="block truncate font-display text-xl text-ink">{unitName || t('app.name')}</span>
        <span className="block text-sm text-muted">{t(`role.${role}`)}</span>
      </div>
      <ul className="flex flex-col gap-0.5">{primary.map((item) => <NavRow key={item.to} item={item} />)}</ul>
      <div className="mt-4 mb-1 px-3 text-xs font-medium uppercase tracking-wide text-muted">{t('nav.more')}</div>
      <ul className="flex flex-col gap-0.5">{more.map((item) => <NavRow key={item.to} item={item} />)}</ul>
    </nav>
  );
}
