import type { OrgStatus } from './api';

export const STATUS_TONE: Record<OrgStatus, 'received' | 'warn' | 'neutral'> = { active: 'received', invited: 'warn', paused: 'neutral' };
export const STATUS_LABEL: Record<OrgStatus, string> = { active: 'Active', invited: 'Invited', paused: 'Paused' };
export const INDUSTRY_LABEL: Record<string, string> = { carpet: 'Carpet', bags: 'Bags' };
export const LANG_LABEL: Record<string, string> = { hi: 'हिंदी', hin: 'Hinglish', en: 'English' };
export const ROLE_LABEL: Record<string, string> = { owner: 'Owner', staff: 'Operator' };
export const JOB_LABEL: Record<string, string> = { weaver: 'Weaver', finisher: 'Finisher', helper: 'Helper', other: 'Other', cutter: 'Cutter', stitcher: 'Stitcher', packer: 'Packer' };
export const UNIT_LABEL: Record<string, string> = { kg: 'kg', pcs: 'pieces', litre: 'litre', metre: 'metre', roll: 'roll' };
/** "2026-11" → "November 2026". */
export const monthName = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }); };
