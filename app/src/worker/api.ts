// Public worker page: token + cached data live in localStorage (no login, no logout).
import type { Rec, WorkerP } from '../db/types';

export interface WorkerData {
  unitName: string; shopCode: string; ownerPhone: string; worker: WorkerP; workerId: string; records: Rec[]; fetchedAt: string;
}
const TOKEN_KEY = 'bunkar.worker.token';
const DATA_KEY = 'bunkar.worker.data';

export function getWorkerToken(): string | null { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
export function setWorkerToken(token: string): void { try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ } }
export function forgetWorker(): void { try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(DATA_KEY); } catch { /* ignore */ } }
export function cachedWorkerData(): WorkerData | null { try { const s = localStorage.getItem(DATA_KEY); return s ? (JSON.parse(s) as WorkerData) : null; } catch { return null; } }

export type FetchResult = { ok: true; data: WorkerData } | { ok: false; reason: 'revoked' | 'not_found' | 'offline' | 'error' };

export async function fetchWorkerData(token: string): Promise<FetchResult> {
  try {
    const r = await fetch(`/api/w/${encodeURIComponent(token)}`);
    if (r.status === 410) return { ok: false, reason: 'revoked' };
    if (r.status === 404) return { ok: false, reason: 'not_found' };
    if (!r.ok) return { ok: false, reason: 'error' };
    const data = (await r.json()) as WorkerData;
    try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); } catch { /* ignore */ }
    return { ok: true, data };
  } catch { return { ok: false, reason: 'offline' }; }
}

export async function fetchShop(shopCode: string): Promise<{ unitName: string; workers: { workerId: string; name: string; jobTitle: string }[] } | null> {
  try { const r = await fetch(`/api/w/shop/${encodeURIComponent(shopCode)}`); if (!r.ok) return null; return (await r.json()) as { unitName: string; workers: { workerId: string; name: string; jobTitle: string }[] }; }
  catch { return null; }
}

export async function claimByCode(shopCode: string, workerId: string, code: string): Promise<{ ok: true; token: string } | { ok: false; status: number }> {
  try {
    const r = await fetch('/api/w/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopCode, workerId, code }) });
    if (!r.ok) return { ok: false, status: r.status };
    const b = (await r.json()) as { token: string };
    return { ok: true, token: b.token };
  } catch { return { ok: false, status: 0 }; }
}
