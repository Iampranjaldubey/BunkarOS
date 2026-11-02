// Server-authoritative record validation. Returns {ok:true} or {ok:false, reason}.
const TYPES = new Set(['user','setting','worker','item','buyer','order','attendance','piece_entry','advance','wage_payment','period_lock',
  'stock_in','stock_out','stock_adjust','finished_in','order_status','delivery','order_note','usage','reversal',
  'carpet','carpet_in','carpet_reserve','carpet_out']); // SPEC-M15 catalogue
const OWNER_ONLY_TYPES = new Set(['setting', 'user', 'period_lock']);
const MONEY_TYPES = new Set(['attendance', 'piece_entry', 'advance', 'wage_payment', 'stock_in', 'stock_out', 'stock_adjust', 'finished_in', 'delivery',
  'carpet_in', 'carpet_reserve', 'carpet_out']); // SPEC-M15: locked months refuse catalogue movements dated inside them
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROUNDING_PAISE = 50; // paid = net rounded to ₹1 half-up → |rounding| ≤ 50 paise
// SPEC-M13 unit rules
const OFF_DAY_POLICIES = new Set(['none', 'sundays', 'sundays_and_holidays']);
const SLIP_SECTIONS = new Set(['businessName', 'workerName', 'month', 'gross', 'advance', 'deductions', 'net', 'signature',
  'attendance', 'offDays', 'pieces', 'overtime', 'rate', 'ownerChanges', 'advanceBalance', 'payment']);
const PERM_KEYS = new Set(['addEntries', 'editPast', 'seeWages', 'seePrices', 'export']);
export const DEFAULT_PERMS = { addEntries: true, editPast: false, seeWages: true, seePrices: true, export: false };
/** The unit's operator toggles from its latest setting, with defaults for missing fields (D-005). */
export function operatorPerms(setting) {
  const out = { ...DEFAULT_PERMS };
  for (const k of PERM_KEYS) if (typeof setting?.operatorPerms?.[k] === 'boolean') out[k] = setting.operatorPerms[k];
  out.seeWages = true; // stage 1: no wage redaction yet, operators see wages (SPEC-M13 stage 2)
  return out;
}
// SPEC-M14 overridable wage lines
const OVERRIDE_LINES = new Set(['base', 'absent_deduct', 'half_deduct', 'days', 'off_days', 'pieces', 'overtime', 'advance_recovered', 'rounding']);
/** Record types a reversal by an operator may never target: owner-only records (an unlock is the owner's). */
const OWNER_ONLY_TARGETS = new Set(['setting', 'user', 'period_lock']);
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function settingProblem(p) {
  if (p.workingDaysPerMonth !== undefined && !(isInt(p.workingDaysPerMonth) && p.workingDaysPerMonth >= 1 && p.workingDaysPerMonth <= 31)) return true;
  if (p.holidays !== undefined && !(Array.isArray(p.holidays) && p.holidays.every((d) => typeof d === 'string' && DAY_RE.test(d)))) return true;
  if (p.overtimeEnabled !== undefined && typeof p.overtimeEnabled !== 'boolean') return true;
  if (p.offDayPolicy !== undefined && !OFF_DAY_POLICIES.has(p.offDayPolicy)) return true;
  if (p.slipSections !== undefined && !(isObj(p.slipSections) && Object.entries(p.slipSections).every(([k, v]) => SLIP_SECTIONS.has(k) && typeof v === 'boolean'))) return true;
  if (p.operatorPerms !== undefined && !(isObj(p.operatorPerms) && Object.entries(p.operatorPerms).every(([k, v]) => PERM_KEYS.has(k) && typeof v === 'boolean'))) return true;
  return false;
}
const isInt = (n) => Number.isInteger(n);
const nonNeg = (n) => isInt(n) && n >= 0;
const pos = (n) => isInt(n) && n > 0;

/** Month a record belongs to for locking: its business day, or the paid month for a wage payment. */
export function lockMonthsOf(rec) {
  const out = [];
  if (typeof rec?.day === 'string' && DAY_RE.test(rec.day)) out.push(rec.day.slice(0, 7));
  if (rec?.type === 'wage_payment' && typeof rec.payload?.month === 'string') out.push(rec.payload.month);
  return out;
}

/**
 * Stock movement of a record on one item (thousandths), or null if it does not move stock.
 * Deliveries count in whole carpets (pcs × 1000) and only when taken from a finished item.
 */
export function stockMove(rec) {
  const p = rec?.payload;
  if (!p) return null;
  switch (rec.type) {
    case 'stock_in': case 'finished_in': return isInt(p.qty) ? { itemId: p.itemId, delta: p.qty } : null;
    case 'stock_out': return isInt(p.qty) ? { itemId: p.itemId, delta: -p.qty } : null;
    case 'stock_adjust': return isInt(p.qtyDelta) ? { itemId: p.itemId, delta: p.qtyDelta } : null;
    case 'delivery': return typeof p.finishedItemId === 'string' && p.finishedItemId && isInt(p.qty) ? { itemId: p.finishedItemId, delta: -p.qty * 1000 } : null;
    default: return null;
  }
}

/**
 * @param ctx {{ unitId, auth: {userId, role}|null, hasUsers: boolean, locked: Set<string>, paid: Set<string>,
 *   batch: {ids:Set, paid:Set}, targets?: Map, prevWorker?: Function, serverDay: string, stock?: Map<string, number> }}
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
    // SPEC-M13: "add entries" off → an operator can look but not write anything.
    if (ctx.auth.role !== 'owner' && ctx.perms && ctx.perms.addEntries === false) return bad('forbidden_permission');
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
    case 'setting': if (settingProblem(p)) return bad('invalid_setting'); break;
    case 'attendance':
      if (!['present', 'half', 'absent'].includes(p.status)) return bad('invalid_status');
      if (typeof p.otHours !== 'number' || p.otHours < 0 || p.otHours > 16 || Math.round(p.otHours * 2) !== p.otHours * 2) return bad('invalid_ot');
      break;
    case 'piece_entry': if (!pos(p.count) || !nonNeg(p.pieceRatePaise)) return bad('invalid_amounts'); break;
    case 'advance': if (!pos(p.amountPaise) || !['cash', 'upi'].includes(p.mode)) return bad('invalid_amounts'); break;
    case 'wage_payment': {
      if (!/^\d{4}-\d{2}$/.test(p.month)) return bad('invalid_month');
      if (!isInt(p.netPaise) || !isInt(p.roundingPaise) || !isInt(p.paidPaise)) return bad('invalid_amounts');
      // SPEC-M16 §3: never store a negative net or a negative payout; rounding is at most 50 paise.
      if (p.netPaise < 0) return bad('negative_net');
      if (Math.abs(p.roundingPaise) > MAX_ROUNDING_PAISE) return bad('invalid_rounding');
      if (p.paidPaise < 0) return bad('negative_paid');
      for (const k of ['grossPaise', 'otPaise', 'advanceRecoveredPaise']) if (!nonNeg(p[k])) return bad('invalid_amounts');
      const ded = Array.isArray(p.deductions) ? p.deductions.reduce((s, d) => s + (nonNeg(d?.amountPaise) ? d.amountPaise : NaN), 0) : NaN;
      if (!Number.isFinite(ded)) return bad('invalid_amounts');
      if (p.grossPaise + p.otPaise - ded - p.advanceRecoveredPaise !== p.netPaise) return bad('invalid_amounts');
      if (p.netPaise + p.roundingPaise !== p.paidPaise) return bad('invalid_amounts');
      // SPEC-M14: overrides are the owner's, each with a known line and a reason.
      if (p.overrides !== undefined) {
        if (!Array.isArray(p.overrides)) return bad('invalid_override');
        if (p.overrides.length && ctx.hasUsers && ctx.auth?.role !== 'owner') return bad('forbidden_override');
        const seen = new Set();
        for (const o of p.overrides) {
          if (!isObj(o) || !OVERRIDE_LINES.has(o.line) || seen.has(o.line) || !isInt(o.computedPaise) || !isInt(o.finalPaise) || !nonEmpty(o.reason)) return bad('invalid_override');
          if (o.line !== 'rounding' && o.finalPaise < 0) return bad('invalid_override');
          seen.add(o.line);
        }
      }
      const key = `${p.workerId}|${p.month}`;
      if (ctx.paid.has(key) || ctx.batch.paid.has(key)) return bad('duplicate_payment');
      // SPEC-M14: paying again after a reversed payment is a correction and needs its reason.
      if (ctx.reversedPaid?.has(key) && !nonEmpty(p.correctionReason)) return bad('reason_required');
      ctx.batch.paid.add(key);
      break;
    }
    case 'period_lock':
      if (!/^\d{4}-\d{2}$/.test(p.month)) return bad('invalid_month');
      if (ctx.relocked?.has(p.month) && !nonEmpty(p.reason)) return bad('reason_required'); // re-lock after a correction
      break;
    case 'stock_in': case 'stock_out': case 'finished_in': if (!pos(p.qty)) return bad('invalid_qty'); break;
    case 'stock_adjust': if (!isInt(p.qtyDelta) || p.qtyDelta === 0 || typeof p.note !== 'string') return bad('invalid_qty'); break;
    case 'delivery':
      if (!pos(p.qty)) return bad('invalid_qty');
      if (p.carpetId !== undefined && p.finishedItemId) return bad('invalid_delivery'); // one source: a catalogue carpet or a legacy item (SPEC-M15)
      break;
    case 'order': if (!pos(p.qty) || typeof p.orderNo !== 'string') return bad('invalid_order'); break;
    case 'reversal': {
      if (typeof p.targetId !== 'string') return bad('invalid_reversal');
      if (!nonEmpty(p.reason)) return bad('reason_required'); // every correction is logged with a reason (SPEC-M14)
      const target = ctx.targets?.get(p.targetId);
      if (ctx.hasUsers && !target) return bad('unknown_target');
      if (target) {
        // SPEC-M16 §2: nobody (not even the owner) can change a locked month by reversing an entry in it.
        // The lock's own reversal (= unlock) is the way in.
        if (target.type !== 'period_lock' && lockMonthsOf(target).some((m) => ctx.locked.has(m))) return bad('period_locked');
        if (ctx.hasUsers && ctx.auth.role !== 'owner') {
          if (OWNER_ONLY_TARGETS.has(target.type)) return bad('forbidden_reversal');
          // SPEC-M16 §5: own entries from today ("today" = the server's IST date) …
          const ownToday = target.by === ctx.auth.userId && target.day === ctx.serverDay;
          // … or, with "edit past entries" on, anyone's entry from an earlier day of an unlocked month (SPEC-M13).
          const pastAllowed = ctx.perms?.editPast === true && target.day < ctx.serverDay;
          if (!ownToday && !pastAllowed) return bad('forbidden_reversal');
        }
      }
      break;
    }
    default: break;
  }

  // SPEC-M16 §4: the server keeps the item balance; nothing may take it below zero
  // unless the owner explicitly says so, with a reason.
  const move = ctx.stock ? stockMove(rec) : null;
  if (move && move.delta < 0 && typeof move.itemId === 'string') {
    const after = (ctx.stock.get(move.itemId) ?? 0) + move.delta;
    if (after < 0) {
      const override = ctx.auth?.role === 'owner' && p.allowNegative === true && typeof p.overrideReason === 'string' && p.overrideReason.trim().length > 0;
      if (!override) return bad('insufficient_stock');
    }
  }
  return { ok: true };
}
const bad = (reason) => ({ ok: false, reason });
