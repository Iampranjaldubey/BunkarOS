import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Action } from '../domain/permissions';
import { useCan, useOrg } from './useCan';
import type { ModuleId } from '../sync/types';
import { PauseCircle, PowerOff } from 'lucide-react';
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
  const org = useOrg();
  if (role && !allowed(action) && org.status === 'paused') return <Blocked kind="paused" />;
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

/** SPEC-M18: a screen of a module the platform turned off, or an entry screen while the organisation is paused. */
function Blocked({ kind }: { kind: 'module' | 'paused' }) {
  const { t } = useT();
  return (
    <section>
      <PageHeader title={kind === 'module' ? t('m18.moduleOff') : t('m18.paused')} back />
      <EmptyState icon={kind === 'module' ? <PowerOff size={36} /> : <PauseCircle size={36} />} title={kind === 'module' ? t('m18.moduleOff') : t('m18.paused')} hint={kind === 'module' ? t('m18.moduleOffHint') : t('m18.pausedHint')} />
    </section>
  );
}

export function RequireModule({ module, children }: { module: ModuleId; children: ReactNode }) {
  const org = useOrg();
  if (!org.modules[module]) return <Blocked kind="module" />;
  return <>{children}</>;
}
