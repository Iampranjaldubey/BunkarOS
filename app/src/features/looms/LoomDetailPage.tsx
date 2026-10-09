import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Power, MapPin, PackageOpen } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  Pill,
  PhotoThumb,
  BigNumber,
  ConfirmSheet,
  useToast,
} from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { useRecords, useSession } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import {
  listLooms,
  listThekedars,
  listWeavers,
  listPieces,
  yarnBalances,
} from '../../domain/projections';
import { can } from '../../domain/permissions';
import { formatFtIn, gramsToKgStr } from '../../domain/units';
import type { LoomP, CheckinP, Rec } from '../../db/types';
import { useT } from '../../i18n';
import { StatusPill, Section, ProgressBar, ListRow } from './shared';

export default function LoomDetailPage() {
  const { t } = useT();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const { role } = useSession();
  const [confirmOff, setConfirmOff] = useState(false);

  const loom = useMemo(() => listLooms(recs).find((l) => l.entityId === id), [recs, id]);
  const thekedars = useMemo(() => listThekedars(recs), [recs]);
  const weavers = useMemo(() => listWeavers(recs), [recs]);
  const pieces = useMemo(() => listPieces(recs), [recs]);
  const balances = useMemo(() => yarnBalances(recs), [recs]);

  const checkins = useMemo(
    () =>
      (recs.filter((r) => r.type === 'checkin') as Rec<CheckinP>[])
        .filter((r) => r.payload.loomId === id)
        .sort((a, b) => b.at.localeCompare(a.at)),
    [recs, id],
  );

  if (!loom) {
    return (
      <section>
        <PageHeader title={t('route.loomDetail')} back />
        <EmptyState title={t('loom.notFound')} action={<Button onClick={() => navigate('/looms')}>{t('action.back')}</Button>} />
      </section>
    );
  }

  const canManage = role ? can(role, 'loom.manage') : false;
  const th = loom.thekedarId ? thekedars.find((x) => x.entityId === loom.thekedarId) : undefined;
  const loomWeavers = weavers.filter((w) => loom.weaverIds.includes(w.entityId));
  const currentPiece = pieces.find(
    (p) => p.loomId === loom.entityId && (p.status === 'on_loom' || p.status === 'on_hold'),
  );
  const woolRows = balances.filter(
    (b) => b.holder.kind === 'loom' && b.holder.loomId === loom.entityId && b.grams !== 0,
  );

  const deactivate = async () => {
    setConfirmOff(false);
    const payload: LoomP = { ...loom, active: false };
    await addRecord<LoomP>('loom', payload);
    toast.show(t('loom.deactivated'), 'success');
    navigate('/looms', { replace: true });
  };

  return (
    <section>
      <PageHeader
        title={loom.code}
        back
        right={
          canManage ? (
            <Button size="md" variant="secondary" onClick={() => navigate('/looms/new')} aria-label={t('loom.detail.edit')}>
              <Pencil aria-hidden="true" size={18} />
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-6 flex items-center gap-4">
        <PhotoThumb id={loom.photoId} alt={loom.code} size={72} initials={loom.code} />
        <div className="min-w-0 flex-1">
          <div className="num text-2xl font-bold text-ink">{loom.code}</div>
          <div className="text-base text-muted">{loom.village} · {formatFtIn(loom.widthIn)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {!loom.active && <Pill tone="danger">{t('loom.inactive')}</Pill>}
            {th && <Pill tone="info">{t('role.thekedar')}: {th.name}</Pill>}
            {loom.lat !== undefined && (
              <span className="num inline-flex items-center gap-1 text-sm text-muted">
                <MapPin aria-hidden="true" size={14} /> {loom.lat.toFixed(4)}, {loom.lng?.toFixed(4)}
              </span>
            )}
          </div>
        </div>
      </Card>

      <Section title={t('loom.detail.currentPiece')}>
        {currentPiece ? (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <span className="num text-lg font-bold text-ink">{currentPiece.pieceId}</span>
              <StatusPill status={currentPiece.status} label={t('status.' + currentPiece.status)} />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <ProgressBar pct={currentPiece.pctWoven} />
              <span className="num text-lg font-bold text-indigo">{currentPiece.pctWoven}%</span>
            </div>
            <div className="mt-1 text-sm text-muted">
              {currentPiece.design} · {currentPiece.colour} · {t('loom.detail.woven')} {formatFtIn(currentPiece.wovenIn)}
            </div>
          </Card>
        ) : (
          <p className="text-base text-muted">{t('loom.detail.noPiece')}</p>
        )}
      </Section>

      <Section title={t('loom.detail.weavers')}>
        {loomWeavers.length === 0 ? (
          <p className="text-base text-muted">{t('common.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {loomWeavers.map((w) => (
              <li key={w.entityId}>
                <ListRow onClick={() => navigate(`/weavers/${w.entityId}`)} leading={<PhotoThumb id={w.photoId} alt={w.name} size={48} initials={w.name} className="rounded-full" />}>
                  <span className="text-base font-medium text-ink">{w.name}</span>
                  <span className="block text-sm text-muted">{t('person.father')}: {w.fatherName} · {w.village}</span>
                </ListRow>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('loom.detail.wool')}>
        {woolRows.length === 0 ? (
          <p className="text-base text-muted">{t('loom.detail.noWool')}</p>
        ) : (
          <ul className="space-y-2">
            {woolRows.map((b) => (
              <li key={`${b.shade}|${b.lot}`}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-2">
                    <PackageOpen aria-hidden="true" size={20} className="text-muted" />
                    <div>
                      <div className="text-base text-ink">{b.shade}</div>
                      <div className="text-sm text-muted">{t('nav.yarn')} · {b.lot}</div>
                    </div>
                  </div>
                  <BigNumber value={gramsToKgStr(b.grams)} unit={t('common.kg')} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('loom.detail.checkins')}>
        {checkins.length === 0 ? (
          <p className="text-base text-muted">{t('loom.detail.noCheckins')}</p>
        ) : (
          <ul className="space-y-2">
            {checkins.map((c) => (
              <li key={c.id}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <div className="num text-base font-medium text-ink">{formatFtIn(c.payload.wovenIn)}</div>
                    <div className="num text-sm text-muted">{c.day}</div>
                  </div>
                  <span className="num text-sm text-muted">{c.payload.pieceId}</span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {canManage && loom.active && (
        <Button variant="danger" size="xl" onClick={() => setConfirmOff(true)}>
          <Power aria-hidden="true" size={20} />
          {t('loom.detail.deactivate')}
        </Button>
      )}

      <ConfirmSheet
        open={confirmOff}
        onClose={() => setConfirmOff(false)}
        onConfirm={deactivate}
        title={t('loom.deactivate.title')}
        message={t('loom.deactivate.msg')}
        confirmLabel={t('loom.detail.deactivate')}
        danger
      />
    </section>
  );
}
