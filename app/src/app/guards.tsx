import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Action } from '../domain/permissions';
import { useCan } from './useCan';
import { EmptyState } from '../components/ui/Feedback';
import { PageHeader } from '../components/ui/PageHeader';
import { useT } from '../i18n';
import { useSession } from './session';

export function RequireSession({ children }: { children: ReactNode }) {
  const { ready, hasUnit, user } = useSession();
  if (!ready) return null;
  if (!hasUnit) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireCan({ action, children }: { action: Action; children: ReactNode }) {
  const { role } = useSession();
  const { t } = useT();
  const allowed = useCan();
  if (!role || !allowed(action)) {
    return (
      <section>
        <PageHeader title={t('app.name')} back />
        <EmptyState title={t('common.empty')} hint={t('role.' + role)} />
      </section>
    );
  }
  return <>{children}</>;
}
