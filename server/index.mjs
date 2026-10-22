// Bunkar MVP server — entry. Node 24 + pg. Serves /api and (in prod) the built app.
import http from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.mjs';
import { makeHandler } from './routes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @param {{connectionString?:string, schema?:string, port?:number, host?:string, staticDir?:string|null}} [opts] */
export async function createServer(opts = {}) {
  const port = opts.port ?? Number(process.env.PORT || 8791);
  const host = opts.host ?? process.env.HOST ?? undefined;
  const db = await openDb({ connectionString: opts.connectionString, schema: opts.schema });
  const defaultStatic = resolve(__dirname, '..', 'app', 'dist');
  const staticDir = opts.staticDir === null ? null : (opts.staticDir ?? (process.env.SERVE_APP === '0' ? null : (existsSync(defaultStatic) ? defaultStatic : null)));
  const handler = makeHandler(db, { staticDir });
  const server = http.createServer((req, res) => { handler(req, res).catch(() => { if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'server_error' })); } }); });
  const listen = () => new Promise((r) => server.listen(port, host, () => { const a = server.address(); r(typeof a === 'object' && a ? a.port : port); }));
  const close = () => new Promise((r) => server.close(async () => { try { await db.close(); } catch { /* closed */ } r(); }));
  return { server, db, listen, close, port, staticDir };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  createServer().then((inst) => inst.listen().then((p) => {
    console.log(`Bunkar MVP API on http://localhost:${p}${inst.staticDir ? ' (serving app from ' + inst.staticDir + ')' : ''}`);
    const shutdown = () => inst.close().then(() => process.exit(0));
    process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  })).catch((e) => { console.error(e); process.exit(1); });
}
