import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Pencil,
  HandCoins,
  Phone,
  Smartphone,
  Users as UsersIcon,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { Button, Card, EmptyState, Pill, PhotoThumb, Money, PageGrid } from '../../components/ui';
import { PageHeader } from '../../components/ui/PageHeader';
import { useRecords, useSession } from '../../db/hooks';
import {
  listWeavers,
  listLooms,
  peshgiBalance,
  weaverPassbook,
  formatDay,
} from '../../domain/projections';
import { can } from '../../domain/permissions';
import type { Rec, SlipP, SlipResponseP } from '../../db/types';
import { useT } from '../../i18n';
import { Section } from '../looms/shared';

export default function WeaverDetailPage() {
  const { t, lang } = useT();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const recs = useRecords();
  const { role } = useSession();

  const weaver = useMemo(() => listWeavers(recs).find((w) => w.entityId === id), [recs, id]);
  const looms = useMemo(() => listLooms(recs), [recs]);
  const balance = useMemo(() => peshgiBalance(recs, 'weaver', id), [recs, id]);
  const passbook = useMemo(() => weaverPassbook(recs, id), [recs, id]);

  // Map slip responses by source bazaar/peshgi id so the passbook can show them.
  const responsesBySource = useMemo(() => {
    const slips = recs.filter((r) => r.type === 'slip') as Rec<SlipP>[];
    const slipById = new Map(slips.map((s) => [s.payload.token, s.payload.sourceId]));
    const map = new Map<string, 'agree' | 'dispute'>();
    for (const r of recs) {
      if (r.type !== 'slip_response') continue;
      const p = r.payload as SlipResponseP;
      const src = slipById.get(p.token);
      if (src) map.set(src, p.answer);
    }
    return map;
  }, [recs]);

  if (!weaver) {
    return (
      <section>
        <PageHeader title={t('route.weaverDetail')} back />
        <EmptyState title={t('weaver.notFound')} action={<Button onClick={() => navigate('/weavers')}>{t('action.back')}</Button>} />
      </section>
    );
  }

  const canGive = role ? can(role, 'peshgi.give') : false;
  const canManage = role ? can(role, 'weaver.manage') : false;
  const loomCode = weaver.loomId ? looms.find((l) => l.entityId === weaver.loomId)?.code : undefined;

  const PhoneIcon = weaver.phoneType === 'smartphone' ? Smartphone : weaver.phoneType === 'shared' ? UsersIcon : Phone;

  return (
    <section>
      <PageHeader
        title={weaver.name}
        back
        right={
          canManage ? (
            <Button size="md" variant="secondary" onClick={() => navigate('/weavers/new')} aria-label={t('weaver.detail.edit')}>
              <Pencil aria-hidden="true" size={18} />
            </Button>
          ) : undefined
        }
      />

      <PageGrid
        asideSticky
        aside={
          <div className="flex flex-col gap-5">
            <Card className="flex items-center gap-4">
              <PhotoThumb id={weaver.photoId} alt={weaver.name} size={80} initials={weaver.name} className="rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="text-xl font-bold text-ink">{weaver.name}</div>
                <div className="text-base text-muted">{t('person.father')}: {weaver.fatherName}</div>
                <div className="text-sm text-muted">{weaver.village}{loomCode ? ` · ${loomCode}` : ` · ${t('weaver.loom.unassigned')}`}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Pill tone="neutral">
                    <PhoneIcon aria-hidden="true" size={14} />
                    {weaver.phone || t('weaver.phoneType.' + weaver.phoneType)}
                  </Pill>
                  {weaver.upi && <Pill tone="info">UPI</Pill>}
                </div>
              </div>
            </Card>

            {/* Peshgi balance — the hero number */}
            <Card className={'text-center ' + (balance > 0 ? 'bg-madder/5 border-madder/20' : 'bg-ok/5 border-ok/20')}>
              <div className="text-sm text-muted">{t('weaver.detail.peshgi')}</div>
              {balance > 0 ? (
                <Money paise={balance} flow="given" size="xl" className="mt-1" />
              ) : (
                <div className="mt-1 text-2xl font-bold text-ok">{t('weaver.detail.noPeshgi')}</div>
              )}
            </Card>

            {canGive && (
              <Button size="xl" onClick={() => navigate(`/peshgi/new?weaver=${weaver.entityId}`)}>
                <HandCoins aria-hidden="true" size={20} />
                {t('weaver.detail.givePeshgi')}
              </Button>
            )}
          </div>
        }
        main={
          <Section title={t('weaver.detail.passbook')}>
            {passbook.length === 0 ? (
              <p className="text-base text-muted">{t('weaver.detail.noPassbook')}</p>
            ) : (
              <ul className="space-y-2">
                {[...passbook].reverse().map((e) => {
                  const given = e.kind === 'peshgi_given';
                  const response = responsesBySource.get(e.recId);
                  return (
                    <li key={e.recId + e.kind}>
                      <Card className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <div className="text-base text-ink">
                            {e.kind === 'job' && e.work ? `${t('weaver.pass.job')} · ${t('work.' + e.work)}` : t('weaver.pass.' + e.kind)}
                          </div>
                          <div className="text-sm text-muted">{formatDay(e.day, lang, 'medium')}</div>
                          {response && (
                            <span className={'mt-1 inline-flex items-center gap-1 text-sm font-medium ' + (response === 'agree' ? 'text-ok' : 'text-madder')}>
                              {response === 'agree' ? <ThumbsUp size={14} aria-hidden="true" /> : <ThumbsDown size={14} aria-hidden="true" />}
                              {t(response === 'agree' ? 'weaver.detail.response.agree' : 'weaver.detail.response.dispute')}
                            </span>
                          )}
                        </div>
                        <Money
                          paise={e.amountPaise}
                          flow={given ? 'given' : 'received'}
                          withPaise
                          size="md"
                        />
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        }
      />
    </section>
  );
}
