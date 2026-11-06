// SPEC-M18: modules the platform switches per organisation, and the record types each one owns.
// Mirror of server/industries.mjs; modules.test.ts checks that the two agree.
import type { RecordType } from '../db/types.ts';
import type { ModuleId, OrgInfo } from '../sync/types.ts';

export const MODULES: ModuleId[] = ['attendance', 'wages', 'advances', 'stock', 'orders', 'catalogue'];

export const MODULE_TYPES: Record<ModuleId, RecordType[]> = {
  attendance: ['attendance', 'piece_entry'],
  wages: ['wage_payment', 'period_lock'],
  advances: ['advance'],
  stock: ['item', 'stock_in', 'stock_out', 'stock_adjust', 'finished_in'],
  orders: ['buyer', 'order', 'order_status', 'order_note', 'delivery'],
  catalogue: ['carpet', 'carpet_in', 'carpet_reserve', 'carpet_out'],
};

const TYPE_MODULE = new Map<string, ModuleId>(Object.entries(MODULE_TYPES).flatMap(([m, types]) => types.map((t) => [t, m as ModuleId] as const)));
export function moduleOfType(type: string): ModuleId | undefined { return TYPE_MODULE.get(type); }

export type Modules = Record<ModuleId, boolean>;
export const ALL_MODULES_ON: Modules = { attendance: true, wages: true, advances: true, stock: true, orders: true, catalogue: true };

/** Missing key = on; wages needs attendance. Same rule as the server. */
export function effectiveModules(stored: Partial<Modules> | undefined): Modules {
  const m = { ...ALL_MODULES_ON };
  for (const k of MODULES) if (stored && stored[k] === false) m[k] = false;
  if (!m.attendance) m.wages = false;
  return m;
}

/** Before the first sync (or for a unit older than SPEC-M18): carpet, everything on, active. */
export const DEFAULT_ORG: OrgInfo = { industry: 'carpet', modules: ALL_MODULES_ON, status: 'active' };
