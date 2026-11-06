// The login rate limits key on this address, so a client must not be able to choose it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './env.mjs';
import { clientIpFrom } from '../routes.mjs';

test('without a trusted proxy, forwarded headers are ignored', () => {
  assert.equal(clientIpFrom({ 'x-forwarded-for': '1.1.1.1', 'cf-connecting-ip': '2.2.2.2' }, '9.9.9.9', false), '9.9.9.9');
});
test('behind a proxy, a faked first X-Forwarded-For entry is not used', () => {
  assert.equal(clientIpFrom({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7' }, '9.9.9.9', true), '7.7.7.7');
});
test('behind Cloudflare, CF-Connecting-IP wins over X-Forwarded-For', () => {
  assert.equal(clientIpFrom({ 'cf-connecting-ip': ' 2.2.2.2 ', 'x-forwarded-for': '6.6.6.6, 7.7.7.7' }, '9.9.9.9', true), '2.2.2.2');
});
test('behind a proxy with no forwarded headers, the socket address is used', () => {
  assert.equal(clientIpFrom({}, '9.9.9.9', true), '9.9.9.9');
  assert.equal(clientIpFrom({ 'x-forwarded-for': ' , ' }, undefined, true), 'unknown');
});
