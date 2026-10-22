// Role permissions. Owner = everything. Staff = daily entry, no money-rule changes.
import type { Role } from '../db/types.ts';

export type Action =
  | 'settings.edit' | 'user.manage' | 'worker.rates' | 'month.lock' | 'export'
  | 'record.reverse.any' | 'record.reverse.ownToday'
  | 'worker.manage' | 'attendance.mark' | 'advance.give' | 'wage.pay'
  | 'item.manage' | 'stock.move' | 'order.manage' | 'log.view' | 'wages.view';

const OWNER_ONLY: Action[] = ['settings.edit', 'user.manage', 'worker.rates', 'month.lock', 'export', 'record.reverse.any'];
const ALL: Action[] = [
  ...OWNER_ONLY, 'record.reverse.ownToday', 'worker.manage', 'attendance.mark', 'advance.give', 'wage.pay',
  'item.manage', 'stock.move', 'order.manage', 'log.view', 'wages.view',
];

export function can(role: Role, action: Action): boolean {
  if (role === 'owner') return ALL.includes(action);
  if (role === 'staff') return ALL.includes(action) && !OWNER_ONLY.includes(action);
  return false;
}
