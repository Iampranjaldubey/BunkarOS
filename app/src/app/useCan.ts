import { useCallback, useMemo } from 'react';
import { useRecords } from '../db/hooks';
import { getSettings } from '../domain/masters';
import { unitRules, type UnitRules } from '../domain/settings';
import { can, type Action } from '../domain/permissions';
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
  return useCallback((action: Action) => (role ? can(role, action, operatorPerms) : false), [role, operatorPerms]);
}
