// Platform admin (SPEC-M09): separate token in localStorage; read-only endpoints.
import type { Rec } from '../db/types';

const KEY = 'bunkar.admin';
export interface AdminSession { token: string; name: string; exp: number; }
export function getAdmin(): AdminSession | null {
  try { const s = localStorage.getItem(KEY); if (!s) return null; const a = JSON.parse(s) as AdminSession; return a.exp > Date.now() ? a : null; } catch { return null; }
}
export function setAdmin(a: AdminSession): void { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* ignore */ } }
export function clearAdmin(): void { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

export interface AdminUnitRow {
  unitId: string; name: string; shortCode: string | null; createdAt: string; ownerName: string; ownerPhone: string;
  users: number; workers: number; records: number; monthEntries: number; monthDays: number; lastAt: string | null;
}
export async function adminLogin(name: string, key: string): Promise<{ ok: true } | { ok: false; status: number }> {
  try {
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, key }) });
    if (!r.ok) return { ok: false, status: r.status };
    const b = (await r.json()) as { token: string; exp: number; name: string };
    setAdmin({ token: b.token, exp: b.exp, name: b.name });
    return { ok: true };
  } catch { return { ok: false, status: 0 }; }
}
async function adminFetch(path: string): Promise<Response> {
  const a = getAdmin();
  return fetch(path, { headers: a ? { Authorization: `Bearer ${a.token}` } : {} });
}
export async function fetchUnits(): Promise<{ month: string; units: AdminUnitRow[] } | null> {
  const r = await adminFetch('/api/admin/units'); if (r.status === 401) { clearAdmin(); return null; } if (!r.ok) return null;
  return (await r.json()) as { month: string; units: AdminUnitRow[] };
}
export async function fetchUnit(unitId: string): Promise<{ unit: { unitId: string; name: string; shortCode: string | null }; records: Rec[] } | null> {
  const r = await adminFetch(`/api/admin/units/${encodeURIComponent(unitId)}`); if (r.status === 401) { clearAdmin(); return null; } if (!r.ok) return null;
  return (await r.json()) as { unit: { unitId: string; name: string; shortCode: string | null }; records: Rec[] };
}
