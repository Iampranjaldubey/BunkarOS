import { useEffect, useState } from 'react';
import type { WorkerP } from '../../db/types';
import { photoUrl } from '../../db/photos';
import { formatINR } from '../../domain/money';
import { Badge } from '../../components/ui/Badge';
import { useT } from '../../i18n';

/** "महीने की तनख्वाह · ₹12,000" line for a worker. */
export function PaySummary({ w }: { w: WorkerP }) {
  const { t } = useT();
  const amt = w.payType === 'monthly' ? w.salaryPaise : w.payType === 'daily' ? w.dailyRatePaise : w.pieceRatePaise;
  return <span className="text-sm text-muted">{t(`worker.payType.${w.payType}`)}{amt ? <> · <span className="num font-medium text-ink">{formatINR(amt)}</span></> : null}</span>;
}
export function JobBadge({ w }: { w: WorkerP }) {
  const { t } = useT();
  return <Badge tone="neutral">{t(`worker.job.${w.jobTitle}`)}</Badge>;
}
/** Dye colours for initials, picked by name so a worker keeps the same colour on every phone. */
// Indigo, madder, walnut, sage, lac, deep indigo: hand-dye colours far enough apart to tell people apart.
const AVATAR_DYES = ['#2f3f91', '#a8392b', '#6b4a2f', '#4f6136', '#7b2d4a', '#1d2760'];

/** Avatar: the worker's photo when one is stored, else initials on a dye colour (SPEC-M17). */
export function Avatar({ name, size = 40, photoId }: { name: string; size?: number; photoId?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let live = true; if (photoId) void photoUrl(photoId).then((u) => { if (live) setUrl(u); }); else setUrl(null); return () => { live = false; }; }, [photoId]);
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  let h = 2166136261; for (const c of name) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } // FNV-1a
  const dye = AVATAR_DYES[(h >>> 0) % AVATAR_DYES.length];
  if (url) return <img src={url} alt="" aria-hidden="true" style={{ width: size, height: size }} className="shrink-0 rounded-xl object-cover" />;
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-xl font-display font-medium text-[#efe6d2]"
      style={{ width: size, height: size, background: dye, fontSize: Math.round(size * 0.42) }}>{initial}</span>
  );
}
