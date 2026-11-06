// SPEC-M18: the app and the server must agree on which record types each module owns.
import { describe, it, expect } from 'vitest';
import { MODULES, MODULE_TYPES, effectiveModules } from './modules';
import { can } from './permissions';

// The server module is plain JS; load it from its file (Node, outside the app's tsconfig).
const server = (await import('../../../server/industries.mjs' as string)) as {
  MODULES: string[]; MODULE_TYPES: Record<string, string[]>; effectiveModules: (m: unknown) => Record<string, boolean>;
};

describe('modules (SPEC-M18)', () => {
  it('app and server list the same modules and record types', () => {
    expect(MODULES).toEqual(server.MODULES);
    expect(MODULE_TYPES).toEqual(server.MODULE_TYPES);
  });
  it('missing = on, wages needs attendance, on both sides', () => {
    for (const input of [undefined, {}, { attendance: false }, { catalogue: false, wages: false }]) {
      expect(effectiveModules(input)).toEqual(server.effectiveModules(input));
    }
    expect(effectiveModules({ attendance: false }).wages).toBe(false);
  });
  it('can() refuses actions of a module that is off, for the owner too; paused refuses every entry', () => {
    const off = effectiveModules({ catalogue: false, advances: false });
    expect(can('owner', 'carpet.manage', undefined, { modules: off, status: 'active' })).toBe(false);
    expect(can('owner', 'advance.give', undefined, { modules: off, status: 'active' })).toBe(false);
    expect(can('owner', 'stock.move', undefined, { modules: off, status: 'active' })).toBe(true);
    expect(can('owner', 'attendance.mark', undefined, { modules: effectiveModules({}), status: 'paused' })).toBe(false);
    expect(can('owner', 'settings.edit', undefined, { modules: effectiveModules({}), status: 'paused' })).toBe(false);
    expect(can('owner', 'log.view', undefined, { modules: effectiveModules({}), status: 'paused' })).toBe(true);
    expect(can('owner', 'export', undefined, { modules: effectiveModules({}), status: 'paused' })).toBe(true);
  });
});
