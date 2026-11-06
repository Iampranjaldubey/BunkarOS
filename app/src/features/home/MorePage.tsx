import { Link } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MORE } from '../../components/ui/nav-items';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';
import { useCanSee, useModule } from '../../app/useCan';

/** Phone "More" menu: every destination not on the bottom bar, plus logout. */
export default function MorePage() {
  const { t } = useT();
  const { role, user, logout } = useSession();
  const on = useModule();
  const see = useCanSee();
  const items = MORE.filter((it) => (!it.module || on(it.module)) && (!it.action || see(it.action)));
  return (
    <section>
      <PageHeader title={t('nav.more')} />
      <Card className="divide-y divide-line p-0">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link key={it.to} to={it.to} className="flex min-h-14 items-center gap-3 px-4 py-3 text-base text-ink transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-surface-2/70">
              <Icon aria-hidden="true" size={20} strokeWidth={1.6} className="shrink-0 text-muted" />
              <span className="flex-1">{t(it.labelKey)}</span>
              <ChevronRight aria-hidden="true" size={18} className="text-muted" />
            </Link>
          );
        })}
      </Card>
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-surface p-4">
        <div><p className="font-medium text-ink">{user?.name}</p><p className="text-sm text-muted">{t(`role.${role}`)}</p></div>
        <Button variant="secondary" size="md" onClick={logout}><LogOut aria-hidden="true" size={18} />{t('action.logout')}</Button>
      </div>
    </section>
  );
}
