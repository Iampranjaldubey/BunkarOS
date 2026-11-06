import { Badge } from '../../components/ui/Badge';
import { WovenProgress } from '../../components/ui/Motion';
import type { OrderView } from '../../domain/orders';
import { useT } from '../../i18n';

const TONE = { new: 'neutral', in_production: 'info', finished: 'warn', delivered: 'received' } as const;

/** Order status as a quiet tag (SPEC-M17): the stages of New → In production → Finished → Delivered. */
export function StatusBadge({ v }: { v: OrderView }) {
  const { t } = useT();
  return <Badge tone={TONE[v.status]}>{t(`order.status.${v.status}`)}</Badge>;
}

/** Delivered of ordered as woven rows (SPEC-M17). */
export function OrderProgress({ v, className }: { v: OrderView; className?: string }) {
  const { t } = useT();
  return <WovenProgress done={v.deliveredQty} total={v.order.qty} tone={v.overdue ? 'given' : v.status === 'delivered' ? 'received' : 'primary'} label={t('m17.delivered', { done: v.deliveredQty, total: v.order.qty })} className={className} />;
}
/** Due line: "समय निकल गया · 3 दिन लेट" / "5 दिन बाकी" / "in 20 days". */
export function DueLine({ v }: { v: OrderView }) {
  const { t } = useT();
  if (v.status === 'delivered') return null;
  if (v.overdue) return <span className="text-sm font-medium text-given">{t('order.overdue')} · {t('order.lateBy', { n: -v.daysToDue })}</span>;
  if (v.dueSoon) return <span className="text-sm font-medium text-accent-ink">{t('order.dueSoon', { n: v.daysToDue })}</span>;
  return <span className="text-sm text-muted">{t('order.dueIn', { n: v.daysToDue })}</span>;
}
