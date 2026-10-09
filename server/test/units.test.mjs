import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, createUnit, authHeaders } from './helpers.mjs';

test('unit create + idempotent + auth failure', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());

  // health
  const h = await fetch(`${srv.base}/api/health`);
  assert.equal(h.status, 200);
  assert.deepEqual((await h.json()).ok, true);

  // create
  const c1 = await createUnit(srv.base, 'unit-1', 'secret-key-123', 'Bhadohi Looms');
  assert.equal(c1.status, 201);
  assert.equal(c1.body.created, true);

  // idempotent same key
  const c2 = await createUnit(srv.base, 'unit-1', 'secret-key-123');
  assert.equal(c2.status, 200);
  assert.equal(c2.body.created, false);

  // conflict wrong key
  const c3 = await createUnit(srv.base, 'unit-1', 'different-key');
  assert.equal(c3.status, 409);

  // sync with bad key → 401
  const bad = await fetch(`${srv.base}/api/sync`, {
    method: 'POST',
    headers: authHeaders('unit-1', 'wrong-key'),
    body: JSON.stringify({ records: [], since: 0 }),
  });
  assert.equal(bad.status, 401);

  // sync with no auth → 401
  const noauth = await fetch(`${srv.base}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: [], since: 0 }),
  });
  assert.equal(noauth.status, 401);
});
