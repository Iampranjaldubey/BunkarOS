// Founders' console (SPEC-M09, SPEC-M18): separate admin token in localStorage. Reads usage and organisation fields;
// writes only the organisation's industry, modules, status and invites. Never a unit's records.
import type { ModuleId } from '../sync/types';

const KEY = 'bunkar.admin';
export interface AdminSession { token: string; name: string; exp: number; }
export function getAdmin(): AdminSession | null {
  try { const s = localStorage.getItem(KEY); if (!s) return null; const a = JSON.parse(s) as AdminSession; return a.exp > Date.now() ? a : null; } catch { return null; }
}
export function setAdmin(a: AdminSession): void { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* ignore */ } }
export function clearAdmin(): void { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

export type OrgStatus = 'invited' | 'active' | 'paused';
export type ModuleMap = Record<ModuleId, boolean>;
export interface Org { industry: string; modules: ModuleMap; status: OrgStatus }
export interface InviteState { ownerName: string; ownerPhone: string; lang: string; createdAt: string; expiresAt: string; usedAt: string | null; state: 'open' | 'used' | 'revoked' | 'expired' }
export interface InviteSecrets { token: string; code: string; expiresAt: string }
export interface AdminUnitRow {
  unitId: string; name: string; shortCode: string | null; createdAt: string; ownerName: string; ownerPhone: string;
  industry: string; modules: Partial<ModuleMap>; status: OrgStatus; invite?: InviteState;
  users: number; workers: number; records: number; monthEntries: number; monthDays: number; lastAt: string | null;
}
export interface Usage { month: string; lastAt: string | null; ownerOpens: number; byModule: Record<string, number>; byUser: { name: string; role: string; entries: number; days: number }[]; logins: number; workers: number }
export interface PlatformEvent { seq: number; at: string; actor: string; action: string; before: unknown; after: unknown; reason: string }
export interface Industry { id: string; name: string; defaultModules: ModuleMap }

export async function adminLogin(name: string, key: string): Promise<{ ok: true } | { ok: false; status: number }> {
  try {
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, key }) });
    if (!r.ok) return { ok: false, status: r.status };
    const b = (await r.json()) as { token: string; exp: number; name: string };
    setAdmin({ token: b.token, exp: b.exp, name: b.name });
    return { ok: true };
  } catch { return { ok: false, status: 0 }; }
}
async function adminFetch(path: string, body?: unknown): Promise<Response> {
  const a = getAdmin();
  const headers: Record<string, string> = a ? { Authorization: `Bearer ${a.token}` } : {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(path, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) });
  if (r.status === 401) clearAdmin();
  return r;
}
async function json<T>(r: Response): Promise<T | null> { return r.ok ? ((await r.json()) as T) : null; }

export async function fetchUnits() { return json<{ month: string; units: AdminUnitRow[] }>(await adminFetch('/api/admin/units')); }
export async function fetchUnit(unitId: string) {
  return json<{ unit: { unitId: string; name: string; shortCode: string | null }; org: Org; invite?: InviteState; usage: Usage }>(await adminFetch(`/api/admin/units/${encodeURIComponent(unitId)}`));
}
export async function fetchEvents(unitId: string) { return json<{ events: PlatformEvent[] }>(await adminFetch(`/api/admin/units/${encodeURIComponent(unitId)}/events`)); }
export async function fetchIndustries() { return json<{ modules: ModuleId[]; industries: Industry[] }>(await adminFetch('/api/admin/industries')); }

/** Server error code → a sentence for the founder. */
const ERRORS: Record<string, string> = {
  invalid: 'Check the fields: name, owner name and a 10-digit phone are required.',
  invalid_modules: 'That combination of modules is not allowed.',
  reason_required: 'Write a reason. It goes into the changes log.',
  not_joined: 'The owner has not opened the invite yet, so the organisation cannot be paused.',
  already_joined: 'The owner already opened the invite.',
  admin_unauthorized: 'Your admin session ended. Log in again.',
};
export const adminErrorText = (code: string | undefined) => (code && ERRORS[code]) || 'Something went wrong. Try again.';
async function result<T>(r: Response): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const b = (await r.json().catch(() => ({}))) as T & { error?: string };
  return r.ok ? { ok: true, data: b } : { ok: false, error: adminErrorText(b.error) };
}
export async function createOrg(body: { name: string; industry: string; modules: ModuleMap; lang: string; ownerName: string; ownerPhone: string; reason?: string }) {
  return result<{ unitId: string; shortCode: string; invite: InviteSecrets }>(await adminFetch('/api/admin/orgs', body));
}
export async function setOrg(unitId: string, body: { modules?: Partial<ModuleMap>; status?: 'active' | 'paused'; reason: string }) {
  return result<{ org: Org }>(await adminFetch(`/api/admin/units/${encodeURIComponent(unitId)}/org`, body));
}
export async function inviteAction(unitId: string, action: 'resend' | 'cancel', reason?: string) {
  return result<{ invite?: InviteSecrets }>(await adminFetch(`/api/admin/units/${encodeURIComponent(unitId)}/invite`, { action, reason }));
}
export const inviteUrl = (token: string) => `${window.location.origin}/join/${token}`;
export const groupCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
export const MODULE_LABEL: Record<ModuleId, { name: string; hint: string }> = {
  attendance: { name: 'Attendance', hint: 'Daily roll call, pieces, overtime' },
  wages: { name: 'Wages and slips', hint: 'Wage sheet, pay, printed slip, month lock. Needs attendance.' },
  advances: { name: 'Advances', hint: 'Money given ahead of pay, recovered at settlement' },
  stock: { name: 'Raw material stock', hint: 'Items, stock in and out, adjustments, low stock' },
  orders: { name: 'Buyer orders', hint: 'Buyers, orders, stages, deliveries' },
  catalogue: { name: 'Finished goods catalogue', hint: 'Photos, sizes, reserve, sell, write off' },
};
