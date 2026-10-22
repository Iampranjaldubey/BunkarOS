import { Suspense, useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SyncBadge } from '../components/ui/SyncBadge';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';
import { BottomNav } from '../components/ui/BottomNav';
import { SideNav } from '../components/ui/SideNav';
import { useIsDesktop } from '../components/ui/useIsDesktop';
import { Skeleton } from '../components/ui/Feedback';
import { useRecords } from '../db/hooks';
import { addRecord } from '../db/repo';
import { getSettings } from '../domain/masters';
import { useT } from '../i18n';
import { useSession } from './session';
import { getUnitName, setUnitName } from './unit-name';
import type { UsageP } from '../db/types';

/** App chrome: sticky header, side rail at lg+, bottom bar below lg. */
export function AppLayout() {
  const { role, user } = useSession();
  const { t } = useT();
  const isDesktop = useIsDesktop();
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

  return (
    <div className="min-h-dvh bg-bg pb-20 lg:pb-0">
      <a href="#main" className="visually-hidden focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-white">{t('nav.home')}</a>
      {role && isDesktop && (
        <div className="fixed inset-y-0 left-0 z-40 w-64 border-r border-line bg-surface"><SideNav role={role} unitName={unitName || t('app.name')} /></div>
      )}
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-2.5 md:max-w-3xl lg:max-w-6xl lg:px-8">
          <span className="flex-1 truncate text-lg font-medium text-ink">{isDesktop ? (user?.name ?? '') : (unitName || t('app.name'))}</span>
          <SyncBadge />
          <LanguageSwitch />
        </div>
      </header>
      <div className="lg:pl-64">
        <main id="main" className="mx-auto max-w-md px-4 py-5 md:max-w-3xl lg:max-w-6xl lg:px-8 lg:py-6">
          <Suspense fallback={<Skeleton className="h-40 w-full" />}><Outlet /></Suspense>
        </main>
      </div>
      {role && !isDesktop && <BottomNav role={role} />}
    </div>
  );
}
