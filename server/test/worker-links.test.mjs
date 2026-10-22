import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, bootstrapUnit, makeRec, sync, UNIT_KEY, authHeaders } from './helpers.mjs';

let srv, unitId, ownerId, token, shortCode;
const W1 = 'w-rafiq';
test.before(async () => {
  srv = await startTestServer();
  ({ unitId, ownerId, token } = await bootstrapUnit(srv.base));
  const me = await fetch(`${srv.base}/api/units/me`, { headers: authHeaders(unitId, UNIT_KEY) });
  shortCode = (await me.json()).shortCode;
  assert.match(shortCode, /^\d{6}$/);
  const recs = [
    makeRec('worker', { entityId: W1, name: 'Rafiq', jobTitle: 'weaver', payType: 'monthly', salaryPaise: 1200000, otRatePaise: 5800, joinedOn: '2026-01-01', active: true, accessCode: '4821' }, { unitId, by: ownerId }),
    makeRec('attendance', { workerId: W1, status: 'present', otHours: 2 }, { unitId, by: ownerId, day: '2026-10-03' }),
    makeRec('attendance', { workerId: 'someone-else', status: 'absent', otHours: 0 }, { unitId, by: ownerId, day: '2026-10-03' }),
    makeRec('advance', { workerId: W1, amountPaise: 100000, mode: 'cash' }, { unitId, by: ownerId, day: '2026-10-05' }),
  ];
  const r = await sync(srv.base, unitId, UNIT_KEY, recs, 0, token);
  assert.equal(r.body.rejected.length, 0);
});
test.after(async () => { await srv.stop(); });

test('owner creates a link; the public page returns only that worker\'s records, never the access code', async () => {
  const r = await fetch(`${srv.base}/api/worker-links`, { method: 'POST', headers: authHeaders(unitId, UNIT_KEY, token), body: JSON.stringify({ workerId: W1 }) });
  assert.equal(r.status, 201);
  const { token: wt } = await r.json();
  const d = await fetch(`${srv.base}/api/w/${wt}`);
  assert.equal(d.status, 200);
  const body = await d.json();
  assert.equal(body.worker.name, 'Rafiq');
  assert.equal(body.worker.accessCode, undefined);
  assert.equal(body.shopCode, shortCode);
  const types = body.records.map((x) => x.type).sort();
  assert.deepEqual(types, ['advance', 'attendance', 'setting', 'user'].filter((t) => t !== 'user'));
  assert.ok(body.records.every((x) => x.type !== 'attendance' || x.payload.workerId === W1), 'no other worker\'s attendance');
  // same link returned again unless regenerate
  const again = await fetch(`${srv.base}/api/worker-links`, { method: 'POST', headers: authHeaders(unitId, UNIT_KEY, token), body: JSON.stringify({ workerId: W1 }) });
  assert.equal((await again.json()).token, wt);
});

test('shop code → names → claim with the 4-digit code; wrong code refused', async () => {
  const shop = await fetch(`${srv.base}/api/w/shop/${shortCode}`);
  assert.equal(shop.status, 200);
  const sb = await shop.json();
  assert.equal(sb.unitName, 'Test Unit');
  assert.deepEqual(sb.workers.map((w) => w.name), ['Rafiq']);
  const bad = await fetch(`${srv.base}/api/w/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopCode: shortCode, workerId: W1, code: '0000' }) });
  assert.equal(bad.status, 401);
  const ok = await fetch(`${srv.base}/api/w/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopCode: shortCode, workerId: W1, code: '4821' }) });
  assert.equal(ok.status, 200);
  const { token: wt } = await ok.json();
  assert.equal((await fetch(`${srv.base}/api/w/${wt}`)).status, 200);
  assert.equal((await fetch(`${srv.base}/api/w/shop/000000`)).status, 404);
});

test('regenerate revokes the old link (410); revoke endpoint kills all; unknown token 404', async () => {
  const first = await (await fetch(`${srv.base}/api/worker-links`, { method: 'POST', headers: authHeaders(unitId, UNIT_KEY, token), body: JSON.stringify({ workerId: W1 }) })).json();
  const second = await (await fetch(`${srv.base}/api/worker-links`, { method: 'POST', headers: authHeaders(unitId, UNIT_KEY, token), body: JSON.stringify({ workerId: W1, regenerate: true }) })).json();
  assert.notEqual(first.token, second.token);
  assert.equal((await fetch(`${srv.base}/api/w/${first.token}`)).status, 410);
  assert.equal((await fetch(`${srv.base}/api/w/${second.token}`)).status, 200);
  const rev = await fetch(`${srv.base}/api/worker-links/revoke`, { method: 'POST', headers: authHeaders(unitId, UNIT_KEY, token), body: JSON.stringify({ workerId: W1 }) });
  assert.equal(rev.status, 204);
  assert.equal((await fetch(`${srv.base}/api/w/${second.token}`)).status, 410);
  assert.equal((await fetch(`${srv.base}/api/w/${'x'.repeat(32)}`)).status, 404);
});

test('a token holder without a login cannot create links', async () => {
  const r = await fetch(`${srv.base}/api/worker-links`, { method: 'POST', headers: authHeaders(unitId, UNIT_KEY), body: JSON.stringify({ workerId: W1 }) });
  assert.equal(r.status, 401);
});
