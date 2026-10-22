// Serve the built PWA (app/dist) with SPA fallback. Hashed assets cache long; HTML + sw.js never.
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain', '.map': 'application/json' };

export async function serveStatic(dir, urlPath, req, res) {
  let rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  if (rel === '/' || rel === '') rel = '/index.html';
  let file = join(dir, rel);
  if (!file.startsWith(dir)) { res.writeHead(403); res.end(); return; }
  let st; try { st = statSync(file); if (st.isDirectory()) throw new Error('dir'); } catch { file = join(dir, 'index.html'); try { st = statSync(file); } catch { res.writeHead(404); res.end('not found'); return; } }
  const ext = extname(file);
  const hashed = /\/assets\//.test(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(file).pipe(res);
}
