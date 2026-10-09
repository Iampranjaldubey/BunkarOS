// Bunkar OS server — entry point. Zero deps, Node 24 ESM.
// Exports createServer({dbPath, port}) for tests; starts a server when run directly.
import http from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.mjs';
import { makeHandler } from './routes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create (but do not auto-listen) a Bunkar OS API server.
 * @param {{dbPath?:string, port?:number, host?:string}} [opts]
 * @returns {{server: import('node:http').Server, db: import('node:sqlite').DatabaseSync,
 *            listen: ()=>Promise<number>, close: ()=>Promise<void>, port: number}}
 */
export function createServer(opts = {}) {
  const dbPath = opts.dbPath || process.env.BUNKAR_DB || resolve(__dirname, 'data', 'bunkar.db');
  const port = opts.port ?? Number(process.env.PORT || 8787);
  // HOST lets a local deployment bind to loopback only (e.g. HOST=127.0.0.1); default = all interfaces.
  const host = opts.host ?? process.env.HOST ?? undefined;

  // Ensure the data directory exists (unless using an in-memory / :memory: db).
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = openDb(dbPath);
  const handler = makeHandler(db);
  const server = http.createServer((req, res) => {
    handler(req, res).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'server_error' }));
      }
    });
  });

  function listen() {
    return new Promise((resolveListen) => {
      server.listen(port, host, () => {
        const addr = server.address();
        resolveListen(typeof addr === 'object' && addr ? addr.port : port);
      });
    });
  }

  function close() {
    return new Promise((resolveClose) => {
      server.close(() => {
        try {
          db.close();
        } catch {
          /* already closed */
        }
        resolveClose();
      });
    });
  }

  return { server, db, listen, close, port };
}

// CLI: start the server if this module is the entry point.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const instance = createServer();
  instance.listen().then((p) => {
    // eslint-disable-next-line no-console
    console.log(`Bunkar OS server listening on http://localhost:${p}`);
  });
  const shutdown = () => instance.close().then(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
