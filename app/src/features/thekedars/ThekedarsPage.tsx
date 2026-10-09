import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, Plus, Search, Grid3x3, PackageOpen } from 'lucide-react';
import { Button, Card, EmptyState, Input, Pill, PhotoThumb, Skeleton, BigNumber } from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { useRecords, useSession } from '../../db/hooks';
import { listThekedars, listLooms, yarnBalances } from '../../domain/projections';
import { can } from '../../domain/permissions';
import { gramsToKgStr } from '../../domain/units';
import { useT } from '../../i18n';

export default function ThekedarsPage() {
  const { t } = useT();
  const { role } = useSession();
  const navigate = useNavigate();
  const recs = useRecords();
  const [q, setQ] = useState('');

  const ready = recs.length > 0;
  const thekedars = useMemo(() => listThekedars(recs).filter((th) => th.active), [recs]);
  const looms = useMemo(() => listLooms(recs).filter((l) => l.active), [recs]);
  const balances = useMemo(() => yarnBalances(recs), [recs]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return thekedars;
    return thekedars.filter((th) => th.name.toLowerCase().includes(n) || th.village.toLowerCase().includes(n));
  }, [thekedars, q]);

  const canManage = role ? can(role, 'loom.manage') : false;

  return (
    <section>
      <PageHeader
        title={t('thekedar.list.title')}
        right={
          canManage && thekedars.length > 0 ? (
            <Button size="md" onClick={() => navigate('/thekedars/new')}>
              <Plus aria-hidden="true" size={20} />
              {t('thekedar.addShort')}
            </Button>
          ) : undefined
        }
      />

      {thekedars.length > 0 && (
        <div className="relative mb-4">
          <Search aria-hidden="true" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('thekedar.search')} aria-label={t('thekedar.search')} className="pl-11" />
        </div>
      )}

      {!ready ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : thekedars.length === 0 ? (
        <EmptyState
          icon={<HardHat size={48} />}
          title={t('thekedar.empty.title')}
          hint={t('thekedar.empty.hint')}
          action={canManage ? <Button onClick={() => navigate('/thekedars/new')}><Plus aria-hidden="true" size={20} />{t('thekedar.add')}</Button> : undefined}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search size={40} />} title={t('common.empty')} />
      ) : (
        <ul className="space-y-4">
          {filtered.map((th) => {
            const thLooms = looms.filter((l) => l.thekedarId === th.entityId);
            const wool = balances.filter((b) => b.holder.kind === 'thekedar' && b.holder.thekedarId === th.entityId && b.grams !== 0);
            return (
              <li key={th.entityId}>
                <Card data-testid="thekedar-row">
                  <div className="flex items-center gap-3">
                    <PhotoThumb id={th.photoId} alt={th.name} size={56} initials={th.name} className="rounded-full" />
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-bold text-ink">{th.name}</div>
                      <div className="text-sm text-muted">{th.village}{th.phone ? ` · ${th.phone}` : ''}</div>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-line pt-3">
                    <div className="mb-1 flex items-center gap-2 text-sm text-muted">
                      <Grid3x3 aria-hidden="true" size={16} />
                      {t('thekedar.looms')}
                    </div>
                    {thLooms.length === 0 ? (
                      <p className="text-sm text-muted">{t('thekedar.noLooms')}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {thLooms.map((l) => (
                          <Pill key={l.entityId} tone="info">{l.code}</Pill>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 border-t border-line pt-3">
                    <div className="mb-1 flex items-center gap-2 text-sm text-muted">
                      <PackageOpen aria-hidden="true" size={16} />
                      {t('thekedar.wool')}
                    </div>
                    {wool.length === 0 ? (
                      <p className="text-sm text-muted">{t('thekedar.noWool')}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {wool.map((b) => (
                          <li key={`${b.shade}|${b.lot}`} className="flex items-center justify-between">
                            <span className="text-sm text-ink">{b.shade} · {b.lot}</span>
                            <BigNumber value={gramsToKgStr(b.grams)} unit={t('common.kg')} className="[&_*]:text-xl" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
