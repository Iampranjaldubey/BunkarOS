// Server-authoritative record validation. Returns {ok:true} or {ok:false, reason}.
const TYPES = new Set(['user','setting','worker','item','buyer','order','attendance','piece_entry','advance','wage_payment','period_lock',
  'stock_in','stock_out','stock_adjust','finished_in','order_status','delivery','order_note','usage','reversal']);
const OWNER_ONLY_TYPES = new Set(['setting', 'user', 'period_lock']);
const MONEY_TYPES = new Set(['attendance', 'piece_entry', 'advance', 'wage_payment', 'stock_in', 'stock_out', 'stock_adjust', 'finished_in', 'delivery']);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isInt = (n) => Number.isInteger(n);
const nonNeg = (n) => isInt(n) && n >= 0;
const pos = (n) => isInt(n) && n > 0;

/**
 * @param ctx {{ unitId, auth: {userId, role}|null, hasUsers: boolean, locked: Set<string>, paid: Set<string>, batch: {ids:Set, paid:Set} }}
 */
export function evaluate(rec, ctx) {
  if (!rec || typeof rec !== 'object') return bad('invalid_record');
  if (typeof rec.id !== 'string' || rec.id.length < 8 || rec.id.length > 64) return bad('invalid_id');
  if (!TYPES.has(rec.type)) return bad('invalid_type');
  if (rec.unitId !== ctx.unitId) return bad('wrong_unit');
  if (!rec.payload || typeof rec.payload !== 'object') return bad('invalid_payload');
  if (typeof rec.at !== 'string' || Number.isNaN(Date.parse(rec.at))) return bad('invalid_at');
  if (typeof rec.day !== 'string' || !DAY_RE.test(rec.day)) return bad('invalid_day');
  if (ctx.batch.ids.has(rec.id)) return bad('duplicate_in_batch');

  // Author identity: once the unit has users, the token's identity is authoritative.
  if (ctx.hasUsers) {
    if (!ctx.auth) return bad('needs_login');
    if (rec.by !== ctx.auth.userId) return bad('forged_author');
    if (OWNER_ONLY_TYPES.has(rec.type) && ctx.auth.role !== 'owner') return bad('forbidden_role');
    if (rec.type === 'reversal' && ctx.auth.role !== 'owner') {
      // staff may only reverse their own records from the same day — checked by the handler via ctx.lookup
      const target = ctx.targets?.get(rec.payload.targetId);
      if (!target) return bad('unknown_target');
      if (target.by !== ctx.auth.userId || target.day !== rec.day) return bad('forbidden_reversal');
    }
    if (rec.type === 'worker' && ctx.auth.role !== 'owner') {
      // staff may add/edit workers but not change pay numbers
      const prev = ctx.prevWorker?.(rec.payload.entityId);
      if (prev) {
        for (const k of ['payType', 'salaryPaise', 'dailyRatePaise', 'pieceRatePaise', 'otRatePaise']) if (prev[k] !== rec.payload[k]) return bad('forbidden_rate_change');
      }
    }
  } else if (rec.type !== 'setting' && rec.type !== 'user') {
    return bad('bootstrap_only');
  }

  // Locked months: any money/attendance record dated inside a locked month is refused.
  if (MONEY_TYPES.has(rec.type) && ctx.locked.has(rec.day.slice(0, 7))) return bad('period_locked');
  if (rec.type === 'wage_payment' && ctx.locked.has(rec.payload.month)) return bad('period_locked');

  const p = rec.payload;
  switch (rec.type) {
    case 'attendance':
      if (!['present', 'half', 'absent'].includes(p.status)) return bad('invalid_status');
      if (typeof p.otHours !== 'number' || p.otHours < 0 || p.otHours > 16 || Math.round(p.otHours * 2) !== p.otHours * 2) return bad('invalid_ot');
      break;
    case 'piece_entry': if (!pos(p.count) || !nonNeg(p.pieceRatePaise)) return bad('invalid_amounts'); break;
    case 'advance': if (!pos(p.amountPaise) || !['cash', 'upi'].includes(p.mode)) return bad('invalid_amounts'); break;
    case 'wage_payment': {
      if (!/^\d{4}-\d{2}$/.test(p.month)) return bad('invalid_month');
      for (const k of ['grossPaise', 'otPaise', 'advanceRecoveredPaise', 'paidPaise']) if (!nonNeg(p[k])) return bad('invalid_amounts');
      if (!isInt(p.netPaise) || !isInt(p.roundingPaise)) return bad('invalid_amounts');
      const ded = Array.isArray(p.deductions) ? p.deductions.reduce((s, d) => s + (nonNeg(d.amountPaise) ? d.amountPaise : NaN), 0) : NaN;
      if (!Number.isFinite(ded)) return bad('invalid_amounts');
      if (p.grossPaise + p.otPaise - ded - p.advanceRecoveredPaise !== p.netPaise) return bad('invalid_amounts');
      if (p.netPaise + p.roundingPaise !== p.paidPaise) return bad('invalid_amounts');
      const key = `${p.workerId}|${p.month}`;
      if (ctx.paid.has(key) || ctx.batch.paid.has(key)) return bad('duplicate_payment');
      ctx.batch.paid.add(key);
      break;
    }
    case 'period_lock': if (!/^\d{4}-\d{2}$/.test(p.month)) return bad('invalid_month'); break;
    case 'stock_in': case 'stock_out': case 'finished_in': if (!pos(p.qty)) return bad('invalid_qty'); break;
    case 'stock_adjust': if (!isInt(p.qtyDelta) || p.qtyDelta === 0 || typeof p.note !== 'string') return bad('invalid_qty'); break;
    case 'delivery': if (!pos(p.qty)) return bad('invalid_qty'); break;
    case 'order': if (!pos(p.qty) || typeof p.orderNo !== 'string') return bad('invalid_order'); break;
    case 'reversal': if (typeof p.targetId !== 'string') return bad('invalid_reversal'); break;
    default: break;
  }
  return { ok: true };
}
const bad = (reason) => ({ ok: false, reason });
