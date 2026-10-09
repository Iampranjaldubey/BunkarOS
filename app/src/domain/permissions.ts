// Bunkar OS — role permissions (N2). Pure.
import type { Rec, Role, UserP, LoomP } from '../db/types.ts';
import { listLooms } from './pieces.ts';

export type Action =
  | 'rate.edit'
  | 'settings.edit'
  | 'user.manage'
  | 'record.reverse.any'
  | 'record.reverse.ownToday'
  | 'order.create'
  | 'yarn.issue'
  | 'bazaar.create'
  | 'peshgi.give'
  | 'checkin.create'
  | 'roker.entry'
  | 'digest.view'
  | 'audit.view'
  | 'loom.manage'
  | 'weaver.manage'
  | 'job.create';

const OWNER_ONLY: Action[] = ['rate.edit', 'settings.edit', 'user.manage', 'record.reverse.any'];

// Everything an owner/munshi can do (owner = all actions).
const ALL_ACTIONS: Action[] = [
  ...OWNER_ONLY,
  'record.reverse.ownToday',
  'order.create',
  'yarn.issue',
  'bazaar.create',
  'peshgi.give',
  'checkin.create',
  'roker.entry',
  'digest.view',
  'audit.view',
  'loom.manage',
  'weaver.manage',
  'job.create',
];

// Thekedar: only check-in creation + yarn view of own looms. No digest.
const THEKEDAR_ALLOWED: Action[] = ['checkin.create'];

/**
 * can(role, action):
 *  - owner: all actions.
 *  - munshi: everything except rate.edit, settings.edit, user.manage, record.reverse.any.
 *  - thekedar: only checkin.create (yarn view of own looms handled via visibleLoomIds).
 */
export function can(role: Role, action: Action): boolean {
  if (role === 'owner') return ALL_ACTIONS.includes(action);
  if (role === 'munshi') return ALL_ACTIONS.includes(action) && !OWNER_ONLY.includes(action);
  if (role === 'thekedar') return THEKEDAR_ALLOWED.includes(action);
  return false;
}

/**
 * Loom ids a user may see. Owner & munshi see all looms. A thekedar sees only
 * looms whose thekedarId matches the thekedarId on their user record.
 */
export function visibleLoomIds(recs: Rec[], user: UserP): string[] {
  const looms: LoomP[] = listLooms(recs);
  if (user.role === 'owner' || user.role === 'munshi') return looms.map((l) => l.entityId);
  return looms.filter((l) => l.thekedarId !== undefined && l.thekedarId === user.thekedarId).map((l) => l.entityId);
}
