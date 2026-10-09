// Bunkar OS — SPEC-014 one-device-per-login + remote sign-out (server rules).
// Covers: bind, same-device refresh, non-owner 409 device_bound on a new device,
// owner takeover, owner signout frees the binding, revoked token → 401 on sync
// and photo, non-owner device APIs → 403, unknown user → 404, and three users
// sharing ONE phone all work.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestServer, sync, makeRec, bootstrapOwner, getToken, hashPin, authHeaders,
} from './helpers.mjs';

const KEY = 'secret-key-123';
const DEV_A = 'device-aaaaaaaa';
const DEV_B = 'device-bbbbbbbb';

/** Add a non-owner user authored by the owner token; returns {entityId, pin}. */
async function addUser(base, token, over = {}) {
  const entityId = over.entityId || 'u-munshi';
  const pin = over.pin || '1111';
  const role = over.role || 'munshi';
  const { pinHash, pinSalt } = hashPin(pin);
  const rec = makeRec(
    'user',
    { entityId, name: over.name || 'Munshi', phone: '9811111111', role, pinHash, pinSalt, active: true,
      ...(over.thekedarId ? { thekedarId: over.thekedarId } : {}) },
    { by: 'u-owner', role: 'owner' },
  );
  await sync(base, 'unit-1', KEY, [rec], 0, token);
  return { entityId, pin };
}

async function devicesList(base, token) {
  const res = await fetch(`${base}/api/devices`, {
    method: 'GET',
    headers: authHeaders('unit-1', KEY, token),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

async function signout(base, token, userId) {
  const res = await fetch(`${base}/api/devices/${encodeURIComponent(userId)}/signout`, {
    method: 'POST',
    headers: authHeaders('unit-1', KEY, token),
  });
  return { status: res.status };
}

test('token request binds the device on first login', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: DEV_A });
  const list = await devicesList(srv.base, token);
  assert.equal(list.status, 200);
  const owner = list.body.devices.find((d) => d.userId === 'u-owner' && !d.revokedAt);
  assert.ok(owner, 'owner has an active binding');
  assert.equal(owner.deviceId, DEV_A);
  assert.ok(typeof owner.boundAt === 'string' && owner.boundAt.length > 0);
});

test('auth/token requires a deviceId (8..80 chars)', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: DEV_A });
  const res = await fetch(`${srv.base}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unitId: 'unit-1', unitKey: KEY, userId: 'u-owner', pin: '1234' }),
  });
  assert.equal(res.status, 400);
  // too short
  const short = await getToken(srv.base, 'unit-1', KEY, 'u-owner', '1234', 'short');
  assert.equal(short.status, 400);
});

test('same-device re-login refreshes without conflict', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: DEV_A });
  const { entityId, pin } = await addUser(srv.base, token);
  const first = await getToken(srv.base, 'unit-1', KEY, entityId, pin, DEV_A);
  assert.equal(first.status, 200);
  const again = await getToken(srv.base, 'unit-1', KEY, entityId, pin, DEV_A);
  assert.equal(again.status, 200, 'same device re-login refreshes the token');
  // Still exactly one active binding on DEV_A.
  const list = await devicesList(srv.base, token);
  const active = list.body.devices.filter((d) => d.userId === entityId && !d.revokedAt);
  assert.equal(active.length, 1);
  assert.equal(active[0].deviceId, DEV_A);
});

test('munshi on a second device → 409 device_bound', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: DEV_A });
  const { entityId, pin } = await addUser(srv.base, token);
  const bind = await getToken(srv.base, 'unit-1', KEY, entityId, pin, DEV_A);
  assert.equal(bind.status, 200);
  const conflict = await getToken(srv.base, 'unit-1', KEY, entityId, pin, DEV_B);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error, 'device_bound');
  assert.ok(typeof conflict.body.boundAt === 'string' && conflict.body.boundAt.length > 0);
});

test('thekedar on a second device → 409 device_bound', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: DEV_A });
  const { entityId, pin } = await addUser(srv.base, token, { entityId: 'u-th', role: 'thekedar', pin: '2222' });
  await getToken(srv.base, 'unit-1', KEY, entityId, pin, DEV_A);
  const conflict = await getToken(srv.base, 'unit-1', KEY, entityId, pin, DEV_B);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error, 'device_bound');
});

test('owner on a new device → takeover (old binding revoked by owner)', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: DEV_A });
  // Owner logs in on a NEW phone — succeeds (never locks himself out).
  const takeover = await getToken(srv.base, 'unit-1', KEY, 'u-owner', '1234', DEV_B);
  assert.equal(takeover.status, 200);
  // New token works on the device list; the old DEV_A binding is revoked_by owner.
  const list = await devicesList(srv.base, takeover.body.token);
  assert.equal(list.status, 200);
  const owner = list.body.devices.filter((d) => d.userId === 'u-owner');
  const active = owner.filter((d) => !d.revokedAt);
  assert.equal(active.length, 1);
  assert.equal(active[0].deviceId, DEV_B);
  const revoked = owner.find((d) => d.deviceId === DEV_A && d.revokedAt);
  assert.ok(revoked, 'old owner device appears in history as revoked');
  assert.equal(revoked.revokedBy, 'owner');
});

test('revoked owner token → 401 device_revoked on sync', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token: oldToken } = await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: DEV_A });
  // Takeover revokes DEV_A.
  await getToken(srv.base, 'unit-1', KEY, 'u-owner', '1234', DEV_B);
  const loom = makeRec('loom', { entityId: 'l-r', code: 'R', village: 'X', widthIn: 72, weaverIds: [], active: true });
  const res = await fetch(`${srv.base}/api/sync`, {
    method: 'POST',
    headers: authHeaders('unit-1', KEY, oldToken),
    body: JSON.stringify({ records: [loom], since: 0 }),
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'device_revoked');
});

test('owner signout frees a munshi binding; munshi re-binds on a new device', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: DEV_A });
  const { entityId, pin } = await addUser(srv.base, token);
  const munshiTok = await getToken(srv.base, 'unit-1', KEY, entityId, pin, DEV_B);
  assert.equal(munshiTok.status, 200);
  // Owner signs the munshi's phone out.
  const so = await signout(srv.base, token, entityId);
  assert.equal(so.status, 204);
  // Munshi's old token is now revoked on sync.
  const loom = makeRec('loom', { entityId: 'l-x', code: 'X', village: 'X', widthIn: 72, weaverIds: [], active: true });
  const revokedRes = await fetch(`${srv.base}/api/sync`, {
    method: 'POST',
    headers: authHeaders('unit-1', KEY, munshiTok.body.token),
    body: JSON.stringify({ records: [loom], since: 0 }),
  });
  assert.equal(revokedRes.status, 401);
  assert.equal((await revokedRes.json()).error, 'device_revoked');
  // The munshi can now bind a fresh device (binding was freed).
  const rebind = await getToken(srv.base, 'unit-1', KEY, entityId, pin, 'device-cccccccc');
  assert.equal(rebind.status, 200);
  // History shows the signed-out binding was revoked_by owner.
  const list = await devicesList(srv.base, token);
  const revoked = list.body.devices.find((d) => d.userId === entityId && d.deviceId === DEV_B && d.revokedAt);
  assert.ok(revoked, 'signed-out device is in history');
  assert.equal(revoked.revokedBy, 'owner');
});

test('revoked token → 401 device_revoked on photo PUT and GET', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: DEV_A });
  const { entityId, pin } = await addUser(srv.base, token);
  const munshiTok = await getToken(srv.base, 'unit-1', KEY, entityId, pin, DEV_B);
  await signout(srv.base, token, entityId);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const put = await fetch(`${srv.base}/api/photos/p-1`, {
    method: 'PUT',
    headers: { 'x-unit-id': 'unit-1', 'x-unit-key': KEY, 'Content-Type': 'image/png', Authorization: `Bearer ${munshiTok.body.token}` },
    body: png,
  });
  assert.equal(put.status, 401);
  assert.equal((await put.json()).error, 'device_revoked');
  const get = await fetch(`${srv.base}/api/photos/p-1`, {
    method: 'GET',
    headers: { 'x-unit-id': 'unit-1', 'x-unit-key': KEY, Authorization: `Bearer ${munshiTok.body.token}` },
  });
  assert.equal(get.status, 401);
  assert.equal((await get.json()).error, 'device_revoked');
});

test('photos still work with a valid (non-revoked) token', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: DEV_A });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const put = await fetch(`${srv.base}/api/photos/p-ok`, {
    method: 'PUT',
    headers: { 'x-unit-id': 'unit-1', 'x-unit-key': KEY, 'Content-Type': 'image/png', Authorization: `Bearer ${token}` },
    body: png,
  });
  assert.equal(put.status, 200);
  const get = await fetch(`${srv.base}/api/photos/p-ok`, {
    method: 'GET',
    headers: { 'x-unit-id': 'unit-1', 'x-unit-key': KEY, Authorization: `Bearer ${token}` },
  });
  assert.equal(get.status, 200);
});

test('non-owner cannot list or sign out devices → 403', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: DEV_A });
  const { entityId, pin } = await addUser(srv.base, token);
  const munshiTok = await getToken(srv.base, 'unit-1', KEY, entityId, pin, DEV_B);
  const list = await devicesList(srv.base, munshiTok.body.token);
  assert.equal(list.status, 403);
  const so = await signout(srv.base, munshiTok.body.token, 'u-owner');
  assert.equal(so.status, 403);
});

test('signout of an unknown user → 404', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: DEV_A });
  const so = await signout(srv.base, token, 'no-such-user');
  assert.equal(so.status, 404);
});

test('three users share ONE office phone → all log in and sync', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const SHARED = 'device-shared01';
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: SHARED });
  const munshi = await addUser(srv.base, token, { entityId: 'u-m', role: 'munshi', pin: '1111' });
  const th = await addUser(srv.base, token, { entityId: 'u-t', role: 'thekedar', pin: '2222' });
  // All three bind the SAME shared phone.
  const mTok = await getToken(srv.base, 'unit-1', KEY, munshi.entityId, munshi.pin, SHARED);
  const tTok = await getToken(srv.base, 'unit-1', KEY, th.entityId, th.pin, SHARED);
  assert.equal(mTok.status, 200);
  assert.equal(tTok.status, 200);
  // Each syncs with its own token on the shared device without a device conflict.
  const r1 = await sync(srv.base, 'unit-1', KEY, [], 0, mTok.body.token);
  const r2 = await sync(srv.base, 'unit-1', KEY, [], 0, tTok.body.token);
  const r3 = await sync(srv.base, 'unit-1', KEY, [], 0, token);
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  assert.equal(r3.status, 200);
});

test('last_seen_at advances on sync', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const { token } = await bootstrapOwner(srv.base, 'unit-1', KEY, { deviceId: DEV_A });
  await sync(srv.base, 'unit-1', KEY, [], 0, token);
  const list = await devicesList(srv.base, token);
  const owner = list.body.devices.find((d) => d.userId === 'u-owner' && !d.revokedAt);
  assert.ok(owner.lastSeenAt, 'last seen is recorded');
});
