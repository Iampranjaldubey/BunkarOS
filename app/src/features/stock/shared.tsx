import type { ItemP } from '../../db/types';
import { formatQty } from '../../domain/qty';
import { useT } from '../../i18n';

/** "12.250 किलो" with the unit label translated. */
export function Qty({ q, item, className }: { q: number; item: ItemP; className?: string }) {
  const { t } = useT();
  return <span className={`num ${className ?? ''}`}>{formatQty(q, item.unit)} <span className="text-sm font-normal text-muted">{t(`stock.unit.${item.unit}`)}</span></span>;
}
