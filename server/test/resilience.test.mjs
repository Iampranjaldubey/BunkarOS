// Hosted Postgres (Neon) suspends and drops connections. A dropped connection must never take the server down.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { startTestServer } from './helpers.mjs';
import { withUnit } from '../db.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let srv; let killer;
before(async () => {
  srv = await startTestServer();
  killer = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://bunkar:bunkar@localhost:5432/bunkar', max: 1 });
});
after(async () => { await killer.end(); await srv.stop(); });

const kill = (pid) => killer.query('SELECT pg_terminate_backend($1)', [pid]);
const stillServing = async () => {
  assert.equal((await srv.instance.db.pool.query('SELECT 1 AS ok')).rows[0].ok, 1);
  assert.equal((await fetch(`${srv.base}/api/health`)).status, 200);
};

test('an idle pooled connection dropped by the database does not crash the server', async () => {
  const { pid } = (await srv.instance.db.pool.query('SELECT pg_backend_pid() AS pid')).rows[0];
  await kill(pid);
  await wait(200);
  await stillServing();
});

test('a connection dropped in the middle of a request fails that request only', async () => {
  await assert.rejects(withUnit(srv.instance.db, 'unit-x', async (u) => {
    const { pid } = (await u.pool.query('SELECT pg_backend_pid() AS pid')).rows[0];
    await kill(pid);
    await wait(200);
    await u.pool.query('SELECT 1');
  }));
  await stillServing();
});
