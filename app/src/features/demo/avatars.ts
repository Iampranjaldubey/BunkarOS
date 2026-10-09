// Bunkar OS — demo avatar generator.
// Draws a small, deterministic "initials" avatar on a canvas and stores it via
// savePhoto() so photo grids in the UI look real without shipping image assets.
import { savePhoto } from '../../db/photos';

// Calm, PRD-adjacent palette (indigo / madder / saffron / jute family) so the
// avatars sit comfortably next to the app chrome.
const PALETTE = [
  '#26406B', // indigo
  '#A8322A', // madder
  '#C98A1C', // saffron
  '#4F7545', // jute
  '#3E5C8A', // indigo-light
  '#7A4A2B', // clay
  '#2E6E6A', // teal
  '#6B4F86', // plum
];

/** Stable 32-bit hash so the same name always picks the same colour. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** First letters of up to two words, uppercased (Devanagari-safe via charAt). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Draw a 256x256 initials avatar and persist it. Returns the stored photo id,
 * or null when no canvas is available (non-DOM test env).
 */
export async function makeAvatarPhoto(
  name: string,
  kind: 'weaver' | 'loom' | 'thekedar',
): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const base = PALETTE[hash(name + kind) % PALETTE.length];

  // Soft vertical gradient so the tile has a little depth.
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, shade(base, 18));
  grad.addColorStop(1, base);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  if (kind === 'loom') {
    drawLoomFrame(ctx, size);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${size * 0.42}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      name.replace(/[^0-9]/g, '').slice(0, 3) || initials(name),
      size / 2,
      size / 2 + 4,
    );
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `600 ${size * 0.4}px system-ui, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(name), size / 2, size / 2 + 6);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8),
  );
  if (!blob) return null;
  return savePhoto(blob);
}

function drawLoomFrame(ctx: CanvasRenderingContext2D, size: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = size * 0.03;
  const pad = size * 0.14;
  ctx.strokeRect(pad, pad, size - pad * 2, size - pad * 2);
}

/** Lighten a hex colour by `amt` percent toward white. */
function shade(hex: string, amt: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round(255 * (amt / 100)));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * (amt / 100)));
  const b = Math.min(255, (n & 0xff) + Math.round(255 * (amt / 100)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
