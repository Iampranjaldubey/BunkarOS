import { db } from './db';
import type { PhotoRow } from './types';
import { uuid } from '../domain/ids';
import { getStoredSession } from '../lib/session-store';

const MAX_DIM = 1280;
const JPEG_QUALITY = 0.7;

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
  const scale = Math.min(1, MAX_DIM / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  src.draw(ctx, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

  const id = uuid();
  const row: PhotoRow = {
    id,
    unitId,
    blob,
    mime: 'image/jpeg',
    w,
    h,
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

/**
 * Resolve a photo id to a displayable object URL. Cached per id for the page
 * lifetime. Returns null if the photo is not stored locally.
 */
export async function photoUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = await getPhotoBlob(id);
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
