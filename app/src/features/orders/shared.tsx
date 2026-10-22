import { Badge } from '../../components/ui/Badge';
import type { OrderView } from '../../domain/orders';
import { useT } from '../../i18n';

const TONE = { new: 'neutral', in_production: 'info', finished: 'warn', delivered: 'received' } as const;

export function StatusBadge({ v }: { v: OrderView }) {
  const { t } = useT();
  return <Badge tone={TONE[v.status]}>{t(`order.status.${v.status}`)}</Badge>;
}
/** Due line: "समय निकल गया · 3 दिन लेट" / "5 दिन बाकी" / "in 20 days". */
export function DueLine({ v }: { v: OrderView }) {
  const { t } = useT();
  if (v.status === 'delivered') return null;
  if (v.overdue) return <span className="text-sm font-medium text-given">{t('order.overdue')} · {t('order.lateBy', { n: -v.daysToDue })}</span>;
  if (v.dueSoon) return <span className="text-sm font-medium text-accent-ink">{t('order.dueSoon', { n: v.daysToDue })}</span>;
  return <span className="text-sm text-muted">{t('order.dueIn', { n: v.daysToDue })}</span>;
}
