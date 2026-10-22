import { Link } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MORE } from '../../components/ui/nav-items';
import { can } from '../../domain/permissions';
import { useSession } from '../../app/session';
import { useT } from '../../i18n';

/** Phone "More" menu: every destination not on the bottom bar, plus logout. */
export default function MorePage() {
  const { t } = useT();
  const { role, user, logout } = useSession();
  const items = MORE.filter((it) => !it.action || (role && can(role, it.action)));
  return (
    <section>
      <PageHeader title={t('nav.more')} />
      <Card className="divide-y divide-line p-0">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link key={it.to} to={it.to} className="flex min-h-14 items-center gap-3 px-4 py-3 text-base font-medium text-ink hover:bg-surface-2">
              <span className="rounded-xl bg-primary-soft p-2 text-primary"><Icon aria-hidden="true" size={22} /></span>
              <span className="flex-1">{t(it.labelKey)}</span>
              <ChevronRight aria-hidden="true" className="text-muted" />
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
