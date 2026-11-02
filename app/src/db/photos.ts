import { db } from './db';
import type { PhotoRow } from './types';
import { uuid } from '../domain/ids';
import { getStoredSession } from '../lib/session-store';

const MAX_DIM = 1280;
const JPEG_QUALITY = 0.7;
/** D8 / SPEC-M15 AC9: every stored photo is a JPEG of at most 300 KB (the server refuses > 400 KB). */
export const MAX_PHOTO_BYTES = 300 * 1024;

// Cache object URLs so repeated <img src> for the same photo don't leak URLs.
const urlCache = new Map<string, string>();

/**
 * Load a File/Blob into an ImageBitmap (fast path) or HTMLImageElement.
 */
async function loadBitmap(file: Blob): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }> {
  if (typeof createImageBitmap === 'function') {
    const bmp = await createImageBitmap(file);
    return {
      width: bmp.width,
      height: bmp.height,
      draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image decode failed'));
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Compress and store a photo. Returns the new photo id.
 * Downscales so the longest edge is ≤ 1280px, re-encodes as JPEG q≈0.7.
 */
export async function savePhoto(file: File | Blob): Promise<string> {
  const session = getStoredSession();
  if (!session?.unitId) {
    // M4: never tag a photo with a placeholder unit — a later push would bind
    // it to whatever unit is active, risking cross-unit mixing on shared devices.
    throw new Error('savePhoto: no active session');
  }
  const unitId = session.unitId;

  const src = await loadBitmap(file);
  // Longest edge ≤ 1280 px, JPEG q 0.7; if that is still above 300 KB, lower the quality, then the size.
  let dim = MAX_DIM; let quality = JPEG_QUALITY;
  let blob: Blob; let w: number; let h: number;
  for (;;) {
    const scale = Math.min(1, dim / Math.max(src.width, src.height));
    w = Math.max(1, Math.round(src.width * scale));
    h = Math.max(1, Math.round(src.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    src.draw(ctx, w, h);
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/jpeg', quality);
    });
    if (blob.size <= MAX_PHOTO_BYTES || dim <= 320) break;
    if (quality > 0.45) quality -= 0.1; else dim = Math.round(dim * 0.8);
  }

  const id = uuid();
  const row: PhotoRow = {
    id,
    unitId,
    blob: blob!,
    mime: 'image/jpeg',
    w: w!,
    h: h!,
    at: new Date().toISOString(),
    sync: 'pending',
  };
  await db.photos.put(row);
  return id;
}

/** Fetch the raw blob for a photo id. */
export async function getPhotoBlob(id: string): Promise<Blob | undefined> {
  const row = await db.photos.get(id);
  return row?.blob;
}

/** Set by the sync module: loads a photo another phone uploaded (GET /api/photos/:id with the user's login). */
let remoteLoader: ((id: string) => Promise<Blob | null>) | null = null;
export function setRemotePhotoLoader(fn: ((id: string) => Promise<Blob | null>) | null): void { remoteLoader = fn; }
const inflight = new Map<string, Promise<Blob | null>>();
/** Photos the server did not have (not uploaded yet by their phone): asked again after a minute, not on every render. */
const missing = new Map<string, number>();
const RETRY_MISSING_MS = 60_000;

/** A photo that is not on this phone yet is fetched once from the server and kept (synced) for offline use. */
async function fetchRemote(id: string): Promise<Blob | null> {
  if (!remoteLoader) return null;
  const missedAt = missing.get(id);
  if (missedAt !== undefined && Date.now() - missedAt < RETRY_MISSING_MS) return null;
  let p = inflight.get(id);
  if (!p) {
    p = (async () => {
      try {
        const blob = await remoteLoader!(id);
        const session = getStoredSession();
        if (!blob) missing.set(id, Date.now()); else missing.delete(id);
        if (blob && session) await db.photos.put({ id, unitId: session.unitId, blob, mime: blob.type || 'image/jpeg', w: 0, h: 0, at: new Date().toISOString(), sync: 'synced' });
        return blob;
      } catch { return null; } finally { inflight.delete(id); }
    })();
    inflight.set(id, p);
  }
  return p;
}

/**
 * Resolve a photo id to a displayable object URL. Cached per id for the page
 * lifetime. A photo not stored locally is fetched from the server when online; null if it is not there either.
 */
export async function photoUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = (await getPhotoBlob(id)) ?? (await fetchRemote(id));
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

/** Release a cached object URL (call when a photo is removed). */
export function releasePhotoUrl(id: string): void {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}
