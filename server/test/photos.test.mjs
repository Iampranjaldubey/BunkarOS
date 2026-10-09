import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, createUnit, authHeaders } from './helpers.mjs';

const KEY = 'secret-key-123';

test('photo put/get with auth; 401 without auth', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await createUnit(srv.base, 'unit-1', KEY);

  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]); // fake jpeg header
  const put = await fetch(`${srv.base}/api/photos/photo-1`, {
    method: 'PUT',
    headers: { ...authHeaders('unit-1', KEY), 'Content-Type': 'image/jpeg' },
    body: bytes,
  });
  assert.equal(put.status, 200);

  const get = await fetch(`${srv.base}/api/photos/photo-1`, {
    headers: authHeaders('unit-1', KEY),
  });
  assert.equal(get.status, 200);
  assert.equal(get.headers.get('content-type'), 'image/jpeg');
  const got = Buffer.from(await get.arrayBuffer());
  assert.deepEqual(got, bytes);

  // No auth → 401 on both.
  const putNoAuth = await fetch(`${srv.base}/api/photos/photo-2`, { method: 'PUT', body: bytes });
  assert.equal(putNoAuth.status, 401);
  const getNoAuth = await fetch(`${srv.base}/api/photos/photo-1`);
  assert.equal(getNoAuth.status, 401);

  // Unknown photo → 404.
  const missing = await fetch(`${srv.base}/api/photos/nope`, { headers: authHeaders('unit-1', KEY) });
  assert.equal(missing.status, 404);
});
