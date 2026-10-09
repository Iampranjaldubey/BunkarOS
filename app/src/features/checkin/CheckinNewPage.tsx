import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Check as CheckIcon } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { FtInInput } from '../../components/ui/FtInInput';
import { PhotoCapture } from '../../components/ui/PhotoCapture';
import { ConfirmSheet } from '../../components/ui/Sheet';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/Feedback';
import { useToast } from '../../components/ui/Toast';
import { PiecePicker } from '../shared/pickers';
import { Row, ActionBar } from '../shared/helpers';
import { useRecords, useSession } from '../../db/hooks';
import { addRecord } from '../../db/repo';
import type { CheckinP, UserP } from '../../db/types';
import { listPieces, listUsers } from '../../domain/projections';
import { visibleLoomIds } from '../../domain/permissions';
import { formatFtIn } from '../../domain/units';
import { useT } from '../../i18n';

export default function CheckinNewPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const recs = useRecords();
  const { user } = useSession();

  const [pieceId, setPieceId] = useState<string | undefined>();
  const [wovenSince, setWovenSince] = useState(0); // inches since last
  const [photoId, setPhotoId] = useState<string | undefined>();
  const [gps, setGps] = useState<{ lat: number; lng: number } | undefined>();
  const [gpsBusy, setGpsBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Thekedar sees only his looms; owner/munshi see all.
  const loomIds = useMemo(() => {
    if (!user) return undefined;
    const u = listUsers(recs).find((x) => x.entityId === user.id) as UserP | undefined;
    if (!u) return undefined;
    if (u.role === 'owner' || u.role === 'munshi') return undefined; // all looms
    return visibleLoomIds(recs, u);
  }, [recs, user]);

  const piece = useMemo(() => listPieces(recs).find((p) => p.pieceId === pieceId), [recs, pieceId]);

  const newWovenIn = (piece?.wovenIn ?? 0) + wovenSince;
  const newPct = piece && piece.lengthIn > 0 ? Math.min(100, Math.round((newWovenIn / piece.lengthIn) * 100)) : 0;

  const wovenErr = touched && wovenSince <= 0 ? t('checkin.mustPositive') : undefined;
  const photoErr = touched && !photoId ? t('checkin.photoReq') : undefined;

  const valid = Boolean(pieceId && piece) && wovenSince > 0 && Boolean(photoId);

  const addGps = () => {
    if (!('geolocation' in navigator)) {
      toast.show(t('checkin.gpsFail'), 'error');
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsBusy(false);
        toast.show(t('checkin.gpsAdded'), 'success');
      },
      () => {
        setGpsBusy(false);
        toast.show(t('checkin.gpsFail'), 'error');
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const onSave = async () => {
    if (!piece) return;
    setSaving(true);
    try {
      const payload: CheckinP = {
        pieceId: piece.pieceId,
        loomId: piece.loomId ?? '',
        wovenIn: wovenSince,
        ...(gps ? { lat: gps.lat, lng: gps.lng } : {}),
      };
      await addRecord<CheckinP>('checkin', payload, { photoIds: [photoId!] });
      toast.show(t('checkin.saved', { pct: newPct }), 'success');
      navigate('/');
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  };

  const noLooms = loomIds !== undefined && loomIds.length === 0;

  return (
    <section>
      <PageHeader title={t('checkin.new')} back />
      <p className="mb-4 text-muted">{t('checkin.lead')}</p>

      {noLooms ? (
        <EmptyState title={t('checkin.noLooms')} hint={t('checkin.noLoomsHint')} />
      ) : (
        <>
          <Card className="mb-4">
            <PiecePicker recs={recs} value={pieceId} onSelect={setPieceId} loomIds={loomIds} label={t('checkin.pickLoom')} />
          </Card>

          {piece && (
            <>
              <Card className="mb-4">
                <Row label={t('checkin.prevWoven')}>
                  {formatFtIn(piece.wovenIn)} · <span className="text-indigo">{piece.pctWoven}%</span>
                </Row>
                <Field label={t('checkin.wovenSince')} hint={t('checkin.wovenHint')} required error={wovenErr} className="mt-2">
                  {({ describedBy, invalid }) => (
                    <FtInInput value={wovenSince} onChange={setWovenSince} describedBy={describedBy} invalid={invalid} />
                  )}
                </Field>
                <PhotoCapture value={photoId} onChange={setPhotoId} required label={t('checkin.photo')} error={photoErr} />
                <div>
                  <Button variant="secondary" onClick={addGps} disabled={gpsBusy}>
                    <MapPin aria-hidden="true" size={20} />
                    {gps ? t('checkin.gpsAdded') : t('checkin.gps')}
                  </Button>
                  {gps && (
                    <Badge tone="info" className="ml-2">
                      <CheckIcon aria-hidden="true" size={14} />
                      <span className="num">{gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}</span>
                    </Badge>
                  )}
                </div>
              </Card>

              <Card className="mb-4 bg-indigo/5 border-indigo/20">
                <div className="flex items-end justify-between">
                  <span className="text-base text-muted">{t('checkin.newPct')}</span>
                  <span className="num text-4xl font-bold text-indigo">{newPct}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={newPct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-indigo transition-[width]" style={{ width: `${newPct}%` }} />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {t('checkin.newWoven')}: <span className="num">{formatFtIn(wovenSince)}</span>
                </p>
              </Card>
            </>
          )}
        </>
      )}

      <ActionBar>
        <Button
          data-testid="checkin-save"
          size="xl"
          disabled={saving || noLooms}
          onClick={() => {
            setTouched(true);
            if (valid) setConfirm(true);
          }}
        >
          {t('checkin.save')}
        </Button>
      </ActionBar>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => void onSave()}
        title={t('checkin.confirmTitle')}
        confirmLabel={t('checkin.save')}
        message={t('checkin.confirmMsg', { piece: piece?.pieceId ?? '', pct: newPct })}
      />
    </section>
  );
}
