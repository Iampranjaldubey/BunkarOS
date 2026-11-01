import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LogOut, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import type { Role } from '../../db/types';
import { useCan } from '../../app/useCan';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';
import { PRIMARY, MORE, QUICK, type NavItem } from './nav-items';

const NAV_KEY = 'bunkar.nav.collapsed';
/** Collapsed/expanded side menu, remembered on this device (SPEC-M12). */
export function useNavCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, set] = useState<boolean>(() => { try { return localStorage.getItem(NAV_KEY) === '1'; } catch { return false; } });
  const update = (v: boolean) => { set(v); try { localStorage.setItem(NAV_KEY, v ? '1' : '0'); } catch { /* private mode */ } };
  return [collapsed, update];
}

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { t } = useT();
  const Icon = item.icon;
  const label = t(item.labelKey);
  return (
    <li>
      <NavLink to={item.to} end={item.to === '/'} title={collapsed ? label : undefined}
        className={({ isActive }) => cn(
          'flex min-h-11 items-center gap-3 rounded-xl py-2 text-base font-medium transition-colors',
          collapsed ? 'justify-center px-0' : 'px-3',
          isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-ink',
        )}>
        {({ isActive }) => (<><Icon aria-hidden="true" size={22} strokeWidth={isActive ? 2.4 : 1.8} className="shrink-0" /><span className={collapsed ? 'visually-hidden' : 'truncate'}>{label}</span></>)}
      </NavLink>
    </li>
  );
}

/** "New entry" disclosure: a short list of the entry screens this role may use. Esc / outside click closes. */
function QuickEntry({ collapsed }: { role: Role; collapsed: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const allowed = useCan();
  const items = QUICK.filter((i) => !i.action || allowed(i.action));
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    wrap.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  if (items.length === 0) return null;
  const label = t('nav.newEntry');
  return (
    <div ref={wrap} className="relative" onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); btn.current?.focus(); } }}>
      <button ref={btn} type="button" aria-expanded={open} aria-controls={panelId} title={collapsed ? label : undefined} onClick={() => setOpen((v) => !v)} data-testid="quick-entry"
        className={cn('flex min-h-11 w-full items-center gap-2 rounded-xl bg-primary font-medium text-on-fill shadow-card transition-colors hover:bg-primary-dark', collapsed ? 'justify-center px-0' : 'px-3')}>
        <Plus aria-hidden="true" size={20} className="shrink-0" /><span className={collapsed ? 'visually-hidden' : 'truncate'}>{label}</span>
      </button>
      {open && (
        <div id={panelId} className={cn('absolute z-50 w-60 rounded-2xl border border-line bg-surface p-2 shadow-sheet', collapsed ? 'left-full top-0 ml-2' : 'left-0 top-full mt-2')} data-testid="quick-entry-menu">
          <p className="px-2 pb-1 pt-1 text-xs font-medium text-muted">{t('nav.quickTitle')}</p>
          <ul className="flex flex-col gap-0.5">
            {items.map((it) => { const Icon = it.icon; return (
              <li key={it.to}><Link to={it.to} className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-base text-ink hover:bg-surface-2">
                <span className="rounded-lg bg-primary-soft p-1.5 text-primary"><Icon aria-hidden="true" size={18} /></span>{t(it.labelKey)}</Link></li>
            ); })}
          </ul>
        </div>
      )}
    </div>
  );
}

export interface SideNavProps {
  role: Role; unitName: string; userName: string;
  collapsed: boolean; onToggle: () => void; onLogout: () => void;
}

/** Desktop side menu (≥ lg): brand, new entry, destinations, then the user with logout and the collapse toggle. */
export function SideNav({ role, unitName, userName, collapsed, onToggle, onLogout }: SideNavProps) {
  const { t } = useT();
  const primary = PRIMARY[role].filter((i) => i.to !== '/more');
  const allowed = useCan();
  const more = MORE.filter((it) => !it.action || allowed(it.action));
  const toggleLabel = collapsed ? t('nav.expand') : t('nav.collapse');
  return (
    <nav aria-label={t('nav.label')} data-testid="side-nav" data-collapsed={collapsed ? 'true' : 'false'} className="flex h-full flex-col">
      <div className={cn('flex items-center gap-3 py-4', collapsed ? 'justify-center px-2' : 'px-4')}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-on-fill" aria-hidden="true">बु</span>
        <span className={collapsed ? 'visually-hidden' : 'min-w-0'}>
          <span className="block truncate font-display text-lg leading-tight text-ink">{unitName || t('app.name')}</span>
          <span className="block text-sm text-muted">{t(`role.${role}`)}</span>
        </span>
      </div>
      <div className={cn('pb-3', collapsed ? 'px-2' : 'px-3')}><QuickEntry role={role} collapsed={collapsed} /></div>
      <div className={cn('flex-1 overflow-y-auto pb-3', collapsed ? 'px-2' : 'px-3')}>
        <ul className="flex flex-col gap-0.5">{primary.map((item) => <NavRow key={item.to} item={item} collapsed={collapsed} />)}</ul>
        {collapsed ? <hr className="mx-2 my-3 border-line" /> : <div className="mb-1 mt-4 px-3 text-xs font-medium uppercase tracking-wide text-muted">{t('nav.more')}</div>}
        <ul className="flex flex-col gap-0.5">{more.map((item) => <NavRow key={item.to} item={item} collapsed={collapsed} />)}</ul>
      </div>
      <div className={cn('flex flex-col gap-1 border-t border-line py-3', collapsed ? 'items-center px-2' : 'px-3')}>
        <div className={cn('flex items-center gap-3', collapsed ? 'flex-col' : 'px-1')} data-testid="side-user">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-ink" aria-hidden="true">{(userName || '?').slice(0, 1).toUpperCase()}</span>
          <span className={collapsed ? 'visually-hidden' : 'min-w-0 flex-1'}>
            <span className="block truncate font-medium text-ink">{userName}</span>
            <span className="block text-xs text-muted">{t(`role.${role}`)}</span>
          </span>
          <button type="button" onClick={onLogout} aria-label={t('action.logout')} title={t('action.logout')} data-testid="side-logout"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-given-soft hover:text-given"><LogOut aria-hidden="true" size={20} /></button>
        </div>
        <button type="button" onClick={onToggle} aria-label={toggleLabel} title={toggleLabel} aria-expanded={!collapsed} data-testid="nav-toggle"
          className={cn('flex min-h-11 items-center gap-3 rounded-xl text-sm text-muted hover:bg-surface-2 hover:text-ink', collapsed ? 'w-11 justify-center' : 'px-3')}>
          {collapsed ? <PanelLeftOpen aria-hidden="true" size={20} /> : <PanelLeftClose aria-hidden="true" size={20} />}
          {!collapsed && <span>{toggleLabel}</span>}
        </button>
      </div>
    </nav>
  );
}
