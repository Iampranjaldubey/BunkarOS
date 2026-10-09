import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, Package, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState, Skeleton } from '../../components/ui/Feedback';
import { useRecords, useSession } from '../../db/hooks';
import { yarnBalances, type YarnBalanceRow } from '../../domain/projections';
import { can } from '../../domain/permissions';
import { gramsToKgStr } from '../../domain/units';
import { holderLabel } from '../shared/helpers';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

const STALE_DAYS = 60;

function daysSince(day?: string): number | undefined {
  if (!day) return undefined;
  const then = new Date(day + 'T00:00:00').getTime();
  if (Number.isNaN(then)) return undefined;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export default function YarnPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { role } = useSession();
  const recs = useRecords();

  const rows = useMemo(
    () => yarnBalances(recs).filter((r) => r.grams > 0).sort((a, b) => b.grams - a.grams),
    [recs],
  );

  // Group positive balances by holder for the "who holds how much" view.
  const byHolder = useMemo(() => {
    const map = new Map<string, { holder: YarnBalanceRow['holder']; rows: YarnBalanceRow[]; grams: number }>();
    for (const r of rows) {
      const g = map.get(r.holderKey) ?? { holder: r.holder, rows: [], grams: 0 };
      g.rows.push(r);
      g.grams += r.grams;
      map.set(r.holderKey, g);
    }
    return [...map.values()].sort((a, b) => b.grams - a.grams);
  }, [rows]);

  const totalG = rows.reduce((s, r) => s + r.grams, 0);
  const canIssue = role ? can(role, 'yarn.issue') : false;

  return (
    <section className="pb-4">
      <PageHeader title={t('yarn.title')} />

      {canIssue && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Button variant="danger" size="lg" className="flex-col gap-1 py-3" onClick={() => navigate('/yarn/issue')}>
            <ArrowUpFromLine aria-hidden="true" size={22} />
            {t('yarn.issue')}
          </Button>
          <Button variant="success" size="lg" className="flex-col gap-1 py-3" onClick={() => navigate('/yarn/return')}>
            <ArrowDownToLine aria-hidden="true" size={22} />
            {t('yarn.return')}
          </Button>
        </div>
      )}

      {recs.length === 0 ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : byHolder.length === 0 ? (
        <EmptyState
          icon={<Package size={44} />}
          title={t('yarn.empty')}
          hint={t('yarn.emptyHint')}
          action={canIssue ? <Button onClick={() => navigate('/yarn/issue')}>{t('yarn.issue')}</Button> : undefined}
        />
      ) : (
        <>
          <Card className="mb-4 bg-madder/5 border-madder/20">
            <div className="flex items-center justify-between">
              <span className="text-base text-muted">{t('yarn.totalOutside')}</span>
              <span className="num text-3xl font-bold text-madder">
                {gramsToKgStr(totalG)} <span className="text-xl text-muted">{t('common.kg')}</span>
              </span>
            </div>
          </Card>

          <h2 className="mb-2 text-lg">{t('yarn.byHolder')}</h2>
          <ul className="flex flex-col gap-3">
            {byHolder.map((g) => {
              const oldest = Math.max(
                ...g.rows.map((r) => daysSince(r.oldestIssueDay) ?? 0),
              );
              const stale = oldest > STALE_DAYS;
              return (
                <li key={g.holder.kind + (g.holder.kind === 'loom' ? g.holder.loomId : g.holder.thekedarId)}>
                  <Card className={cn(stale && 'border-saffron/50 bg-saffron/5')}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <span className="text-lg font-semibold text-ink">{holderLabel(recs, g.holder)}</span>
                      <span className="num text-2xl font-bold text-madder">
                        {gramsToKgStr(g.grams)}
                        <span className="ml-1 text-base text-muted">{t('common.kg')}</span>
                      </span>
                    </div>
                    {stale && (
                      <Badge tone="warn" className="mb-2">
                        <AlertTriangle aria-hidden="true" size={14} />
                        {t('yarn.staleWarn')}
                      </Badge>
                    )}
                    <ul className="divide-y divide-line">
                      {g.rows.map((r) => {
                        const d = daysSince(r.oldestIssueDay);
                        const rowStale = (d ?? 0) > STALE_DAYS;
                        return (
                          <li key={r.shade + r.lot} className="flex items-center justify-between gap-3 py-2">
                            <span>
                              <span className="block text-base text-ink">
                                {r.shade} · <span className="num">{r.lot}</span>
                              </span>
                              {d !== undefined && (
                                <span className={cn('text-xs', rowStale ? 'font-medium text-saffron-ink' : 'text-muted')}>
                                  {t('yarn.oldestDays', { days: d })}
                                </span>
                              )}
                            </span>
                            <span className="num text-lg font-semibold text-ink">
                              {gramsToKgStr(r.grams)} {t('common.kg')}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
