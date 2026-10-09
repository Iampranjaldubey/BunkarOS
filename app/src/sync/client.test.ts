// Bunkar OS — sync client tests (node env + mocked Dexie db + scripted fetch).
// Covers the security/correctness fixes owned by the sync client:
//   H2  pull drains all pages until a short page (independent of pending pushes)
//   L3  a locally-rejected record is never flipped back to 'synced' on pull
//   C1/H1 client side: Authorization header on sync, 401 → authState needs_login,
//         requestToken stores a token and flips authState to 'ok'
//   needs_login: a unit with users but no token reports needs_login and skips.
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';
import type { Rec } from '../db/types';

// ------- in-memory Dexie-ish mock (only the surface the client uses) -------
interface MetaRow { key: string; value: unknown }
const records = new Map<string, Rec>();
const meta = new Map<string, unknown>();
interface PhotoMock { id: string; unitId?: string; sync: 'pending' | 'synced' | 'rejected'; mime: string; blob: unknown }
const photoRows = new Map<string, PhotoMock>();

function recordsTable() {
  return {
    where(index: string) {
      return {
        equals(value: string) {
          const all = () => [...records.values()].filter((r) => (r as unknown as Record<string, unknown>)[index] === value);
          return {
            limit: (n: number) => ({ toArray: async () => all().slice(0, n) }),
            toArray: async () => all(),
            count: async () => all().length,
          };
        },
        // used by unitHasUsers: where('unitId').equals(x).filter(fn).count()
      };
    },
    get: async (id: string) => records.get(id),
    put: async (rec: Rec) => { records.set(rec.id, rec); return rec.id; },
    update: async (id: string, changes: Partial<Rec>) => {
      const cur = records.get(id);
      if (!cur) return 0;
      records.set(id, { ...cur, ...changes });
      return 1;
    },
  };
}

// where('unitId').equals(x).filter(fn).count() needs a filter() on the equals result.
function recordsTableWithFilter() {
  const base = recordsTable();
  const origWhere = base.where.bind(base);
  base.where = (index: string) => {
    const w = origWhere(index);
    const origEquals = w.equals.bind(w);
    w.equals = (value: string) => {
      const eq = origEquals(value);
      return {
        ...eq,
        filter: (fn: (r: Rec) => boolean) => ({
          count: async () => (await eq.toArray()).filter(fn).length,
          toArray: async () => (await eq.toArray()).filter(fn),
        }),
      };
    };
    return w;
  };
  return base;
}

vi.mock('../db/db', () => {
  return {
    db: {
      records: recordsTableWithFilter(),
      photos: {
        where: (index: string) => ({
          equals: (value: string) => ({
            toArray: async () => [...photoRows.values()].filter((p) => (p as unknown as Record<string, unknown>)[index] === value),
          }),
        }),
        update: async (id: string, changes: Partial<PhotoMock>) => {
          const cur = photoRows.get(id);
          if (!cur) return 0;
          photoRows.set(id, { ...cur, ...changes });
          return 1;
        },
      },
      meta: {
        get: async (key: string): Promise<MetaRow | undefined> =>
          meta.has(key) ? { key, value: meta.get(key) } : undefined,
        put: async (row: MetaRow) => { meta.set(row.key, row.value); return row.key; },
        delete: async (key: string) => { meta.delete(key); },
      },
    },
  };
});

// Minimal useSyncExternalStore stub is unnecessary — we never render.
import {
  syncNow,
  requestToken,
  getSyncState,
  registerUnitIfNeeded,
} from './client';

const UNIT = 'unit-1';
const KEY = 'unit-key-xyz';

function mkRec(over: Partial<Rec> = {}): Rec {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    type: over.type ?? 'loom',
    unitId: over.unitId ?? UNIT,
    payload: over.payload ?? { entityId: 'x' },
    by: over.by ?? 'u-owner',
    role: over.role ?? 'owner',
    device: over.device ?? 'dev',
    at: over.at ?? new Date().toISOString(),
    day: over.day ?? '2026-10-09',
    sync: over.sync ?? 'pending',
    ...over,
  } as Rec;
}

beforeEach(() => {
  records.clear();
  meta.clear();
  photoRows.clear();
  // Credentials + mark unit already registered so registerUnitIfNeeded no-ops.
  meta.set('bunkar.unit', { unitId: UNIT, unitKey: KEY, unitName: 'Test' });
  meta.set('unitRegistered', true);
  // navigator.onLine defaults true in node (undefined navigator); client treats it as online.
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestToken (C1/H1 client)', () => {
  test('stores token + exp and sets authState ok on success', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ ok: true, token: 'tok.abc', exp: Date.now() + 1_000_000 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await requestToken(UNIT, 'u-owner', '1234');
    expect(res.ok).toBe(true);
    expect(getSyncState().authState).toBe('ok');
    const auth = meta.get('bunkar.auth') as { token: string; userId: string };
    expect(auth.token).toBe('tok.abc');
    expect(auth.userId).toBe('u-owner');
    // The request body carried unitKey + pin + deviceId for server-side verify + binding.
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ unitId: UNIT, unitKey: KEY, userId: 'u-owner', pin: '1234' });
    expect(typeof body.deviceId).toBe('string');
    expect((body.deviceId as string).length).toBeGreaterThanOrEqual(8);
  });

  test('offline / network error → authState needs_login, no token stored', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const res = await requestToken(UNIT, 'u-owner', '1234');
    expect(res.ok).toBe(false);
    expect(getSyncState().authState).toBe('needs_login');
    expect(meta.get('bunkar.auth')).toBeUndefined();
  });

  test('wrong PIN (401) → needs_login', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false }), { status: 401 })));
    const res = await requestToken(UNIT, 'u-owner', '0000');
    expect(res.ok).toBe(false);
    expect(getSyncState().authState).toBe('needs_login');
  });

  test('SPEC-014: 409 device_bound → ok:false, reason device_bound, boundAt passed through, no session', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: 'device_bound', boundAt: '2026-10-09T05:00:00.000Z' }), { status: 409 }),
    ));
    const res = await requestToken(UNIT, 'u-munshi', '1111');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('device_bound');
    expect(res.boundAt).toBe('2026-10-09T05:00:00.000Z');
    // No token stored on a conflict.
    expect(meta.get('bunkar.auth')).toBeUndefined();
  });
});

describe('SPEC-014 — device_revoked', () => {
  test('401 device_revoked from /api/sync → authState device_revoked + token dropped', async () => {
    records.set('u1', mkRec({ id: 'u1', type: 'user', sync: 'synced' }));
    meta.set('bunkar.auth', { token: 'revoked', exp: Date.now() + 1_000_000, userId: 'u-munshi' });
    records.set('p1', mkRec({ id: 'p1', sync: 'pending' }));

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/api/sync')) {
        return new Response(JSON.stringify({ ok: false, error: 'device_revoked' }), { status: 401 });
      }
      return new Response('{}', { status: 200 });
    }));

    await syncNow();
    expect(getSyncState().authState).toBe('device_revoked');
    expect(meta.get('bunkar.auth')).toBeUndefined();
    // The pending record is NOT discarded — it stays for a post-relogin sync.
    expect(records.get('p1')?.sync).toBe('pending');
  });
});

describe('syncNow auth gating', () => {
  test('bootstrap: no token → still attempts a token-less sync (server allows bootstrap)', async () => {
    // A fresh unit: the client must push bootstrap records with the unit key
    // alone (no Bearer header). We assert a /api/sync call is made WITHOUT an
    // Authorization header, and a 200 keeps authState 'ok'.
    records.set('p1', mkRec({ id: 'p1', type: 'user', sync: 'pending' }));
    let sawSync = false;
    let sawAuthHeader = false;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/api/sync')) {
        sawSync = true;
        const headers = (init?.headers ?? {}) as Record<string, string>;
        if (headers['Authorization']) sawAuthHeader = true;
        return new Response(JSON.stringify({ accepted: ['p1'], rejected: [], records: [], cursor: 1 }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }));

    await syncNow();
    expect(sawSync).toBe(true);
    expect(sawAuthHeader).toBe(false);
    expect(getSyncState().authState).toBe('ok');
  });

  test('401 from /api/sync → token dropped + authState needs_login', async () => {
    records.set('u1', mkRec({ id: 'u1', type: 'user', sync: 'synced' }));
    meta.set('bunkar.auth', { token: 'stale', exp: Date.now() + 1_000_000, userId: 'u-owner' });
    records.set('p1', mkRec({ id: 'p1', sync: 'pending' }));

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/api/sync')) return new Response('{}', { status: 401 });
      return new Response('{}', { status: 200 });
    }));

    await syncNow();
    expect(getSyncState().authState).toBe('needs_login');
    expect(meta.get('bunkar.auth')).toBeUndefined();
  });

  test('sync sends Authorization: Bearer header when a token is held', async () => {
    records.set('u1', mkRec({ id: 'u1', type: 'user', sync: 'synced' }));
    meta.set('bunkar.auth', { token: 'tok.live', exp: Date.now() + 1_000_000, userId: 'u-owner' });

    const seen: HeadersInit[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (String(url).includes('/api/sync')) {
        seen.push(init.headers as HeadersInit);
        return new Response(JSON.stringify({ accepted: [], rejected: [], records: [], cursor: 0 }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }));

    await syncNow();
    expect(seen.length).toBeGreaterThan(0);
    for (const h of seen) {
      expect((h as Record<string, string>)['Authorization']).toBe('Bearer tok.live');
    }
  });
});

describe('H2 — pull drains all pages until a short page', () => {
  test('two full pages then a short page: cursor advances across all', async () => {
    // Bootstrap unit (no users) so no token is required for the pull.
    const PULL_LIMIT = 500;
    const page1 = Array.from({ length: PULL_LIMIT }, (_, i) => ({ ...mkRec({ id: `a${i}`, sync: 'synced' }), serverSeq: i + 1 }));
    const page2 = Array.from({ length: PULL_LIMIT }, (_, i) => ({ ...mkRec({ id: `b${i}`, sync: 'synced' }), serverSeq: PULL_LIMIT + i + 1 }));
    const page3 = [{ ...mkRec({ id: 'c0', sync: 'synced' }), serverSeq: 2 * PULL_LIMIT + 1 }];
    const pages = [page1, page2, page3];
    let call = 0;

    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (!String(url).includes('/api/sync')) return new Response('{}', { status: 200 });
      const body = JSON.parse(init.body as string);
      // First call is the push (records:[] here since nothing pending) — treat all
      // as pulls and serve sequential pages regardless.
      void body;
      const recs = pages[Math.min(call, pages.length - 1)];
      call += 1;
      const cursor = recs.length ? recs[recs.length - 1].serverSeq : body.since;
      return new Response(JSON.stringify({ accepted: [], rejected: [], records: recs, cursor }), { status: 200 });
    }));

    await syncNow();
    // All three pages applied → 1001 records stored.
    expect(records.size).toBe(2 * PULL_LIMIT + 1);
    // Cursor is at the last page's last seq.
    expect(meta.get('cursor')).toBe(2 * PULL_LIMIT + 1);
  });
});

describe('L3 — pull never flips a locally rejected record back to synced', () => {
  test('rejected record stays rejected when the server returns the same id', async () => {
    records.set('r1', mkRec({ id: 'r1', sync: 'rejected', rejectReason: 'duplicate_bazaar' }));
    const server = [{ ...mkRec({ id: 'r1', sync: 'synced' }), serverSeq: 5 }];
    let served = false;

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (!String(url).includes('/api/sync')) return new Response('{}', { status: 200 });
      const recs = served ? [] : server;
      served = true;
      return new Response(JSON.stringify({ accepted: [], rejected: [], records: recs, cursor: 5 }), { status: 200 });
    }));

    await syncNow();
    const r1 = records.get('r1')!;
    expect(r1.sync).toBe('rejected');
    expect(r1.rejectReason).toBe('duplicate_bazaar');
  });
});

describe('registerUnitIfNeeded', () => {
  test('no-ops when already registered', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await registerUnitIfNeeded();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('photos — every pending photo of the unit is uploaded and retried', () => {
  const okSync = () => new Response(JSON.stringify({ accepted: [], rejected: [], records: [], cursor: 0 }), { status: 200 });
  const photo = (id: string, over: Partial<PhotoMock> = {}): PhotoMock => ({ id, unitId: UNIT, sync: 'pending', mime: 'image/jpeg', blob: new Blob(['x']), ...over });

  test('uploads pending photos even when no pending record references them (e.g. avatars, earlier failures)', async () => {
    photoRows.set('p1', photo('p1'));
    photoRows.set('p2', photo('p2'));
    photoRows.set('p3', photo('p3', { unitId: 'other-unit' }));
    photoRows.set('p4', photo('p4', { sync: 'synced' }));
    const put: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).startsWith('/api/photos/') && init?.method === 'PUT') { put.push(String(url).split('/').pop()!); return new Response('{}', { status: 200 }); }
      if (String(url).includes('/api/sync')) return okSync();
      return new Response('{}', { status: 200 });
    }));
    await syncNow();
    expect(put.sort()).toEqual(['p1', 'p2']);
    expect(photoRows.get('p1')?.sync).toBe('synced');
    expect(photoRows.get('p2')?.sync).toBe('synced');
    expect(photoRows.get('p3')?.sync).toBe('pending'); // another unit's photo is never sent
  });

  test('a failed upload stays pending and succeeds on the next sync', async () => {
    photoRows.set('p1', photo('p1'));
    let status = 503;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).startsWith('/api/photos/') && init?.method === 'PUT') return new Response('{}', { status });
      if (String(url).includes('/api/sync')) return okSync();
      return new Response('{}', { status: 200 });
    }));
    await syncNow();
    expect(photoRows.get('p1')?.sync).toBe('pending');
    status = 200;
    await syncNow();
    expect(photoRows.get('p1')?.sync).toBe('synced');
  });

  test('a photo the server can never accept (415) is marked rejected, not retried forever', async () => {
    photoRows.set('p1', photo('p1', { mime: 'image/gif' }));
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).startsWith('/api/photos/') && init?.method === 'PUT') return new Response('{}', { status: 415 });
      if (String(url).includes('/api/sync')) return okSync();
      return new Response('{}', { status: 200 });
    }));
    await syncNow();
    expect(photoRows.get('p1')?.sync).toBe('rejected');
  });

  test('records are pushed before photos (money/wool entries never wait behind uploads)', async () => {
    records.set('r1', mkRec({ id: 'r1', type: 'user', sync: 'pending' }));
    photoRows.set('p1', photo('p1'));
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).startsWith('/api/photos/') && init?.method === 'PUT') { calls.push('photo'); return new Response('{}', { status: 200 }); }
      if (String(url).includes('/api/sync')) { calls.push('sync'); return new Response(JSON.stringify({ accepted: ['r1'], rejected: [], records: [], cursor: 1 }), { status: 200 }); }
      return new Response('{}', { status: 200 });
    }));
    await syncNow();
    expect(calls.indexOf('sync')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('photo')).toBeGreaterThan(calls.indexOf('sync'));
    expect(records.get('r1')?.sync).toBe('synced');
    expect(photoRows.get('p1')?.sync).toBe('synced');
  });
});
