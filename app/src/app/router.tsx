import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireSession, RequireCan } from './guards';
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
const WorkerLinkPage = lazy(() => import('../worker/WorkerLinkPage'));
const WorkerHomePage = lazy(() => import('../worker/WorkerHomePage'));
const WorkerJoinPage = lazy(() => import('../worker/WorkerJoinPage'));

const guard = (action: Parameters<typeof RequireCan>[0]['action'], el: React.ReactNode) => <RequireCan action={action}>{el}</RequireCan>;

export const router = createBrowserRouter([
  { path: '/setup', element: <SetupPage /> },
  { path: '/login', element: <LoginPage /> },
  // Public worker pages (SPEC-M07): no session.
  { path: '/w', element: <WorkerHomePage /> },
  { path: '/w/join', element: <WorkerJoinPage /> },
  { path: '/w/:token', element: <WorkerLinkPage /> },
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
      { path: 'attendance', element: guard('attendance.mark', <AttendancePage />) },
      { path: 'advances/new', element: guard('advance.give', <AdvanceNewPage />) },
      { path: 'wages', element: guard('wages.view', <WagesPage />) },
      { path: 'wages/:month/:workerId', element: guard('wages.view', <WagePayPage />) },
      { path: 'stock', element: <StockPage /> },
      { path: 'stock/new', element: guard('item.manage', <ItemFormPage />) },
      { path: 'stock/move/:kind', element: guard('stock.move', <StockMovePage />) },
      { path: 'stock/:id', element: <ItemDetailPage /> },
      { path: 'stock/:id/edit', element: guard('item.manage', <ItemFormPage />) },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/new', element: guard('order.manage', <OrderFormPage />) },
      { path: 'orders/:id', element: <OrderDetailPage /> },
      { path: 'orders/:id/edit', element: guard('order.manage', <OrderFormPage />) },
      { path: 'buyers', element: guard('order.manage', <BuyersPage />) },
      { path: 'month', element: guard('wages.view', <MonthPage />) },
    ],
  },
  { path: '*', element: <SetupPage /> },
]);
