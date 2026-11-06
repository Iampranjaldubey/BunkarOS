// SPEC-M18: industries, modules and which record types each module owns. The app keeps the same map in
// app/src/domain/modules.ts; app/src/domain/modules.test.ts checks that the two match.

export const MODULES = ['attendance', 'wages', 'advances', 'stock', 'orders', 'catalogue'];

/** Record types per module. Types not listed here (user, setting, worker, reversal, usage) are always on. */
export const MODULE_TYPES = {
  attendance: ['attendance', 'piece_entry'],
  wages: ['wage_payment', 'period_lock'],
  advances: ['advance'],
  stock: ['item', 'stock_in', 'stock_out', 'stock_adjust', 'finished_in'],
  orders: ['buyer', 'order', 'order_status', 'order_note', 'delivery'],
  catalogue: ['carpet', 'carpet_in', 'carpet_reserve', 'carpet_out'],
};

const TYPE_MODULE = new Map(Object.entries(MODULE_TYPES).flatMap(([m, types]) => types.map((t) => [t, m])));
/** The module a record type belongs to, or undefined when it is always on. */
export function moduleOfType(type) { return TYPE_MODULE.get(type); }

const ALL_ON = Object.fromEntries(MODULES.map((m) => [m, true]));

/** Industries the platform supports. Each has an app-side pack in app/src/industries/<id>/. */
export const INDUSTRIES = {
  carpet: { id: 'carpet', name: 'Carpet', defaultModules: { ...ALL_ON } },
  bags: { id: 'bags', name: 'Bags', defaultModules: { ...ALL_ON } }, // P-001: all six on until the partner's list arrives
};
export const isIndustry = (id) => typeof id === 'string' && Object.hasOwn(INDUSTRIES, id);

/**
 * Modules as they apply: a missing key means on (units created before SPEC-M18 have `{}`),
 * and wages needs attendance (SPEC-M18 §2).
 */
export function effectiveModules(stored) {
  const m = {};
  for (const k of MODULES) m[k] = !(stored && stored[k] === false);
  if (!m.attendance) m.wages = false;
  return m;
}

/** Validate a modules object from the founders' console. Returns the cleaned object or null. */
export function cleanModules(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (!MODULES.includes(k) || typeof v !== 'boolean') return null;
    out[k] = v;
  }
  return effectiveModules(out);
}

export const STATUSES = ['invited', 'active', 'paused'];
