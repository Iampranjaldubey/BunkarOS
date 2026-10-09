// Bunkar OS — slip audio route handler (SPEC-015 C9).
//
// GET /api/slips/:token/audio → a short mono 11025 Hz 16-bit PCM WAV of the
// slip's Hindi `speechHi` (falling back to `textHi`). The GPL-3.0 espeak-ng
// engine runs as a SEPARATE child process (`server/tts/synth.mjs`); this file
// imports nothing from it, so the zero-dependency server stays clean and a
// missing engine degrades gracefully (503 tts_unavailable → page falls back to
// on-device speechSynthesis).
//
// The controller wires this into routes.mjs; the handler here is self-contained
// and spawns the synth lazily.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getSlip } from './db.mjs';

const SLIP_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90-day lifetime (matches routes.mjs H4)
const SYNTH_TIMEOUT_MS = 10_000;              // kill the engine after 10 s
const MAX_WAV_BYTES = 11025 * 2 * 60 + 44;    // 60 s mono 11025 Hz 16-bit + header

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SYNTH = join(HERE, 'tts', 'synth.mjs');

/** Lazily create the per-token audio cache table. */
function ensureCacheTable(db) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS slip_audio (' +
      'token TEXT PRIMARY KEY, wav BLOB NOT NULL, created_at TEXT NOT NULL)',
  );
}

function readCache(db, token) {
  const row = db.prepare('SELECT wav FROM slip_audio WHERE token = ?').get(token);
  return row && row.wav ? Buffer.from(row.wav) : undefined;
}

function writeCache(db, token, wav) {
  db.prepare(
    'INSERT INTO slip_audio (token, wav, created_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(token) DO UPDATE SET wav = excluded.wav, created_at = excluded.created_at',
  ).run(token, wav, new Date().toISOString());
}

function slipExpired(slip) {
  if (!slip.created_at) return false; // legacy rows never expire
  const created = Date.parse(slip.created_at);
  if (Number.isNaN(created)) return false;
  return Date.now() - created > SLIP_TTL_MS;
}

/**
 * Spawn `node <synthPath>` feeding `text` on stdin, resolving the WAV buffer.
 * Rejects on non-zero exit, spawn error (missing engine), timeout, or if the
 * output is not a RIFF/WAVE buffer. The caller maps any rejection to 503.
 */
function synthesize(synthPath, text) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(process.execPath, [synthPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      reject(err);
      return;
    }
    const chunks = [];
    let total = 0;
    let settled = false;
    const done = (fn, arg) => { if (!settled) { settled = true; clearTimeout(timer); fn(arg); } };

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      done(reject, new Error('tts_timeout'));
    }, SYNTH_TIMEOUT_MS);

    child.on('error', (err) => done(reject, err)); // ENOENT etc.
    child.stdout.on('data', (c) => {
      total += c.length;
      if (total > MAX_WAV_BYTES + 4096) { // generous overflow guard
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
        done(reject, new Error('tts_too_large'));
        return;
      }
      chunks.push(c);
    });
    child.stdout.on('error', () => { /* ignore; handled via close/error */ });
    child.on('close', (code) => {
      if (code !== 0) { done(reject, new Error(`tts_exit_${code}`)); return; }
      const wav = Buffer.concat(chunks);
      if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
        done(reject, new Error('tts_bad_output'));
        return;
      }
      done(resolve, wav);
    });

    // Feed the text and close stdin.
    child.stdin.on('error', () => { /* child may have died; close handles it */ });
    child.stdin.end(Buffer.from(text, 'utf8'));
  });
}

/**
 * Handle GET /api/slips/:token/audio.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {{ db: import('node:sqlite').DatabaseSync, token: string,
 *           sendError: (res, status, error, req?) => void,
 *           synthPath?: string }} ctx
 */
export async function handleSlipAudio(req, res, { db, token, sendError, synthPath }) {
  if (typeof token !== 'string' || token.length < 22) {
    return sendError(res, 404, 'not_found', req);
  }
  const slip = getSlip(db, token);
  if (!slip) return sendError(res, 404, 'not_found', req);
  if (slipExpired(slip)) return sendError(res, 410, 'expired', req);

  ensureCacheTable(db);

  let wav = readCache(db, token);
  if (!wav) {
    let payload;
    try { payload = JSON.parse(slip.json); } catch { payload = {}; }
    const text = (payload.speechHi || payload.textHi || '').trim();
    if (!text) return sendError(res, 503, 'tts_unavailable', req);
    try {
      wav = await synthesize(synthPath || DEFAULT_SYNTH, text);
    } catch {
      return sendError(res, 503, 'tts_unavailable', req);
    }
    try { writeCache(db, token, wav); } catch { /* non-fatal: still serve */ }
  }

  res.writeHead(200, {
    'Content-Type': 'audio/wav',
    'Content-Length': wav.length,
    'Cache-Control': 'private, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(wav);
  return undefined;
}
