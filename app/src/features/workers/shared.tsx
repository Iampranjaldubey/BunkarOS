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
  return <Badge tone="info">{t(`worker.job.${w.jobTitle}`)}</Badge>;
}
/** Avatar: the worker's photo when one is stored, else coloured initials. */
export function Avatar({ name, size = 40, photoId }: { name: string; size?: number; photoId?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let live = true; if (photoId) void photoUrl(photoId).then((u) => { if (live) setUrl(u); }); else setUrl(null); return () => { live = false; }; }, [photoId]);
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  if (url) return <img src={url} alt="" aria-hidden="true" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />;
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-full font-display text-lg text-white"
      style={{ width: size, height: size, background: `hsl(${hue} 45% 42%)` }}>{initial}</span>
  );
}
