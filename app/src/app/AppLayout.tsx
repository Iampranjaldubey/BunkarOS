import { Suspense, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  const location = useLocation();
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
        <div className={cn('no-print fixed inset-y-0 left-0 z-40 border-r border-line bg-surface transition-[width] duration-150', collapsed ? 'w-[76px]' : 'w-64')}>
          <SideNav role={role} unitName={unitName || t('app.name')} userName={user?.name ?? ''} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)}
            onLogout={() => { void logout().then(() => navigate('/login', { replace: true })); }} />
        </div>
      )}
      <div className={offset}>
        <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-2.5 md:max-w-3xl lg:max-w-[88rem] lg:px-8">
            {isDesktop ? (
              <span className="flex flex-1 items-center gap-2 truncate text-base text-muted" data-testid="topbar-date"><CalendarDays aria-hidden="true" size={18} />{formatDay(todayIST(), lang, 'long')}</span>
            ) : (
              <span className="flex-1 truncate text-lg font-medium text-ink">{unitName || t('app.name')}</span>
            )}
            <SyncBadge />
            <LanguageSwitch />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-md px-4 py-5 md:max-w-3xl lg:max-w-[88rem] lg:px-8 lg:py-6">
          <Suspense fallback={<Skeleton className="h-40 w-full" />}><Outlet /></Suspense>
        </main>
      </div>
      {role && !isDesktop && <BottomNav role={role} />}
    </div>
  );
}
