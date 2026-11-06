import { useId } from 'react';
import { cn } from '../../lib/utils';

/**
 * SPEC-M18 bags pack: a bag drawn in code when it has no photo, and the running-stitch signature.
 * The model name picks the shape (backpack, tote, sling, duffel, laptop sleeve), a hash picks the fabric colour,
 * so the same model looks the same on every phone.
 */
type Shape = 'backpack' | 'tote' | 'sling' | 'duffel' | 'laptop';
const FABRIC = ['#2f3f91', '#a8392b', '#6b4a2f', '#4f6136', '#3a3530', '#7b2d4a', '#b07d1a'];
const TRIM = '#efe6d2';

function hash(s: string): number { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function bagShape(model: string, seed: number): Shape {
  const d = model.toLowerCase();
  if (/back ?pack|school|pitthu|bag ?pack|rucksack/.test(d)) return 'backpack';
  if (/tote|shop|jhola|carry/.test(d)) return 'tote';
  if (/sling|cross|purse|clutch/.test(d)) return 'sling';
  if (/duffel|travel|gym|trolley|kit/.test(d)) return 'duffel';
  if (/laptop|sleeve|office|file/.test(d)) return 'laptop';
  return (['backpack', 'tote', 'sling', 'duffel', 'laptop'] as Shape[])[seed % 5];
}

/** A dashed line inside a seam: the stitch. */
const stitch = { stroke: TRIM, strokeWidth: 1.6, strokeDasharray: '5 4', fill: 'none', strokeLinecap: 'round' as const };

export function BagArt({ design, seed = '', className, label, floor = true, fabric }: { design: string; seed?: string; className?: string; label?: string; floor?: boolean; fabric?: string }) {
  const uid = useId().replace(/:/g, '');
  const h0 = hash(`${design}|${seed}`);
  const shape = bagShape(design, h0);
  const fab = fabric ?? FABRIC[h0 % FABRIC.length];
  const body = (() => {
    switch (shape) {
      case 'backpack': return (
        <g>
          <path d="M150 70 Q150 40 200 40 Q250 40 250 70" fill="none" stroke={fab} strokeWidth={10} strokeLinecap="round" />
          <rect x="130" y="66" width="140" height="190" rx="34" fill={fab} />
          <rect x="146" y="164" width="108" height="72" rx="16" fill="#000" opacity={0.16} />
          <rect x="150" y="80" width="100" height="70" rx="20" {...stitch} />
          <path d="M156 186 H244" stroke={TRIM} strokeWidth={4} strokeLinecap="round" />
          <rect x="194" y="180" width="12" height="18" rx="3" fill={TRIM} />
          <rect x="136" y="72" width="128" height="178" rx="30" {...stitch} />
        </g>
      );
      case 'tote': return (
        <g>
          <path d="M160 110 Q160 50 200 50 Q240 50 240 110" fill="none" stroke={fab} strokeWidth={9} />
          <path d="M120 106 H280 L262 256 H138 Z" fill={fab} />
          <path d="M128 116 H272 L256 248 H144 Z" {...stitch} />
          <rect x="176" y="150" width="48" height="34" rx="4" fill={TRIM} opacity={0.9} />
        </g>
      );
      case 'sling': return (
        <g>
          <path d="M110 70 L200 140 L290 70" fill="none" stroke={fab} strokeWidth={7} strokeLinecap="round" />
          <rect x="130" y="130" width="140" height="110" rx="22" fill={fab} />
          <path d="M130 172 Q200 200 270 172" fill="#000" opacity={0.15} />
          <rect x="138" y="138" width="124" height="94" rx="16" {...stitch} />
          <circle cx="200" cy="186" r="7" fill={TRIM} />
        </g>
      );
      case 'duffel': return (
        <g>
          <path d="M150 140 Q150 90 200 90 Q250 90 250 140" fill="none" stroke={fab} strokeWidth={9} />
          <rect x="90" y="132" width="220" height="110" rx="54" fill={fab} />
          <path d="M120 150 H280" stroke={TRIM} strokeWidth={4} strokeLinecap="round" />
          <rect x="98" y="140" width="204" height="94" rx="46" {...stitch} />
          <circle cx="112" cy="187" r="14" fill="#000" opacity={0.15} /><circle cx="288" cy="187" r="14" fill="#000" opacity={0.15} />
        </g>
      );
      default: return (
        <g>
          <rect x="100" y="96" width="200" height="140" rx="14" fill={fab} />
          <path d="M100 126 H300" stroke="#000" strokeOpacity={0.18} strokeWidth={2} />
          <rect x="108" y="104" width="184" height="124" rx="10" {...stitch} />
          <path d="M180 96 Q180 74 200 74 Q220 74 220 96" fill="none" stroke={fab} strokeWidth={8} />
        </g>
      );
    }
  })();
  return (
    <div role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      className={cn('relative h-full w-full overflow-hidden', floor && 'bg-surface-2', className)} data-testid="bag-art" data-shape={shape}>
      <svg viewBox="0 0 400 300" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`sh${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0.16} /><stop offset="0.45" stopColor="#fff" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.22} />
          </linearGradient>
          <mask id={`mk${uid}`}><g fill="#fff" stroke="#fff">{body}</g></mask>
        </defs>
        <ellipse cx="200" cy="262" rx="110" ry="10" fill="#000" opacity={0.1} />
        {body}
        <rect width="400" height="300" fill={`url(#sh${uid})`} mask={`url(#mk${uid})`} />
      </svg>
    </div>
  );
}

/** The bags signature: a running stitch between two hairlines, like a seam (same four places as the carpet border band). */
export function StitchLine({ className, tone = 'dye' }: { className?: string; tone?: 'dye' | 'ink' }) {
  const id = useId().replace(/:/g, '');
  const line = tone === 'ink' ? '#6a6156' : 'var(--color-line-strong)';
  const thread = tone === 'ink' ? '#1f1b16' : 'var(--color-dye-madder)';
  return (
    <svg aria-hidden="true" className={cn('block h-2.5 w-full', className)} preserveAspectRatio="none" data-testid="stitch-line">
      <defs>
        <pattern id={`s${id}`} width="12" height="10" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="12" height="1" fill={line} />
          <rect x="0" y="9" width="12" height="1" fill={line} />
          <rect x="1" y="4" width="7" height="2" rx="1" fill={thread} />
        </pattern>
      </defs>
      <rect width="100%" height="10" fill={`url(#s${id})`} />
    </svg>
  );
}
