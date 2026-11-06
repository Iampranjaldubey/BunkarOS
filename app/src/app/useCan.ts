import { useCallback, useMemo } from 'react';
import { useRecords } from '../db/hooks';
import { getSettings } from '../domain/masters';
import { unitRules, type UnitRules } from '../domain/settings';
import { can, type Action } from '../domain/permissions';
import { DEFAULT_ORG, effectiveModules, type Modules } from '../domain/modules';
import { useSyncState } from '../sync/client';
import type { ModuleId, OrgInfo } from '../sync/types';
import { useSession } from './session';

/** The unit's current rules (overtime, off-day policy, slip sections, operator toggles) with defaults. */
export function useUnitRules(): UnitRules {
  const recs = useRecords();
  return useMemo(() => unitRules(getSettings(recs)), [recs]);
}

/** `can(action)` for the logged-in user, using the owner's operator toggles (SPEC-M13). */
export function useCan(): (action: Action) => boolean {
  const { role } = useSession();
  const { operatorPerms } = useUnitRules();
  const org = useOrg();
  return useCallback((action: Action) => (role ? can(role, action, operatorPerms, org) : false), [role, operatorPerms, org]);
}

/** Like useCan, but a paused organisation still sees every screen it may read (menus use this). */
export function useCanSee(): (action: Action) => boolean {
  const { role } = useSession();
  const { operatorPerms } = useUnitRules();
  const org = useOrg();
  return useCallback((action: Action) => (role ? can(role, action, operatorPerms, { ...org, status: 'active' }) : false), [role, operatorPerms, org]);
}

/** SPEC-M18: the organisation as the platform set it (last sync, kept offline). */
export function useOrg(): OrgInfo & { modules: Modules } {
  const { org } = useSyncState();
  return useMemo(() => {
    const o = org ?? DEFAULT_ORG;
    return { ...o, modules: effectiveModules(o.modules) };
  }, [org]);
}
/** Is this module on for the organisation? */
export function useModule(): (m: ModuleId) => boolean {
  const { modules } = useOrg();
  return useCallback((m: ModuleId) => modules[m], [modules]);
}
