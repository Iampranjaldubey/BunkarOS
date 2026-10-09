import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { can, type Action } from '../domain/permissions';
import { EmptyState } from '../components/ui/Feedback';
import { PageHeader } from '../components/ui/PageHeader';
import { useT } from '../i18n';
import { useSession } from './session';

/** Gate authenticated screens. No unit → /setup; no session → /login. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { ready, hasUnit, user } = useSession();
  if (!ready) return null;
  if (!hasUnit) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Role-based action guard using the domain `can`. */
export function RequireCan({ action, children }: { action: Action; children: ReactNode }) {
  const { role } = useSession();
  const { t } = useT();
  if (!role || !can(role, action)) {
    return (
      <section>
        <PageHeader title={t('app.name')} back />
        <EmptyState title={t('common.empty')} hint={t('role.' + role)} />
      </section>
    );
  }
  return <>{children}</>;
}
