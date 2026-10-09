import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireSession, RequireCan } from './guards';
import SetupPage from './SetupPage';
import LoginPage from './LoginPage';

// Feature screens are code-split; placeholder files exist until feature agents
// overwrite them.
const HomePage = lazy(() => import('../features/home/HomePage'));
const OrdersPage = lazy(() => import('../features/orders/OrdersPage'));
const OrderNewPage = lazy(() => import('../features/orders/OrderNewPage'));
const OrderDetailPage = lazy(() => import('../features/orders/OrderDetailPage'));
const LoomsPage = lazy(() => import('../features/looms/LoomsPage'));
const LoomNewPage = lazy(() => import('../features/looms/LoomNewPage'));
const LoomDetailPage = lazy(() => import('../features/looms/LoomDetailPage'));
const WeaversPage = lazy(() => import('../features/weavers/WeaversPage'));
const WeaverNewPage = lazy(() => import('../features/weavers/WeaverNewPage'));
const WeaverDetailPage = lazy(() => import('../features/weavers/WeaverDetailPage'));
const ThekedarsPage = lazy(() => import('../features/thekedars/ThekedarsPage'));
const ThekedarNewPage = lazy(() => import('../features/thekedars/ThekedarNewPage'));
const YarnPage = lazy(() => import('../features/yarn/YarnPage'));
const YarnIssuePage = lazy(() => import('../features/yarn/YarnIssuePage'));
const YarnReturnPage = lazy(() => import('../features/yarn/YarnReturnPage'));
const RatesPage = lazy(() => import('../features/rates/RatesPage'));
const BazaarNewPage = lazy(() => import('../features/bazaar/BazaarNewPage'));
const BazaarDetailPage = lazy(() => import('../features/bazaar/BazaarDetailPage'));
const PeshgiNewPage = lazy(() => import('../features/peshgi/PeshgiNewPage'));
const JobNewPage = lazy(() => import('../features/jobs/JobNewPage'));
const CheckinNewPage = lazy(() => import('../features/checkin/CheckinNewPage'));
const RokerPage = lazy(() => import('../features/roker/RokerPage'));
const DigestPage = lazy(() => import('../features/digest/DigestPage'));
const AuditPage = lazy(() => import('../features/audit/AuditPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const PublicSlipPage = lazy(() => import('../features/slip/PublicSlipPage'));
const ExporterMockPage = lazy(() => import('../features/exporter/ExporterMockPage'));

const guard = (action: Parameters<typeof RequireCan>[0]['action'], el: React.ReactNode) => (
  <RequireCan action={action}>{el}</RequireCan>
);

export const router = createBrowserRouter([
  { path: '/setup', element: <SetupPage /> },
  { path: '/login', element: <LoginPage /> },

  // Public (no login).
  { path: '/s/:token', element: <PublicSlipPage /> },
  { path: '/o/:orderId', element: <ExporterMockPage /> },

  {
    path: '/',
    element: (
      <RequireSession>
        <AppLayout />
      </RequireSession>
    ),
    children: [
      { index: true, element: <HomePage /> },

      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/new', element: guard('order.create', <OrderNewPage />) },
      { path: 'orders/:id', element: <OrderDetailPage /> },

      { path: 'looms', element: <LoomsPage /> },
      { path: 'looms/new', element: guard('loom.manage', <LoomNewPage />) },
      { path: 'looms/:id', element: <LoomDetailPage /> },

      { path: 'weavers', element: <WeaversPage /> },
      { path: 'weavers/new', element: guard('weaver.manage', <WeaverNewPage />) },
      { path: 'weavers/:id', element: <WeaverDetailPage /> },

      { path: 'thekedars', element: <ThekedarsPage /> },
      { path: 'thekedars/new', element: guard('loom.manage', <ThekedarNewPage />) },

      { path: 'yarn', element: <YarnPage /> },
      { path: 'yarn/issue', element: guard('yarn.issue', <YarnIssuePage />) },
      { path: 'yarn/return', element: guard('yarn.issue', <YarnReturnPage />) },

      { path: 'rates', element: <RatesPage /> },

      { path: 'bazaar/new', element: guard('bazaar.create', <BazaarNewPage />) },
      { path: 'bazaar/:id', element: <BazaarDetailPage /> },

      { path: 'peshgi/new', element: guard('peshgi.give', <PeshgiNewPage />) },

      { path: 'jobs/new', element: guard('job.create', <JobNewPage />) },

      { path: 'checkin/new', element: guard('checkin.create', <CheckinNewPage />) },

      { path: 'roker', element: guard('roker.entry', <RokerPage />) },
      { path: 'digest', element: guard('digest.view', <DigestPage />) },
      { path: 'audit', element: guard('audit.view', <AuditPage />) },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },

  { path: '*', element: <SetupPage /> },
]);
