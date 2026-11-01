// Unit rules as settings (SPEC-M13, docs/decisions.md D-001…D-005). Pure.
// A missing field on the `setting` record means its default, so units created before these settings keep working.
import type { OffDayPolicy, OperatorPerms, SettingP, SlipSection } from '../db/types.ts';

export const OFF_DAY_POLICIES: OffDayPolicy[] = ['none', 'sundays', 'sundays_and_holidays'];
export const DEFAULT_OFF_DAY_POLICY: OffDayPolicy = 'sundays_and_holidays'; // provisional (D-002)

/** Every slip section in print order. The first 8 are on by default (D-003). */
export const SLIP_SECTIONS: SlipSection[] = [
  'businessName', 'workerName', 'month', 'gross', 'advance', 'deductions', 'net', 'signature',
  'attendance', 'offDays', 'pieces', 'overtime', 'rate', 'ownerChanges', 'advanceBalance', 'payment',
];
export const DEFAULT_SLIP_ON: SlipSection[] = ['businessName', 'workerName', 'month', 'gross', 'advance', 'deductions', 'net', 'signature'];
/** A slip without these is not a slip: they cannot be switched off. */
export const FIXED_SLIP_SECTIONS: SlipSection[] = ['businessName', 'workerName', 'month', 'net'];

export const DEFAULT_OPERATOR_PERMS: OperatorPerms = { addEntries: true, editPast: false, seeWages: true, seePrices: true, export: false };
/** Toggles shown in Settings now. "See wages" waits for server-side wage redaction (SPEC-M13 stage 2). */
export const SHOWN_OPERATOR_TOGGLES: (keyof OperatorPerms)[] = ['addEntries', 'editPast', 'seePrices', 'export'];

export interface UnitRules {
  overtimeEnabled: boolean;
  offDayPolicy: OffDayPolicy;
  slip: Record<SlipSection, boolean>;
  operatorPerms: OperatorPerms;
}

export function unitRules(s: SettingP | undefined): UnitRules {
  const slip = Object.fromEntries(SLIP_SECTIONS.map((k) => [k, DEFAULT_SLIP_ON.includes(k)])) as Record<SlipSection, boolean>;
  for (const k of SLIP_SECTIONS) if (typeof s?.slipSections?.[k] === 'boolean') slip[k] = s.slipSections[k] as boolean;
  for (const k of FIXED_SLIP_SECTIONS) slip[k] = true;
  const perms: OperatorPerms = { ...DEFAULT_OPERATOR_PERMS };
  for (const k of Object.keys(DEFAULT_OPERATOR_PERMS) as (keyof OperatorPerms)[]) if (typeof s?.operatorPerms?.[k] === 'boolean') perms[k] = s.operatorPerms[k] as boolean;
  perms.seeWages = true; // stage 1: operators always see wages
  const overtimeEnabled = s?.overtimeEnabled === true;
  if (!overtimeEnabled) slip.overtime = false;
  return {
    overtimeEnabled,
    offDayPolicy: s?.offDayPolicy && OFF_DAY_POLICIES.includes(s.offDayPolicy) ? s.offDayPolicy : DEFAULT_OFF_DAY_POLICY,
    slip,
    operatorPerms: perms,
  };
}
