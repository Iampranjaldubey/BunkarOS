import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ExternalLink, MoreVertical } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  Select,
  Sheet,
  ConfirmSheet,
  PersonPicker,
  type Person,
  useToast,
  ResponsiveTable,
} from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { useRecords, useSession } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import { listOrders, listPieces, listLooms, listWeavers } from '../../domain/projections';
import { can } from '../../domain/permissions';
import { formatFtIn } from '../../domain/units';
import type { PieceAssignP, PieceStatusP } from '../../db/types';
import type { Piece } from '../../domain/projections';
import { useT } from '../../i18n';
import { StatusPill, Section, ProgressBar } from '../looms/shared';

export default function OrderDetailPage() {
  const { t } = useT();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const { role } = useSession();

  const order = useMemo(() => listOrders(recs).find((o) => o.entityId === id), [recs, id]);
  const pieces = useMemo(() => listPieces(recs).filter((p) => p.orderId === id), [recs, id]);
  const looms = useMemo(() => listLooms(recs).filter((l) => l.active), [recs]);
  const weavers = useMemo(() => listWeavers(recs).filter((w) => w.active), [recs]);

  const [actionPiece, setActionPiece] = useState<Piece | null>(null);
  const [assignFor, setAssignFor] = useState<Piece | null>(null);
  const [confirmDeliver, setConfirmDeliver] = useState<Piece | null>(null);

  if (!order) {
    return (
      <section>
        <PageHeader title={t('route.orderDetail')} back />
        <EmptyState title={t('order.notFound')} action={<Button onClick={() => navigate('/orders')}>{t('action.back')}</Button>} />
      </section>
    );
  }

  const canCreate = role ? can(role, 'order.create') : false;
  const loomCode = (loomId?: string) => (loomId ? looms.find((l) => l.entityId === loomId)?.code : undefined);
  const weaverName = (weaverId?: string) => (weaverId ? weavers.find((w) => w.entityId === weaverId)?.name : undefined);

  const setStatus = async (pieceId: string, status: PieceStatusP['status']) => {
    await addRecord<PieceStatusP>('piece_status', { pieceId, status });
  };

  return (
    <section>
      <PageHeader title={order.orderNo} back />

      <Card className="mb-5">
        <div className="text-base text-ink">{order.exporter}</div>
        <div className="text-sm text-muted">{order.design} · {order.colour} · {order.quality}</div>
        <div className="num text-sm text-muted">{formatFtIn(order.lengthIn)} × {formatFtIn(order.widthIn)} · {order.count} {t('order.pieces')}</div>
        <Link
          to={`/o/${order.entityId}`}
          className="mt-3 inline-flex items-center gap-2 rounded-xl text-base font-medium text-indigo focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink lg:min-h-11"
        >
          <ExternalLink aria-hidden="true" size={18} />
          {t('order.detail.exporterLink')}
        </Link>
      </Card>

      <Section title={t('order.detail.pieces')}>
        <ResponsiveTable
          rows={pieces}
          rowKey={(p) => p.pieceId}
          testid="pieces-table"
          renderCard={(p) => (
            <Card data-testid="piece-row" className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="num text-lg font-bold text-ink">{p.pieceId}</span>
                <div className="flex items-center gap-2">
                  <StatusPill status={p.status} label={t('status.' + p.status)} />
                  {canCreate && (
                    <button
                      type="button"
                      aria-label={t('order.piece')}
                      onClick={() => setActionPiece(p)}
                      className="tap-48 -mr-1 inline-flex items-center justify-center rounded-full text-muted hover:text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
                    >
                      <MoreVertical aria-hidden="true" size={20} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <ProgressBar pct={p.pctWoven} />
                <span className="num w-12 text-right text-base font-bold text-indigo">{p.pctWoven}%</span>
              </div>
              <div className="mt-1 text-sm text-muted">
                {loomCode(p.loomId) ? `${t('order.piece.loom')}: ${loomCode(p.loomId)}` : t('order.piece.noLoom')}
              </div>
            </Card>
          )}
          columns={[
            { key: 'id', header: t('col.piece.id'), cell: (p) => <span className="num font-bold text-ink">{p.pieceId}</span> },
            { key: 'status', header: t('col.piece.status'), cell: (p) => <StatusPill status={p.status} label={t('status.' + p.status)} /> },
            { key: 'loom', header: t('col.piece.loom'), cell: (p) => <span className="num text-muted">{loomCode(p.loomId) ?? '—'}</span> },
            { key: 'weaver', header: t('col.piece.weaver'), cell: (p) => <span className="text-muted">{weaverName(p.weaverId) ?? '—'}</span> },
            {
              key: 'woven',
              header: t('col.piece.woven'),
              className: 'w-48',
              cell: (p) => (
                <div className="flex items-center gap-3">
                  <ProgressBar pct={p.pctWoven} />
                  <span className="num w-11 text-right font-bold text-indigo">{p.pctWoven}%</span>
                </div>
              ),
            },
            {
              key: 'actions',
              header: t('col.piece.actions'),
              align: 'right',
              cell: (p) =>
                canCreate ? (
                  <button
                    type="button"
                    aria-label={`${t('order.piece')} ${p.pieceId}`}
                    data-testid="piece-action"
                    onClick={() => setActionPiece(p)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-indigo/5 hover:text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
                  >
                    <MoreVertical aria-hidden="true" size={20} />
                  </button>
                ) : null,
            },
          ]}
        />
      </Section>

      {/* Per-piece action sheet */}
      <Sheet
        open={Boolean(actionPiece)}
        onClose={() => setActionPiece(null)}
        title={actionPiece ? `${t('order.piece')} ${actionPiece.pieceId}` : ''}
      >
        {actionPiece && (
          <div className="space-y-3">
            <Button
              block
              data-testid="assign-btn"
              onClick={() => {
                setAssignFor(actionPiece);
                setActionPiece(null);
              }}
            >
              {t('piece.assign')}
            </Button>

            {actionPiece.status === 'off_loom' ? (
              <Button
                block
                variant="success"
                onClick={() => {
                  setConfirmDeliver(actionPiece);
                  setActionPiece(null);
                }}
              >
                {t('piece.deliver')}
              </Button>
            ) : (
              actionPiece.status !== 'delivered' && (
                <p className="text-sm text-muted">{t('piece.deliverOnlyOff')}</p>
              )
            )}

            {actionPiece.status === 'on_hold' ? (
              <Button
                block
                variant="secondary"
                onClick={async () => {
                  await setStatus(actionPiece.pieceId, 'resumed');
                  toast.show(t('piece.resumed'), 'success');
                  setActionPiece(null);
                }}
              >
                {t('piece.resume')}
              </Button>
            ) : (
              (actionPiece.status === 'on_loom') && (
                <Button
                  block
                  variant="secondary"
                  onClick={async () => {
                    await setStatus(actionPiece.pieceId, 'on_hold');
                    toast.show(t('piece.held'), 'success');
                    setActionPiece(null);
                  }}
                >
                  {t('piece.hold')}
                </Button>
              )
            )}
          </div>
        )}
      </Sheet>

      {/* Assign-to-loom sheet */}
      <AssignSheet
        piece={assignFor}
        looms={looms.map((l) => ({ id: l.entityId, code: l.code, village: l.village }))}
        weavers={weavers.map((w) => ({ id: w.entityId, name: w.name, village: w.village, fatherName: w.fatherName, photoId: w.photoId }))}
        onClose={() => setAssignFor(null)}
        onAssign={async (loomId, weaverId) => {
          if (!assignFor) return;
          await addRecord<PieceAssignP>('piece_assign', { pieceId: assignFor.pieceId, loomId, weaverId });
          toast.show(t('piece.assigned'), 'success');
          setAssignFor(null);
        }}
      />

      <ConfirmSheet
        open={Boolean(confirmDeliver)}
        onClose={() => setConfirmDeliver(null)}
        onConfirm={async () => {
          if (confirmDeliver) {
            await setStatus(confirmDeliver.pieceId, 'delivered');
            toast.show(t('piece.delivered'), 'success');
          }
          setConfirmDeliver(null);
        }}
        title={t('piece.deliver.title')}
        message={t('piece.deliver.msg')}
        confirmLabel={t('piece.deliver')}
      />
    </section>
  );
}

function AssignSheet({
  piece,
  looms,
  weavers,
  onClose,
  onAssign,
}: {
  piece: Piece | null;
  looms: { id: string; code: string; village: string }[];
  weavers: Person[];
  onClose: () => void;
  onAssign: (loomId: string, weaverId?: string) => void;
}) {
  const { t } = useT();
  const [loomId, setLoomId] = useState('');
  const [weaverId, setWeaverId] = useState<string | undefined>();

  // Reset when the sheet opens for a new piece.
  useMemo(() => {
    setLoomId(piece?.loomId ?? '');
    setWeaverId(piece?.weaverId);
  }, [piece]);

  return (
    <Sheet
      open={Boolean(piece)}
      onClose={onClose}
      title={t('piece.assign.title')}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose}>{t('action.cancel')}</Button>
          <Button block disabled={!loomId} onClick={() => onAssign(loomId, weaverId)}>{t('action.confirm')}</Button>
        </>
      }
    >
      <div className="mb-4">
        <p className="mb-1.5 text-base font-medium text-ink">{t('piece.assign.loom')}</p>
        {looms.length === 0 ? (
          <p className="text-sm text-muted">{t('loom.noneToPick')}</p>
        ) : (
          <Select value={loomId} onChange={(e) => setLoomId(e.target.value)} aria-label={t('piece.assign.loom')}>
            <option value="">—</option>
            {looms.map((l) => (
              <option key={l.id} value={l.id}>{l.code} — {l.village}</option>
            ))}
          </Select>
        )}
      </div>

      {weavers.length > 0 && (
        <PersonPicker
          people={weavers}
          value={weaverId}
          onSelect={(wid) => setWeaverId(wid === weaverId ? undefined : wid)}
          label={t('piece.assign.weaver')}
        />
      )}
    </Sheet>
  );
}
