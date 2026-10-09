import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid3x3, Plus, Search } from 'lucide-react';
import {
  Button,
  EmptyState,
  Input,
  Pill,
  PhotoThumb,
  Skeleton,
  ResponsiveTable,
} from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { useRecords, useSession } from '../../db/hooks';
import { listLooms, listThekedars, listPieces } from '../../domain/projections';
import { can } from '../../domain/permissions';
import { formatFtIn } from '../../domain/units';
import { useT } from '../../i18n';
import { StatusPill, ListRow } from './shared';

export default function LoomsPage() {
  const { t } = useT();
  const { role } = useSession();
  const navigate = useNavigate();
  const recs = useRecords();
  const [q, setQ] = useState('');

  const ready = recs.length > 0;
  const looms = useMemo(() => listLooms(recs).filter((l) => l.active), [recs]);
  const thekedars = useMemo(() => listThekedars(recs), [recs]);
  const pieces = useMemo(() => listPieces(recs), [recs]);

  const thekedarName = (id?: string) =>
    id ? thekedars.find((th) => th.entityId === id)?.name : undefined;
  const currentPiece = (loomId: string) =>
    pieces.find((p) => p.loomId === loomId && (p.status === 'on_loom' || p.status === 'on_hold'));

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return looms;
    return looms.filter(
      (l) =>
        l.code.toLowerCase().includes(n) ||
        l.village.toLowerCase().includes(n) ||
        (thekedarName(l.thekedarId) ?? '').toLowerCase().includes(n),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [looms, q, thekedars]);

  const canManage = role ? can(role, 'loom.manage') : false;

  return (
    <section>
      <PageHeader
        title={t('loom.list.title')}
        right={
          canManage && looms.length > 0 ? (
            <Button size="md" onClick={() => navigate('/looms/new')}>
              <Plus aria-hidden="true" size={20} />
              {t('loom.addShort')}
            </Button>
          ) : undefined
        }
      />

      {looms.length > 0 && (
        <div className="relative mb-4 lg:max-w-sm">
          <Search
            aria-hidden="true"
            size={20}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('loom.search')}
            aria-label={t('loom.search')}
            className="pl-11"
          />
        </div>
      )}

      {!ready ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : looms.length === 0 ? (
        <EmptyState
          icon={<Grid3x3 size={48} />}
          title={t('loom.empty.title')}
          hint={t('loom.empty.hint')}
          action={
            canManage ? (
              <Button onClick={() => navigate('/looms/new')}>
                <Plus aria-hidden="true" size={20} />
                {t('loom.add')}
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search size={40} />} title={t('common.empty')} />
      ) : (
        <ResponsiveTable
          rows={filtered}
          rowKey={(l) => l.entityId}
          testid="looms-table"
          onRowClick={(l) => navigate(`/looms/${l.entityId}`)}
          renderCard={(l) => {
            const cp = currentPiece(l.entityId);
            const th = thekedarName(l.thekedarId);
            return (
              <ListRow
                testId="loom-row"
                onClick={() => navigate(`/looms/${l.entityId}`)}
                leading={<PhotoThumb id={l.photoId} alt={l.code} size={56} initials={l.code} />}
              >
                <div className="flex items-center gap-2">
                  <span className="num text-lg font-bold text-ink">{l.code}</span>
                  <span className="text-muted">·</span>
                  <span className="truncate text-base text-muted">{l.village}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {cp ? (
                    <>
                      <StatusPill status={cp.status} label={t('status.' + cp.status)} />
                      <span className="num text-sm text-muted">{cp.pieceId} · {cp.pctWoven}%</span>
                    </>
                  ) : (
                    <Pill tone="neutral">{t('board.free')}</Pill>
                  )}
                  <span className="text-sm text-muted">{formatFtIn(l.widthIn)}</span>
                </div>
                {th && <div className="mt-0.5 text-sm text-muted">{t('role.thekedar')}: {th}</div>}
              </ListRow>
            );
          }}
          columns={[
            {
              key: 'code',
              header: t('col.loom.code'),
              cell: (l) => (
                <div className="flex items-center gap-3">
                  <PhotoThumb id={l.photoId} alt={l.code} size={36} initials={l.code} />
                  <span className="num font-bold text-ink">{l.code}</span>
                </div>
              ),
            },
            { key: 'village', header: t('col.loom.village'), cell: (l) => <span className="text-muted">{l.village} · {formatFtIn(l.widthIn)}</span> },
            { key: 'thekedar', header: t('col.loom.thekedar'), cell: (l) => <span className="text-muted">{thekedarName(l.thekedarId) ?? '—'}</span> },
            {
              key: 'piece',
              header: t('col.loom.piece'),
              cell: (l) => {
                const cp = currentPiece(l.entityId);
                return cp ? <span className="num">{cp.pieceId}</span> : <span className="text-muted">—</span>;
              },
            },
            {
              key: 'woven',
              header: t('col.loom.woven'),
              align: 'right',
              cell: (l) => {
                const cp = currentPiece(l.entityId);
                return cp ? <span className="num font-bold text-indigo">{cp.pctWoven}%</span> : <span className="text-muted">—</span>;
              },
            },
            {
              key: 'status',
              header: t('col.loom.status'),
              cell: (l) => {
                const cp = currentPiece(l.entityId);
                return cp ? (
                  <StatusPill status={cp.status} label={t('status.' + cp.status)} />
                ) : (
                  <Pill tone="neutral">{t('board.free')}</Pill>
                );
              },
            },
          ]}
        />
      )}
    </section>
  );
}
