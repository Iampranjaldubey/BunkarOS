import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search } from 'lucide-react';
import { Button, EmptyState, Input, PhotoThumb, Skeleton } from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { useRecords, useSession } from '../../db/hooks';
import { listWeavers, listLooms, peshgiBalance } from '../../domain/projections';
import { can } from '../../domain/permissions';
import { formatINR } from '../../domain/money';
import { useT } from '../../i18n';

export default function WeaversPage() {
  const { t } = useT();
  const { role } = useSession();
  const navigate = useNavigate();
  const recs = useRecords();
  const [q, setQ] = useState('');

  const ready = recs.length > 0;
  const weavers = useMemo(() => listWeavers(recs).filter((w) => w.active), [recs]);
  const looms = useMemo(() => listLooms(recs), [recs]);

  const loomCode = (id?: string) => (id ? looms.find((l) => l.entityId === id)?.code : undefined);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return weavers;
    return weavers.filter(
      (w) =>
        w.name.toLowerCase().includes(n) ||
        w.fatherName.toLowerCase().includes(n) ||
        w.village.toLowerCase().includes(n),
    );
  }, [weavers, q]);

  const canManage = role ? can(role, 'weaver.manage') : false;

  return (
    <section>
      <PageHeader
        title={t('weaver.list.title')}
        right={
          canManage && weavers.length > 0 ? (
            <Button size="md" onClick={() => navigate('/weavers/new')}>
              <Plus aria-hidden="true" size={20} />
              {t('weaver.addShort')}
            </Button>
          ) : undefined
        }
      />

      {weavers.length > 0 && (
        <div className="relative mb-4 lg:max-w-sm">
          <Search aria-hidden="true" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('weaver.search')}
            aria-label={t('weaver.search')}
            className="pl-11"
          />
        </div>
      )}

      {!ready ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : weavers.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
          title={t('weaver.empty.title')}
          hint={t('weaver.empty.hint')}
          action={
            canManage ? (
              <Button onClick={() => navigate('/weavers/new')}>
                <Plus aria-hidden="true" size={20} />
                {t('weaver.add')}
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search size={40} />} title={t('common.empty')} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((w) => {
            const bal = peshgiBalance(recs, 'weaver', w.entityId);
            const code = loomCode(w.loomId);
            return (
              <li key={w.entityId}>
                <button
                  type="button"
                  data-testid="weaver-tile"
                  onClick={() => navigate(`/weavers/${w.entityId}`)}
                  className="flex h-full w-full flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-center shadow-card transition-colors hover:bg-bg focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
                >
                  <PhotoThumb id={w.photoId} alt={w.name} size={72} initials={w.name} className="rounded-full" />
                  <span className="text-base font-medium leading-tight text-ink">{w.name}</span>
                  <span className="text-xs text-muted">{t('person.father')}: {w.fatherName}</span>
                  <span className="text-xs text-muted">{w.village}{code ? ` · ${code}` : ''}</span>
                  {bal > 0 && (
                    <span className="num mt-auto text-sm font-bold text-madder">
                      {t('weaver.detail.peshgi')} {formatINR(bal)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
