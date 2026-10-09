// Dependency-free PWA icon generator for Bunkar OS.
// Draws a stylised loom/carpet motif in saffron + jute on an indigo field,
// then encodes raw RGBA to PNG using Node's zlib (no npm packages).
// Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(OUT, { recursive: true });

const INDIGO = [0x26, 0x40, 0x6b];
const INDIGO_DARK = [0x1b, 0x2e, 0x4e];
const SAFFRON = [0xc9, 0x8a, 0x1c];
const JUTE = [0x6f, 0x9b, 0x5f];
const CREAM = [0xf4, 0xf5, 0xf8];

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Build an RGBA pixel buffer for a given size.
// `pad` controls the safe-zone inset (maskable needs ~10% padding each side).
function render(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };

  // Background: subtle vertical indigo gradient. Fill the whole canvas so a
  // maskable icon's safe-zone crop still shows the brand field.
  for (let y = 0; y < size; y++) {
    const t = y / size;
    const col = mix(INDIGO, INDIGO_DARK, t);
    for (let x = 0; x < size; x++) set(x, y, col);
  }

  // Motif is drawn inside a centred box. For maskable, shrink the motif so it
  // stays within the circular safe zone.
  const inset = maskable ? size * 0.2 : size * 0.14;
  const box = size - inset * 2;
  const ox = inset;
  const oy = inset;

  // Carpet weave: vertical warp threads (cream) + horizontal weft rows,
  // with a saffron diamond "knot" medallion in the centre.
  const warpCount = 7;
  const gap = box / warpCount;
  for (let w = 0; w <= warpCount; w++) {
    const x = Math.round(ox + w * gap);
    const tw = Math.max(1, Math.round(size * 0.012));
    for (let y = Math.round(oy); y < oy + box; y++) {
      for (let dx = 0; dx < tw; dx++) set(x + dx, y, mix(CREAM, INDIGO, 0.25), 90);
    }
  }
  // Horizontal weft rows alternating jute/cream for a woven feel.
  const rows = 9;
  const rgap = box / rows;
  for (let r = 0; r <= rows; r++) {
    const y = Math.round(oy + r * rgap);
    const th = Math.max(1, Math.round(size * 0.02));
    const col = r % 2 === 0 ? JUTE : mix(CREAM, INDIGO, 0.2);
    for (let x = Math.round(ox); x < ox + box; x++) {
      for (let dy = 0; dy < th; dy++) set(x, y + dy, col, r % 2 === 0 ? 180 : 70);
    }
  }

  // Central saffron diamond medallion (the "knot").
  const cx = ox + box / 2;
  const cy = oy + box / 2;
  const rad = box * 0.3;
  for (let y = Math.round(cy - rad); y <= cy + rad; y++) {
    for (let x = Math.round(cx - rad); x <= cx + rad; x++) {
      const d = Math.abs(x - cx) / rad + Math.abs(y - cy) / rad; // diamond (L1)
      if (d <= 1) {
        const edge = d > 0.82;
        set(x, y, edge ? mix(SAFFRON, CREAM, 0.3) : SAFFRON);
      }
    }
  }
  // Inner cream diamond for contrast.
  const rad2 = rad * 0.46;
  for (let y = Math.round(cy - rad2); y <= cy + rad2; y++) {
    for (let x = Math.round(cx - rad2); x <= cx + rad2; x++) {
      const d = Math.abs(x - cx) / rad2 + Math.abs(y - cy) / rad2;
      if (d <= 1) set(x, y, CREAM);
    }
  }
  return buf;
}

// --- Minimal PNG encoder (truecolour + alpha, 8-bit) ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // Add filter byte (0) at the start of each scanline.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  ['pwa-192.png', 192, {}],
  ['pwa-512.png', 512, {}],
  ['pwa-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
];
for (const [name, size, opts] of targets) {
  const png = encodePng(size, render(size, opts));
  writeFileSync(join(OUT, name), png);
  console.log(`wrote ${name} (${size}x${size}, ${png.length} bytes)`);
}
