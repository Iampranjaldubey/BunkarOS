// Role permissions. Owner = everything. Operator (staff) = what the owner's toggles allow (SPEC-M13, D-005).
// The server enforces the same rules (server/rules.mjs); this file only decides what the screens offer.
import type { OperatorPerms, Role } from '../db/types.ts';
import { DEFAULT_OPERATOR_PERMS } from './settings.ts';
import type { Modules } from './modules.ts';
import type { ModuleId } from '../sync/types.ts';

export type Action =
  | 'settings.edit' | 'user.manage' | 'worker.rates' | 'month.lock' | 'export'
  | 'record.reverse.any' | 'record.reverse.ownToday' | 'record.reverse.past'
  | 'worker.manage' | 'attendance.mark' | 'advance.give' | 'wage.pay' | 'wage.override'
  | 'item.manage' | 'stock.move' | 'order.manage' | 'carpet.manage' | 'log.view' | 'wages.view' | 'price.view';

/** Never an operator's, whatever the toggles say. */
const OWNER_ONLY: Action[] = ['settings.edit', 'user.manage', 'worker.rates', 'month.lock', 'record.reverse.any', 'wage.override'];
/** Writing entries: needs "add entries". */
const ENTRY: Action[] = ['worker.manage', 'attendance.mark', 'advance.give', 'wage.pay', 'item.manage', 'stock.move', 'order.manage', 'carpet.manage', 'record.reverse.ownToday'];

/** SPEC-M18: the module an action belongs to (the platform can switch it off for the whole organisation). */
const ACTION_MODULE: Partial<Record<Action, ModuleId>> = {
  'attendance.mark': 'attendance', 'advance.give': 'advances', 'wage.pay': 'wages', 'wage.override': 'wages', 'month.lock': 'wages', 'wages.view': 'wages',
  'item.manage': 'stock', 'stock.move': 'stock', 'order.manage': 'orders', 'carpet.manage': 'catalogue',
};
/** Actions that only read, so they stay allowed while the organisation is paused (SPEC-M18 §3). */
const READ_ONLY: Action[] = ['log.view', 'wages.view', 'price.view', 'export'];
export interface OrgGate { modules: Modules; status: 'invited' | 'active' | 'paused' }

export function can(role: Role, action: Action, perms: OperatorPerms = DEFAULT_OPERATOR_PERMS, org?: OrgGate): boolean {
  if (org) {
    const mod = ACTION_MODULE[action];
    if (mod && !org.modules[mod]) return false;
    if (org.status !== 'active' && !READ_ONLY.includes(action)) return false;
  }
  if (role === 'owner') return true;
  if (role !== 'staff') return false;
  if (OWNER_ONLY.includes(action)) return false;
  if (ENTRY.includes(action)) return perms.addEntries;
  if (action === 'record.reverse.past') return perms.addEntries && perms.editPast;
  if (action === 'export') return perms.export;
  if (action === 'price.view') return perms.seePrices;
  return action === 'log.view' || action === 'wages.view'; // stage 1: operators see wages
}
