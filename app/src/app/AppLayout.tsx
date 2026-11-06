import { Suspense, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { SyncBadge } from '../components/ui/SyncBadge';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';
import { BottomNav } from '../components/ui/BottomNav';
import { SideNav, useNavCollapsed } from '../components/ui/SideNav';
import { useIsDesktop } from '../components/ui/useIsDesktop';
import { Skeleton } from '../components/ui/Feedback';
import { useRecords } from '../db/hooks';
import { addRecord } from '../db/repo';
import { getSettings } from '../domain/masters';
import { formatDay } from '../domain/dates';
import { todayIST } from '../domain/ids';
import { cn } from '../lib/utils';
import { BrandMark } from '../components/carpet/Carpet';
import { PauseCircle } from 'lucide-react';
import { useOrg } from './useCan';
import { useT } from '../i18n';
import { useSession } from './session';
import { getUnitName, setUnitName } from './unit-name';
import type { UsageP } from '../db/types';

/** App chrome. ≥ lg (SPEC-M12): collapsible side menu, top bar with today's date, content up to 88rem. Below lg: header + bottom bar as before. */
export function AppLayout() {
  const { role, user, logout } = useSession();
  const { t, lang } = useT();
  const isDesktop = useIsDesktop();
  const [collapsed, setCollapsed] = useNavCollapsed();
  const navigate = useNavigate();
  const recs = useRecords();
  const org = useOrg();
  const location = useLocation();
  // SPEC-M17: each page rises in once (CSS). Keyed by route, so a param change keeps the page mounted. React <ViewTransition>
  // was tried and dropped: it delays commits, and e2e 12 then failed 3 of 4 runs after a settings change.
  const matches = useMatches();
  const routeKey = matches[matches.length - 1]?.id ?? location.pathname;
  const liveName = useMemo(() => getSettings(recs)?.unitName ?? '', [recs]);
  useEffect(() => { if (liveName) setUnitName(liveName); }, [liveName]);
  const unitName = liveName || getUnitName();

  // D13: owner opens of the home and log screens are evidence for the pilot.
  useEffect(() => {
    if (role !== 'owner') return;
    if (location.pathname === '/' || location.pathname === '/log') {
      void addRecord<UsageP>('usage', { screen: location.pathname }).catch(() => undefined);
    }
  }, [location.pathname, role]);

  const desktopNav = Boolean(role && isDesktop);
  const offset = desktopNav ? (collapsed ? 'pl-[76px]' : 'pl-64') : '';
  return (
    <div className="min-h-dvh bg-bg pb-20 lg:pb-0">
      <a href="#main" className="visually-hidden focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-on-fill">{t('nav.home')}</a>
      {desktopNav && role && (
        <div className={cn('no-print fixed inset-y-0 left-0 z-40 border-r border-line bg-surface', collapsed ? 'w-[76px]' : 'w-64')}>
          <SideNav role={role} unitName={unitName || t('app.name')} userName={user?.name ?? ''} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
            onLogout={() => { void logout().then(() => navigate('/login', { replace: true })); }} />
        </div>
      )}
      <div className={offset}>
        <header className="no-print sticky top-0 z-30 border-b border-line bg-bg">
          <div className="mx-auto flex min-h-16 max-w-md items-center gap-2 px-4 py-2 md:max-w-3xl lg:max-w-[88rem] lg:px-8">
            {isDesktop ? (
              <span className="flex flex-1 items-center gap-2 truncate text-base text-ink-2" data-testid="topbar-date"><CalendarDays aria-hidden="true" size={18} strokeWidth={1.75} className="text-muted" />{formatDay(todayIST(), lang, 'long')}</span>
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-2.5"><BrandMark size={30} /><span className="truncate font-display text-lg font-medium text-ink">{unitName || t('app.name')}</span></span>
            )}
            <SyncBadge />
            <LanguageSwitch />
          </div>
        </header>
        {org.status === 'paused' && (
          <div role="status" className="no-print border-b border-warn/30 bg-warn-soft" data-testid="paused-banner">
            <p className="mx-auto flex max-w-md items-center gap-2 px-4 py-2.5 text-sm font-medium text-warn md:max-w-3xl lg:max-w-[88rem] lg:px-8"><PauseCircle aria-hidden="true" size={18} className="shrink-0" />{t('m18.pausedBanner')}</p>
          </div>
        )}
        <main id="main" className="mx-auto max-w-md px-4 py-5 md:max-w-3xl lg:max-w-[88rem] lg:px-8 lg:py-8">
          <Suspense fallback={<Skeleton className="h-40 w-full" />}><div key={routeKey} className="page-in rise-in"><Outlet /></div></Suspense>
        </main>
      </div>
      {role && !isDesktop && <BottomNav role={role} />}
    </div>
  );
}
