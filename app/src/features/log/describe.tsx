import type { CarpetP, Lang, Rec, SettingP, WagePaymentP } from '../../db/types';
import { sizeLabel } from '../../domain/catalogue';
import { SHOWN_OPERATOR_TOGGLES, SLIP_SECTIONS, unitRules } from '../../domain/settings';
import type { nameMaps } from '../../domain/masters';
import { formatINR } from '../../domain/money';
import { formatQty } from '../../domain/qty';
import { formatMonth } from '../../domain/dates';

type Names = ReturnType<typeof nameMaps>;
type T = (key: string, vars?: Record<string, string | number>) => string;
export type Tone = 'neutral' | 'given' | 'received' | 'info' | 'warn';

/** SPEC-M13 AC10 / M02 AC9: what a setting version changed in the unit rules, compared with the version before it. */
function settingChanges(r: Rec, t: T, byId?: Map<string, Rec>): string[] {
  if (!byId) return [];
  let prev: Rec | undefined;
  for (const x of byId.values()) if (x.type === 'setting' && x.id !== r.id && x.at <= r.at && (!prev || x.at > prev.at)) prev = x;
  if (!prev) return [];
  const a = unitRules(prev.payload as SettingP); const b = unitRules(r.payload as SettingP);
  const onOff = (v: boolean) => (v ? t('settings.on') : t('settings.off'));
  const out: string[] = [];
  if (a.overtimeEnabled !== b.overtimeEnabled) out.push(`${t('settings.overtime')}: ${onOff(b.overtimeEnabled)}`);
  if (a.offDayPolicy !== b.offDayPolicy) out.push(`${t('settings.offDayPolicy')}: ${t(`settings.policy.${b.offDayPolicy}`)}`);
  const slip = SLIP_SECTIONS.filter((k) => a.slip[k] !== b.slip[k]).map((k) => `${b.slip[k] ? '+' : '−'}${t(`slip.opt.${k}`)}`);
  if (slip.length) out.push(`${t('settings.slipSections')}: ${slip.join(', ')}`);
  for (const k of SHOWN_OPERATOR_TOGGLES) if (a.operatorPerms[k] !== b.operatorPerms[k]) out.push(`${t(`settings.perm.${k}`)}: ${onOff(b.operatorPerms[k])}`);
  return out;
}

const money = (v: number) => `${v < 0 ? '−' : ''}${formatINR(Math.abs(v), { paise: v % 100 !== 0 })}`;

/** One human line per record for the entry log. `byId` lets a reversal describe what it undid (SPEC-M14 steps). */
export function describeRecord(r: Rec, n: Names, t: T, lang: Lang, byId?: Map<string, Rec>): { text: string; tone: Tone } {
  const p = r.payload as Record<string, unknown>;
  const worker = () => n.workers.get(String(p.workerId)) ?? '?';
  const item = () => n.items.get(String(p.itemId));
  const qty = (v: unknown) => { const it = item(); return it ? `${formatQty(Number(v), it.unit)} ${it.unit}` : String(v); };
  const order = () => n.orders.get(String(p.orderId))?.orderNo ?? '?';
  const carpet = () => { const c = n.carpets.get(String(p.carpetId)); return c ? `${c.design}${c.tag ? ` · ${c.tag}` : ''}` : '?'; };
  switch (r.type) {
    case 'user': return { text: `${p.name} · ${t('role.' + p.role)}${p.active === false ? ` · ${t('common.inactive')}` : ''}`, tone: 'neutral' };
    case 'setting': return { text: [`${p.unitName} · ${t('settings.workingDays')}: ${p.workingDaysPerMonth}`, ...settingChanges(r, t, byId)].join(' · '), tone: 'neutral' };
    case 'worker': return { text: `${p.name} · ${t('worker.payType.' + p.payType)}${p.active === false ? ` · ${t('common.inactive')}` : ''}`, tone: 'neutral' };
    case 'item': return { text: `${p.name} (${p.unit})`, tone: 'neutral' };
    case 'buyer': return { text: String(p.name), tone: 'neutral' };
    case 'order': return { text: `${p.orderNo} · ${p.design} ${p.size} × ${p.qty}`, tone: 'info' };
    case 'attendance': return { text: `${worker()} · ${t('att.' + p.status)}${Number(p.otHours) > 0 ? ` · OT ${p.otHours}h` : ''}`, tone: 'info' };
    case 'piece_entry': return { text: `${worker()} · ${p.count} × ${formatINR(Number(p.pieceRatePaise))}`, tone: 'info' };
    case 'advance': return { text: `${worker()} · ${formatINR(Number(p.amountPaise))} · ${t('common.' + p.mode)}`, tone: 'given' };
    case 'wage_payment': {
      const pay = p as unknown as WagePaymentP;
      const parts = [`${worker()} · ${formatMonth(String(pay.month), lang)} · ${formatINR(Number(pay.paidPaise))}`];
      for (const o of pay.overrides ?? []) {
        const sign = ['absent_deduct', 'half_deduct', 'advance_recovered'].includes(o.line) ? -1 : 1;
        parts.push(t('log.override', { line: t(`wages.line.${o.line}`), from: money(sign * o.computedPaise), to: money(sign * o.finalPaise), reason: o.reason }));
      }
      if (pay.correctionReason) parts.push(t('log.correction', { reason: pay.correctionReason }));
      return { text: parts.join(' · '), tone: 'given' };
    }
    case 'period_lock': return { text: `${formatMonth(String(p.month), lang)}${p.reason ? ` · ${t('log.lockReason', { reason: String(p.reason) })}` : ''}`, tone: 'warn' };
    case 'reversal': {
      const target = byId?.get(String(p.targetId));
      const why = t('log.reasonShort', { reason: String(p.reason ?? '') });
      if (target?.type === 'period_lock') return { text: `${t('log.unlocked', { month: formatMonth(String((target.payload as { month: string }).month), lang) })} · ${why}`, tone: 'warn' };
      if (target?.type === 'wage_payment') {
        const tp = target.payload as WagePaymentP;
        return { text: `${t('log.payReversed', { name: n.workers.get(tp.workerId) ?? '?', month: formatMonth(tp.month, lang) })} · ${why}`, tone: 'warn' };
      }
      if (target?.type === 'carpet_reserve' || target?.type === 'carpet_out') {
        const tp = target.payload as { carpetId: string; qty: number; kind?: string; orderId?: string };
        const c = n.carpets.get(tp.carpetId);
        const what = c ? `${c.design}${c.tag ? ` · ${c.tag}` : ''}` : '?';
        const key = target.type === 'carpet_reserve' ? 'cat.log.released' : 'cat.log.undone';
        return { text: `${t(key, { carpet: what, n: tp.qty, order: n.orders.get(String(tp.orderId))?.orderNo ?? '', what: t(`cat.ev.${tp.kind}`, { n: tp.qty }) })} · ${why}`, tone: 'warn' };
      }
      return { text: why, tone: 'neutral' };
    }
    case 'stock_in': return { text: `${item()?.name ?? '?'} +${qty(p.qty)}${p.supplier ? ` · ${p.supplier}` : ''}`, tone: 'received' };
    case 'stock_out': return { text: `${item()?.name ?? '?'} −${qty(p.qty)} · ${t('stock.purpose.' + p.purpose)}`, tone: 'given' };
    case 'stock_adjust': return { text: `${item()?.name ?? '?'} ${Number(p.qtyDelta) >= 0 ? '+' : ''}${qty(p.qtyDelta)} · ${t('stock.reason.' + p.reason)}`, tone: 'warn' };
    case 'finished_in': return { text: `${item()?.name ?? '?'} +${qty(p.qty)}`, tone: 'received' };
    case 'order_status': return { text: `${order()} → ${t('order.status.' + p.status)}`, tone: 'info' };
    case 'delivery': return { text: `${order()} · ${p.qty} ${t('order.delivered')}${p.carpetId ? ` · ${carpet()}` : ''}${p.note ? ` · ${p.note}` : ''}`, tone: 'received' };
    // SPEC-M15 catalogue
    case 'carpet': {
      const c = p as unknown as CarpetP;
      return { text: `${c.design} · ${sizeLabel(c)}${c.tag ? ` · ${c.tag}` : ''}${c.active === false ? ` · ${t('common.inactive')}` : ''}`, tone: 'neutral' };
    }
    case 'carpet_in': return { text: `${carpet()} · ${t('cat.ev.in', { n: Number(p.qty) })}`, tone: 'received' };
    case 'carpet_reserve': return { text: `${carpet()} · ${t('cat.ev.reserve', { n: Number(p.qty), order: order() })}`, tone: 'info' };
    case 'carpet_out': return { text: `${carpet()} · ${t(`cat.ev.${p.kind}`, { n: Number(p.qty) })} · ${p.note}`, tone: 'given' };
    case 'order_note': return { text: `${order()} · ${p.text}`, tone: 'neutral' };
    default: return { text: r.type, tone: 'neutral' };
  }
}
