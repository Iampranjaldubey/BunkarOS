import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import type { ModuleId } from '../sync/types';
import { AppLayout } from './AppLayout';
import { RequireSession, RequireCan, RequireModule } from './guards';
import SetupPage from './SetupPage';
import LoginPage from './LoginPage';

const HomePage = lazy(() => import('../features/home/HomePage'));
const MorePage = lazy(() => import('../features/home/MorePage'));
const LogPage = lazy(() => import('../features/log/LogPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));
const WorkersPage = lazy(() => import('../features/workers/WorkersPage'));
const WorkerFormPage = lazy(() => import('../features/workers/WorkerFormPage'));
const WorkerDetailPage = lazy(() => import('../features/workers/WorkerDetailPage'));
const AttendancePage = lazy(() => import('../features/attendance/AttendancePage'));
const AdvanceNewPage = lazy(() => import('../features/wages/AdvanceNewPage'));
const WagesPage = lazy(() => import('../features/wages/WagesPage'));
const WagePayPage = lazy(() => import('../features/wages/WagePayPage'));
const StockPage = lazy(() => import('../features/stock/StockPage'));
const ItemFormPage = lazy(() => import('../features/stock/ItemFormPage'));
const ItemDetailPage = lazy(() => import('../features/stock/ItemDetailPage'));
const StockMovePage = lazy(() => import('../features/stock/StockMovePage'));
const OrdersPage = lazy(() => import('../features/orders/OrdersPage'));
const OrderFormPage = lazy(() => import('../features/orders/OrderFormPage'));
const OrderDetailPage = lazy(() => import('../features/orders/OrderDetailPage'));
const BuyersPage = lazy(() => import('../features/orders/BuyersPage'));
const MonthPage = lazy(() => import('../features/month/MonthPage'));
const CataloguePage = lazy(() => import('../features/catalogue/CataloguePage'));
const CarpetFormPage = lazy(() => import('../features/catalogue/CarpetFormPage'));
const CarpetDetailPage = lazy(() => import('../features/catalogue/CarpetDetailPage'));
const WorkerLinkPage = lazy(() => import('../worker/WorkerLinkPage'));
const WorkerHomePage = lazy(() => import('../worker/WorkerHomePage'));
const WorkerJoinPage = lazy(() => import('../worker/WorkerJoinPage'));
const AdminUnitsPage = lazy(() => import('../admin/AdminUnitsPage'));
const AdminUnitPage = lazy(() => import('../admin/AdminUnitPage'));

const guard = (action: Parameters<typeof RequireCan>[0]['action'], el: React.ReactNode) => <RequireCan action={action}>{el}</RequireCan>;
/** SPEC-M18: screens of a module the platform can switch off. */
const mod = (m: ModuleId, el: React.ReactNode) => <RequireModule module={m}>{el}</RequireModule>;

export const router = createBrowserRouter([
  { path: '/setup', element: <SetupPage /> },
  { path: '/join/:token', element: <SetupPage /> }, // SPEC-M18 §4: the owner's invite link
  { path: '/login', element: <LoginPage /> },
  // Public worker pages (SPEC-M07): no session.
  { path: '/w', element: <WorkerHomePage /> },
  { path: '/w/join', element: <WorkerJoinPage /> },
  { path: '/w/:token', element: <WorkerLinkPage /> },
  // Platform admin (SPEC-M09): founders only, separate key.
  { path: '/admin', element: <AdminUnitsPage /> },
  { path: '/admin/units/:unitId', element: <AdminUnitPage /> },
  { path: '/admin/new', lazy: () => import('../admin/AdminNewOrgPage').then((m) => ({ Component: m.default })) },
  { path: '/admin/industries', lazy: () => import('../admin/AdminIndustriesPage').then((m) => ({ Component: m.default })) },
  {
    path: '/',
    element: (<RequireSession><AppLayout /></RequireSession>),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'more', element: <MorePage /> },
      { path: 'log', element: guard('log.view', <LogPage />) },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'workers', element: <WorkersPage /> },
      { path: 'workers/new', element: guard('worker.manage', <WorkerFormPage />) },
      { path: 'workers/:id', element: <WorkerDetailPage /> },
      { path: 'workers/:id/edit', element: guard('worker.manage', <WorkerFormPage />) },
      { path: 'attendance', element: mod('attendance', <AttendancePage />) }, // viewable by all; marking needs "add entries" (SPEC-M13)
      { path: 'advances/new', element: mod('advances', guard('advance.give', <AdvanceNewPage />)) },
      { path: 'wages', element: mod('wages', guard('wages.view', <WagesPage />)) },
      { path: 'wages/:month/:workerId', element: mod('wages', guard('wages.view', <WagePayPage />)) },
      { path: 'stock', element: mod('stock', <StockPage />) },
      { path: 'stock/new', element: mod('stock', guard('item.manage', <ItemFormPage />)) },
      { path: 'stock/move/:kind', element: mod('stock', guard('stock.move', <StockMovePage />)) },
      { path: 'stock/:id', element: mod('stock', <ItemDetailPage />) },
      { path: 'stock/:id/edit', element: mod('stock', guard('item.manage', <ItemFormPage />)) },
      { path: 'orders', element: mod('orders', <OrdersPage />) },
      { path: 'orders/new', element: mod('orders', guard('order.manage', <OrderFormPage />)) },
      { path: 'orders/:id', element: mod('orders', <OrderDetailPage />) },
      { path: 'orders/:id/edit', element: mod('orders', guard('order.manage', <OrderFormPage />)) },
      { path: 'buyers', element: mod('orders', guard('order.manage', <BuyersPage />)) },
      { path: 'catalogue', element: mod('catalogue', <CataloguePage />) },                       // SPEC-M15
      { path: 'catalogue/new', element: mod('catalogue', guard('carpet.manage', <CarpetFormPage />)) },
      { path: 'catalogue/:id', element: mod('catalogue', <CarpetDetailPage />) },
      { path: 'catalogue/:id/edit', element: mod('catalogue', guard('carpet.manage', <CarpetFormPage />)) },
      { path: 'month', element: guard('log.view', <MonthPage />) }, // every section follows its module (SPEC-M18),
    ],
  },
  { path: '*', element: <SetupPage /> },
]);
