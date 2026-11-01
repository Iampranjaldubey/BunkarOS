// Role permissions. Owner = everything. Operator (staff) = what the owner's toggles allow (SPEC-M13, D-005).
// The server enforces the same rules (server/rules.mjs); this file only decides what the screens offer.
import type { OperatorPerms, Role } from '../db/types.ts';
import { DEFAULT_OPERATOR_PERMS } from './settings.ts';

export type Action =
  | 'settings.edit' | 'user.manage' | 'worker.rates' | 'month.lock' | 'export'
  | 'record.reverse.any' | 'record.reverse.ownToday' | 'record.reverse.past'
  | 'worker.manage' | 'attendance.mark' | 'advance.give' | 'wage.pay' | 'wage.override'
  | 'item.manage' | 'stock.move' | 'order.manage' | 'log.view' | 'wages.view' | 'price.view';

/** Never an operator's, whatever the toggles say. */
const OWNER_ONLY: Action[] = ['settings.edit', 'user.manage', 'worker.rates', 'month.lock', 'record.reverse.any', 'wage.override'];
/** Writing entries: needs "add entries". */
const ENTRY: Action[] = ['worker.manage', 'attendance.mark', 'advance.give', 'wage.pay', 'item.manage', 'stock.move', 'order.manage', 'record.reverse.ownToday'];

export function can(role: Role, action: Action, perms: OperatorPerms = DEFAULT_OPERATOR_PERMS): boolean {
  if (role === 'owner') return true;
  if (role !== 'staff') return false;
  if (OWNER_ONLY.includes(action)) return false;
  if (ENTRY.includes(action)) return perms.addEntries;
  if (action === 'record.reverse.past') return perms.addEntries && perms.editPast;
  if (action === 'export') return perms.export;
  if (action === 'price.view') return perms.seePrices;
  return action === 'log.view' || action === 'wages.view'; // stage 1: operators see wages
}
