import { Suspense, useEffect, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { SyncBadge } from '../components/ui/SyncBadge';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { BottomNav } from '../components/ui/BottomNav';
import { SideNav } from '../components/ui/SideNav';
import { Skeleton } from '../components/ui/Feedback';
import type { Lang } from '../db/types';
import { useRecords } from '../db/hooks';
import { getSettings } from '../domain/pieces';
import { useT } from '../i18n';
import { useSession } from './session';
import { getUnitName, setUnitName } from './unit-name';

/** App chrome for authenticated role screens. */
export function AppLayout() {
  const { role } = useSession();
  const { lang, setLang, t } = useT();
  // Live from the latest synced settings record, so a phone that just JOINED a unit
  // shows the unit's name as soon as the first sync lands (no reload needed).
  const recs = useRecords();
  const liveName = useMemo(() => getSettings(recs)?.unitName ?? '', [recs]);
  useEffect(() => { if (liveName) setUnitName(liveName); }, [liveName]);
  const unitName = liveName || getUnitName();

  return (
    <div className="min-h-dvh bg-bg pb-20 lg:pb-0">
      <a
        href="#main"
        className="visually-hidden focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-indigo focus:px-4 focus:py-2 focus:text-white"
      >
        {t('nav.home')}
      </a>

      {/* Fixed left rail at lg+ only. Below lg it is not rendered at all, so the
          phone DOM is unchanged. */}
      {role && (
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block lg:w-64 lg:border-r lg:border-line lg:bg-surface">
          <SideNav role={role} unitName={unitName || t('app.name')} />
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-2.5 md:max-w-3xl lg:max-w-6xl">
          <span className="flex-1 truncate text-lg font-medium text-ink">
            {unitName || t('app.name')}
          </span>
          <SyncBadge />
          <SegmentedControl<Lang>
            label={t('lang.toggle')}
            value={lang}
            onChange={setLang}
            options={[
              { value: 'hi', label: 'हिंदी' },
              { value: 'en', label: 'EN' },
            ]}
          />
        </div>
      </header>

      <main
        id="main"
        className="mx-auto max-w-md px-4 py-5 md:max-w-3xl lg:max-w-6xl lg:pl-64"
      >
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <Outlet />
        </Suspense>
      </main>

      {role && <BottomNav role={role} />}
    </div>
  );
}
