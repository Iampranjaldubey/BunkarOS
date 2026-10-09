import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, createUnit, authHeaders } from './helpers.mjs';

const KEY = 'secret-key-123';

test('M3: photo upload rejects non-image MIME with 415', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await createUnit(srv.base, 'unit-1', KEY);

  const html = Buffer.from('<script>alert(1)</script>');
  const res = await fetch(`${srv.base}/api/photos/evil`, {
    method: 'PUT',
    headers: { ...authHeaders('unit-1', KEY), 'Content-Type': 'text/html' },
    body: html,
  });
  assert.equal(res.status, 415);
  assert.equal((await res.json()).error, 'unsupported_media_type');
});

test('M3: allowed image types stored; GET sets nosniff + inline disposition', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  await createUnit(srv.base, 'unit-1', KEY);

  for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
    const id = `p-${mime.replace('/', '-')}`;
    const put = await fetch(`${srv.base}/api/photos/${id}`, {
      method: 'PUT',
      headers: { ...authHeaders('unit-1', KEY), 'Content-Type': mime },
      body: Buffer.from([1, 2, 3, 4]),
    });
    assert.equal(put.status, 200, `${mime} accepted`);
    const get = await fetch(`${srv.base}/api/photos/${id}`, { headers: authHeaders('unit-1', KEY) });
    assert.equal(get.status, 200);
    assert.equal(get.headers.get('content-type'), mime);
    assert.equal(get.headers.get('x-content-type-options'), 'nosniff');
    assert.ok((get.headers.get('content-disposition') || '').includes('inline'));
  }
});

test('M3: all API JSON responses carry nosniff + locked CSP', async (t) => {
  const srv = await startTestServer();
  t.after(() => srv.stop());
  const h = await fetch(`${srv.base}/api/health`);
  assert.equal(h.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(h.headers.get('content-security-policy'), "default-src 'none'");
});
