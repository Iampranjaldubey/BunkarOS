import type { Lang, Rec } from '../../db/types';
import type { nameMaps } from '../../domain/masters';
import { formatINR } from '../../domain/money';
import { formatQty } from '../../domain/qty';
import { formatMonth } from '../../domain/dates';

type Names = ReturnType<typeof nameMaps>;
type T = (key: string, vars?: Record<string, string | number>) => string;
export type Tone = 'neutral' | 'given' | 'received' | 'info' | 'warn';

/** One human line per record for the entry log. */
export function describeRecord(r: Rec, n: Names, t: T, lang: Lang): { text: string; tone: Tone } {
  const p = r.payload as Record<string, unknown>;
  const worker = () => n.workers.get(String(p.workerId)) ?? '?';
  const item = () => n.items.get(String(p.itemId));
  const qty = (v: unknown) => { const it = item(); return it ? `${formatQty(Number(v), it.unit)} ${it.unit}` : String(v); };
  const order = () => n.orders.get(String(p.orderId))?.orderNo ?? '?';
  switch (r.type) {
    case 'user': return { text: `${p.name} · ${t('role.' + p.role)}${p.active === false ? ` · ${t('common.inactive')}` : ''}`, tone: 'neutral' };
    case 'setting': return { text: `${p.unitName} · ${t('settings.workingDays')}: ${p.workingDaysPerMonth}`, tone: 'neutral' };
    case 'worker': return { text: `${p.name} · ${t('worker.payType.' + p.payType)}${p.active === false ? ` · ${t('common.inactive')}` : ''}`, tone: 'neutral' };
    case 'item': return { text: `${p.name} (${p.unit})`, tone: 'neutral' };
    case 'buyer': return { text: String(p.name), tone: 'neutral' };
    case 'order': return { text: `${p.orderNo} · ${p.design} ${p.size} × ${p.qty}`, tone: 'info' };
    case 'attendance': return { text: `${worker()} · ${t('att.' + p.status)}${Number(p.otHours) > 0 ? ` · OT ${p.otHours}h` : ''}`, tone: 'info' };
    case 'piece_entry': return { text: `${worker()} · ${p.count} × ${formatINR(Number(p.pieceRatePaise))}`, tone: 'info' };
    case 'advance': return { text: `${worker()} · ${formatINR(Number(p.amountPaise))} · ${t('common.' + p.mode)}`, tone: 'given' };
    case 'wage_payment': return { text: `${worker()} · ${formatMonth(String(p.month), lang)} · ${formatINR(Number(p.paidPaise))}`, tone: 'given' };
    case 'period_lock': return { text: formatMonth(String(p.month), lang), tone: 'warn' };
    case 'stock_in': return { text: `${item()?.name ?? '?'} +${qty(p.qty)}${p.supplier ? ` · ${p.supplier}` : ''}`, tone: 'received' };
    case 'stock_out': return { text: `${item()?.name ?? '?'} −${qty(p.qty)} · ${t('stock.purpose.' + p.purpose)}`, tone: 'given' };
    case 'stock_adjust': return { text: `${item()?.name ?? '?'} ${Number(p.qtyDelta) >= 0 ? '+' : ''}${qty(p.qtyDelta)} · ${t('stock.reason.' + p.reason)}`, tone: 'warn' };
    case 'finished_in': return { text: `${item()?.name ?? '?'} +${qty(p.qty)}`, tone: 'received' };
    case 'order_status': return { text: `${order()} → ${t('order.status.' + p.status)}`, tone: 'info' };
    case 'delivery': return { text: `${order()} · ${p.qty} ${t('order.delivered')}`, tone: 'received' };
    case 'order_note': return { text: `${order()} · ${p.text}`, tone: 'neutral' };
    default: return { text: r.type, tone: 'neutral' };
  }
}
