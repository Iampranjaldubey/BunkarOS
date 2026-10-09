import { useMemo, useState } from 'react';
import { History, User as UserIcon } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Badge, Pill } from '../../components/ui/Badge';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import { EmptyState } from '../../components/ui/Feedback';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { useRecords } from '../../db/hooks';
import { auditLog, listUsers, formatDay, formatTime } from '../../domain/projections';
import type { AuditEntry } from '../../domain/projections';
import type { Rec, RecordType } from '../../db/types';
import { useT } from '../../i18n';

const MASTER_TYPES = new Set<RecordType>(['user', 'loom', 'thekedar', 'weaver', 'order', 'rate', 'norm', 'setting']);

/** Short human IST stamp "9 Oct · 2:30 pm" using the shared date helpers. */
function fmtStamp(iso: string, lang: 'hi' | 'en'): string {
  const day = iso.slice(0, 10);
  try {
    return `${formatDay(day, lang, 'short')} · ${formatTime(iso, lang)}`;
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

/** entityId of a master record payload, if any. */
function entityIdOf(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object' && 'entityId' in payload) {
    return String((payload as { entityId: unknown }).entityId);
  }
  return undefined;
}

export default function AuditPage() {
  const { t, lang } = useT();
  const recs = useRecords();

  const entries = useMemo(() => auditLog(recs), [recs]);
  const users = useMemo(() => listUsers(recs), [recs]);
  const userName = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.entityId, u.name);
    return m;
  }, [users]);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.type);
    return [...set].sort();
  }, [entries]);

  const [typeF, setTypeF] = useState<string>('all');
  const [userF, setUserF] = useState<string>('all');

  const filtered = useMemo(
    () => entries.filter((e) => (typeF === 'all' || e.type === typeF) && (userF === 'all' || e.by === userF)),
    [entries, typeF, userF],
  );

  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const selectedRec: Rec | undefined = useMemo(
    () => (selected ? recs.find((r) => r.id === selected.recId) : undefined),
    [selected, recs],
  );
  const prevRec: Rec | undefined = useMemo(() => {
    if (!selectedRec || !MASTER_TYPES.has(selectedRec.type)) return undefined;
    const eid = entityIdOf(selectedRec.payload);
    if (!eid) return undefined;
    // previous version = latest same-type, same entityId with earlier `at`.
    let best: Rec | undefined;
    for (const r of recs) {
      if (r.type !== selectedRec.type || r.id === selectedRec.id) continue;
      if (entityIdOf(r.payload) !== eid) continue;
      if (r.at < selectedRec.at && (!best || r.at > best.at)) best = r;
    }
    return best;
  }, [selectedRec, recs]);

  const typeLabel = (type: string) => {
    const key = `rec.type.${type}`;
    const label = t(key);
    return label !== key ? label : type;
  };

  const byName = (by: string) => userName.get(by) ?? (by.startsWith('weaver:') ? t('slip.weaver') : by.slice(0, 8));

  return (
    <section>
      <PageHeader title={t('audit.title')} back />
      <p className="mb-4 text-base text-muted">{t('audit.hint')}</p>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:max-w-xl">
        <Field label={t('audit.filterType')} className="mb-0">
          {({ id }) => (
            <Select id={id} value={typeF} onChange={(e) => setTypeF(e.target.value)}>
              <option value="all">{t('audit.allTypes')}</option>
              {types.map((ty) => (
                <option key={ty} value={ty}>{typeLabel(ty)}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('audit.filterUser')} className="mb-0">
          {({ id }) => (
            <Select id={id} value={userF} onChange={(e) => setUserF(e.target.value)}>
              <option value="all">{t('audit.allUsers')}</option>
              {users.map((u) => (
                <option key={u.entityId} value={u.entityId}>{u.name}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<History size={40} />} title={t('audit.empty')} />
      ) : (
        <ResponsiveTable
          rows={filtered}
          rowKey={(e) => e.recId}
          testid="audit-table"
          onRowClick={(e) => setSelected(e)}
          renderCard={(e) => (
            <button
              type="button"
              data-testid="audit-row"
              onClick={() => setSelected(e)}
              className="w-full rounded-2xl border border-line bg-surface p-3 text-left shadow-card focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-base font-medium text-ink">{typeLabel(e.type)}</span>
                {e.reversed && <Pill tone="warn">{t('audit.reversed')}</Pill>}
                {e.rejected && <Pill tone="danger">{t('audit.rejected')}</Pill>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1">
                  <UserIcon aria-hidden="true" size={14} />
                  {byName(e.by)} · {t(`role.${e.role}`) !== `role.${e.role}` ? t(`role.${e.role}`) : e.role}
                </span>
                <span className="num">{fmtStamp(e.at, lang)}</span>
              </div>
            </button>
          )}
          columns={[
            { key: 'when', header: t('col.audit.when'), cell: (e) => <span className="num whitespace-nowrap text-muted">{fmtStamp(e.at, lang)}</span> },
            { key: 'who', header: t('col.audit.who'), cell: (e) => <span className="text-ink">{byName(e.by)}</span> },
            { key: 'role', header: t('col.audit.role'), cell: (e) => <span className="text-muted">{t(`role.${e.role}`) !== `role.${e.role}` ? t(`role.${e.role}`) : e.role}</span> },
            { key: 'device', header: t('col.audit.device'), cell: (e) => <span className="num text-muted">{e.device.slice(0, 8)}</span> },
            { key: 'type', header: t('col.audit.type'), cell: (e) => <span className="font-medium text-ink">{typeLabel(e.type)}</span> },
            {
              key: 'summary',
              header: t('col.audit.summary'),
              cell: (e) => <span className="text-muted">{e.reversalReason ?? e.rejectReason ?? '—'}</span>,
            },
            {
              key: 'flags',
              header: t('col.audit.flags'),
              align: 'right',
              cell: (e) => (
                <span className="inline-flex gap-1">
                  {e.reversed && <Pill tone="warn">{t('audit.reversed')}</Pill>}
                  {e.rejected && <Pill tone="danger">{t('audit.rejected')}</Pill>}
                </span>
              ),
            },
          ]}
        />
      )}

      {/* Detail sheet */}
      <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={t('audit.detailTitle')}>
        {selected && selectedRec && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">{typeLabel(selected.type)}</Badge>
              {selected.reversed && <Badge tone="warn">{t('audit.reversed')}</Badge>}
              {selected.rejected && <Badge tone="danger">{t('audit.rejected')}</Badge>}
              {selectedRec.sync === 'pending' && <Badge tone="neutral">{t('audit.pending')}</Badge>}
              {selectedRec.sync === 'synced' && <Badge tone="received">{t('audit.synced')}</Badge>}
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
              <dt className="text-muted">{t('audit.filterUser')}</dt>
              <dd className="text-ink">{byName(selected.by)}</dd>
              <dt className="text-muted">{t('audit.device')}</dt>
              <dd className="num text-ink">{selectedRec.device.slice(0, 8)}</dd>
              <dt className="text-muted">{fmtStamp(selected.at, lang)}</dt>
              <dd className="text-ink">{formatDay(selected.day, lang, 'medium')}</dd>
            </dl>

            {selected.reversalReason && (
              <p className="rounded-xl bg-saffron/15 p-3 text-sm text-saffron-ink">
                {t('audit.reversalReason')}: {selected.reversalReason}
              </p>
            )}
            {selected.rejectReason && (
              <p className="rounded-xl bg-madder/10 p-3 text-sm text-madder">
                {t('audit.rejectReason')}: {selected.rejectReason}
              </p>
            )}

            <div>
              <h3 className="mb-1 text-base font-medium text-ink">{t('audit.payload')}</h3>
              <pre className="overflow-x-auto rounded-xl border border-line bg-bg p-3 text-sm text-ink">
                {JSON.stringify(selectedRec.payload, null, 2)}
              </pre>
            </div>

            {MASTER_TYPES.has(selectedRec.type) && (
              <div>
                <h3 className="mb-1 text-base font-medium text-ink">{t('audit.prevVersion')}</h3>
                {prevRec ? (
                  <pre className="overflow-x-auto rounded-xl border border-line bg-bg p-3 text-sm text-muted">
                    {JSON.stringify(prevRec.payload, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-muted">{t('audit.noPrev')}</p>
                )}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </section>
  );
}
