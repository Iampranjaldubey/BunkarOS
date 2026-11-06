import { useId } from 'react';
import { cn } from '../../lib/utils';
import { rugLayout } from './rug-layout';

/**
 * SPEC-M17: a carpet drawn in code when it has no photo. The design name picks the layout
 * (medallion for Kashan / Tabriz / Kashmir / Isfahan, guls for Bokhara / Turkman / Afghan, a plain field for Gabbeh / Loribaft),
 * a hash picks the dye palette, and the size sets the proportions. Same input → same rug on every phone.
 */

interface Palette { field: string; border: string; guard: string; motif: string; motif2: string; dot: string }

const D = { indigo: '#2f3f91', indigoDeep: '#1d2760', madder: '#a8392b', madderDeep: '#6f241c', turmeric: '#d29a1c', walnut: '#6b4a2f', ivory: '#efe6d2', sage: '#7d8c5a' };
const PALETTES: Palette[] = [
  { field: D.madder, border: D.indigoDeep, guard: D.ivory, motif: D.ivory, motif2: D.indigo, dot: D.turmeric },
  { field: D.indigo, border: D.madderDeep, guard: D.ivory, motif: D.ivory, motif2: D.madder, dot: D.turmeric },
  { field: D.ivory, border: D.indigo, guard: D.madder, motif: D.madder, motif2: D.indigo, dot: D.sage },
  { field: D.madderDeep, border: D.ivory, guard: D.indigoDeep, motif: D.turmeric, motif2: D.ivory, dot: D.indigo },
];
const GABBEH: Palette[] = [
  { field: D.turmeric, border: D.walnut, guard: D.ivory, motif: D.walnut, motif2: D.madder, dot: D.ivory },
  { field: D.sage, border: D.walnut, guard: D.ivory, motif: D.ivory, motif2: D.turmeric, dot: D.madder },
  { field: D.madder, border: D.walnut, guard: D.ivory, motif: D.ivory, motif2: D.turmeric, dot: D.walnut },
];

function hash(s: string): number { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }


/** A stepped diamond centred at (cx, cy): the medallion and the small motifs. */
function lozenge(cx: number, cy: number, rx: number, ry: number) {
  return `M${cx} ${cy - ry} L${cx + rx} ${cy} L${cx} ${cy + ry} L${cx - rx} ${cy} Z`;
}
function octagon(cx: number, cy: number, r: number, ry = r) {
  const k = 0.42;
  return `M${cx - r * k} ${cy - ry} L${cx + r * k} ${cy - ry} L${cx + r} ${cy - ry * k} L${cx + r} ${cy + ry * k} L${cx + r * k} ${cy + ry} L${cx - r * k} ${cy + ry} L${cx - r} ${cy + ry * k} L${cx - r} ${cy - ry * k} Z`;
}

export interface RugArtProps {
  design: string;
  /** Any two sides; drawn lying flat, long side across. */
  length?: number; width?: number;
  seed?: string;
  /** Weave the rug in row by row once (respects reduced motion). */
  weave?: boolean;
  /** The frame the rug lies in (the floor). */
  floor?: boolean;
  className?: string;
  label?: string;
}

export function RugArt({ design, length = 3, width = 2, seed = '', weave = false, floor = true, className, label }: RugArtProps) {
  const uid = useId().replace(/:/g, '');
  const h0 = hash(`${design}|${seed}`);
  const layout = rugLayout(design, h0);
  const pal = (layout === 'gabbeh' ? GABBEH : PALETTES)[h0 % (layout === 'gabbeh' ? GABBEH.length : PALETTES.length)];
  const ratio = Math.min(2.4, Math.max(1.05, Math.max(length, width) / Math.max(1, Math.min(length, width))));

  // Lay the rug in a 400 × 300 frame with room for the fringe on the short ends.
  const VW = 400, VH = 300, padX = 34, padY = 26;
  let w = VW - padX * 2; let h = w / ratio;
  if (h > VH - padY * 2) { h = VH - padY * 2; w = h * ratio; }
  const x0 = (VW - w) / 2, y0 = (VH - h) / 2;
  const b = Math.round(h * (layout === 'gabbeh' ? 0.09 : 0.15)); // main border width
  const fx = x0 + b + 3, fy = y0 + b + 3, fw = w - 2 * (b + 3), fh = h - 2 * (b + 3);
  const cx = x0 + w / 2, cy = y0 + h / 2;

  const fringe = [];
  for (let y = y0 + 2; y < y0 + h - 1; y += 4) {
    fringe.push(<line key={`l${y}`} x1={x0 - 9} y1={y} x2={x0} y2={y} />, <line key={`r${y}`} x1={x0 + w} y1={y} x2={x0 + w + 9} y2={y} />);
  }

  // Abrash: hand-dyed wool shows faint bands of a slightly different shade.
  const bands = [];
  for (let i = 0, s = h0; i < 5; i++) { s = Math.imul(s ^ (s >>> 13), 1274126177) >>> 0; bands.push({ x: fx + (s % 1000) / 1000 * fw * 0.8, w: 6 + (s % 17) }); }

  let field: React.ReactNode = null;
  if (layout === 'medallion') {
    const mr = Math.min(fw * 0.28, fh * 0.42 * ratio * 0.9);
    const mry = fh * 0.42;
    field = (
      <g>
        <path d={lozenge(cx, cy, mr, mry)} fill={pal.motif2} />
        <path d={lozenge(cx, cy, mr * 0.78, mry * 0.78)} fill={pal.motif} />
        <path d={lozenge(cx, cy, mr * 0.5, mry * 0.5)} fill={pal.field} />
        <path d={lozenge(cx, cy, mr * 0.22, mry * 0.22)} fill={pal.dot} />
        {/* pendants */}
        <path d={lozenge(cx - mr - 10, cy, 8, 8)} fill={pal.motif} />
        <path d={lozenge(cx + mr + 10, cy, 8, 8)} fill={pal.motif} />
        {/* corner spandrels: quarter diamonds tucked into the field's corners */}
        {[[fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1]].map(([x, y, sx, sy], i) => (
          <path key={i} d={`M${x} ${y} L${x + sx * fw * 0.2} ${y} L${x} ${y + sy * fh * 0.3} Z`} fill={pal.motif2} opacity={0.9} />
        ))}
      </g>
    );
  } else if (layout === 'gul') {
    const rows = 2; const cols = Math.max(3, Math.round((fw / fh) * 2));
    const gw = fw / cols, gh = fh / rows; const r = Math.min(gw, gh) * 0.36;
    const guls = [];
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const gx = fx + gw * (j + 0.5), gy = fy + gh * (i + 0.5);
      guls.push(
        <g key={`${i}-${j}`}>
          <path d={octagon(gx, gy, r * 1.25, r)} fill={pal.motif2} />
          <path d={`M${gx - r * 1.25} ${gy} H${gx + r * 1.25} M${gx} ${gy - r} V${gy + r}`} stroke={pal.field} strokeWidth={2} />
          <path d={lozenge(gx, gy, r * 0.45, r * 0.4)} fill={pal.dot} />
        </g>,
        j < cols - 1 ? <path key={`m${i}-${j}`} d={lozenge(fx + gw * (j + 1), gy, r * 0.28, r * 0.28)} fill={pal.motif} /> : null,
      );
    }
    field = <g>{guls}</g>;
  } else {
    // Gabbeh: a quiet field with a few small stepped motifs.
    const spots: [number, number][] = [[0.25, 0.35], [0.62, 0.62], [0.8, 0.3], [0.4, 0.72]];
    field = <g>{spots.map(([px, py], i) => <path key={i} d={lozenge(fx + fw * px, fy + fh * py, 10, 10)} fill={i % 2 ? pal.motif2 : pal.motif} />)}</g>;
  }

  return (
    <div role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      className={cn('relative h-full w-full overflow-hidden', floor && 'bg-surface-2', className)} data-testid="rug-art" data-layout={layout}>
      <svg viewBox={`0 0 ${VW} ${VH}`} className={cn('h-full w-full', weave && 'weave-reveal')} preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id={`bd${uid}`} width="16" height="16" patternUnits="userSpaceOnUse" x={x0} y={y0}>
            <rect width="16" height="16" fill={pal.border} />
            <path d={lozenge(8, 8, 5, 5)} fill={pal.motif} />
            <rect x="7" y="7" width="2" height="2" fill={pal.dot} />
          </pattern>
        </defs>
        <g stroke={D.ivory} strokeWidth={1.2} opacity={0.9}>{fringe}</g>
        {/* soft shadow on the floor */}
        <rect x={x0 + 2} y={y0 + 4} width={w} height={h} rx={2} fill="#000" opacity={0.12} />
        <rect x={x0} y={y0} width={w} height={h} rx={2} fill={pal.guard} />
        <rect x={x0 + 3} y={y0 + 3} width={w - 6} height={h - 6} fill={`url(#bd${uid})`} />
        <rect x={x0 + b} y={y0 + b} width={w - 2 * b} height={h - 2 * b} fill={pal.guard} />
        <rect x={fx} y={fy} width={fw} height={fh} fill={pal.field} />
        <g fill="#000" opacity={0.05}>{bands.map((bd, i) => <rect key={i} x={bd.x} y={fy} width={bd.w} height={fh} />)}</g>
        {field}
      </svg>
    </div>
  );
}
