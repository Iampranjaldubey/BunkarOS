import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, createUnit, sync, makeRec, bootstrapOwner, getToken, hashPin, authHeaders } from './helpers.mjs';
import { signToken, verifyToken } from '../token.mjs';
import { openDb } from '../db.mjs';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const KEY = 'secret-key-123';

test('auth/token: owner can obtain a 30-day token with correct PIN', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await bootstrapOwner(srv.base, 'unit-1', KEY, { pin: '4321' });

  const ok = await getToken(srv.base, 'unit-1', KEY, 'u-owner', '4321');
  assert.equal(ok.status, 200);
  assert.ok(typeof ok.body.token === 'string' && ok.body.token.includes('.'));
  // exp roughly 30 days out.
  const days = (ok.body.exp - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(days > 29 && days < 31);
});

test('auth/token: wrong PIN → 401', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await bootstrapOwner(srv.base, 'unit-1', KEY, { pin: '4321' });
  const bad = await getToken(srv.base, 'unit-1', KEY, 'u-owner', '0000');
  assert.equal(bad.status, 401);
});

test('auth/token: wrong unit key → 401', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await bootstrapOwner(srv.base, 'unit-1', KEY, { pin: '4321' });
  const res = await fetch(`${srv.base}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unitId: 'unit-1', unitKey: 'wrong', userId: 'u-owner', pin: '4321' }),
  });
  assert.equal(res.status, 401);
});

test('auth/token: inactive user → 401', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  // Add then deactivate a munshi.
  const { pinHash, pinSalt } = hashPin('1111');
  const u1 = makeRec('user', { entityId: 'm1', name: 'M', phone: '9', role: 'munshi', pinHash, pinSalt, active: true }, { by: 'u-owner' });
  await sync(srv.base, 'unit-1', KEY, [u1], 0, token);
  const u2 = makeRec('user', { entityId: 'm1', name: 'M', phone: '9', role: 'munshi', pinHash, pinSalt, active: false }, { by: 'u-owner', at: new Date(Date.now() + 1000).toISOString() });
  await sync(srv.base, 'unit-1', KEY, [u2], 0, token);
  const res = await getToken(srv.base, 'unit-1', KEY, 'm1', '1111');
  assert.equal(res.status, 401);
});

test('sync: tampered Bearer token → needs_login', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY);
  const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
  const loom = makeRec('loom', { entityId: 'l-t', code: 'T', village: 'X', widthIn: 72, weaverIds: [], active: true });
  const res = await fetch(`${srv.base}/api/sync`, {
    method: 'POST',
    headers: authHeaders('unit-1', KEY, tampered),
    body: JSON.stringify({ records: [loom], since: 0 }),
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'needs_login');
});

test('token: expired token verifies as null (unit test)', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'bunkar-tok-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const db = openDb(join(dir, 't.db'));
  const { token } = signToken(db, { unitId: 'u', userId: 'x', exp: Date.now() - 1000 });
  assert.equal(verifyToken(db, token), null);
  const good = signToken(db, { unitId: 'u', userId: 'x', exp: Date.now() + 60_000 });
  const dec = verifyToken(db, good.token);
  assert.equal(dec.userId, 'x');
  assert.equal(dec.unitId, 'u');
  db.close();
});
