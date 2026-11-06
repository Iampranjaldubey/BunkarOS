import { useEffect, useState } from 'react';
import { Ban, Bookmark, PackageCheck, ShoppingBag, Truck, type LucideIcon } from 'lucide-react';
import { ProductArt } from '../../industries/ui';
import { Badge } from '../../components/ui/Badge';
import { photoUrl } from '../../db/photos';
import { countFor, type CarpetStatus, type CarpetView } from '../../domain/catalogue';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

const META: Record<CarpetStatus, { tone: 'received' | 'info' | 'neutral' | 'warn' | 'given'; icon: LucideIcon }> = {
  in_stock: { tone: 'received', icon: PackageCheck },
  reserved: { tone: 'info', icon: Bookmark },
  delivered: { tone: 'neutral', icon: Truck },
  sold: { tone: 'warn', icon: ShoppingBag },
  written_off: { tone: 'given', icon: Ban },
};

/** Status as colour + icon + label (D14); with a count for quantity carpets. */
export function StatusChip({ status, n }: { status: CarpetStatus; n?: number }) {
  const { t } = useT();
  const { tone, icon: Icon } = META[status];
  return (
    <Badge tone={tone} data-testid={`status-${status}`}>
      <Icon aria-hidden="true" size={14} strokeWidth={1.75} />
      {n !== undefined ? t('cat.count', { n, status: t(`cat.st.${status}`) }) : t(`cat.st.${status}`)}
    </Badge>
  );
}

/** Piece: its one status. Quantity: every status with a count ("5 स्टॉक में", "3 ऑर्डर के लिए रखा"). */
export function StatusChips({ v, className }: { v: CarpetView; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)} data-testid="carpet-status">
      {v.carpet.mode === 'piece'
        ? <StatusChip status={v.status} />
        : v.statuses.map((s) => <StatusChip key={s} status={s} n={countFor(v.counts, s)} />)}
    </div>
  );
}

/**
 * Cover photo (the first one) filling its box. Without a photo the carpet is drawn in code from its design
 * and size (SPEC-M17, decision 5C), so the catalogue always shows carpets.
 */
export function CarpetPhoto({ id, alt, className, design, length, width, seed }: { id?: string; alt: string; className?: string; design?: string; length?: number; width?: number; seed?: string }) {
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    let live = true;
    if (id) void photoUrl(id).then((u) => { if (live) setLoaded({ id, url: u }); });
    return () => { live = false; };
  }, [id]);
  const url = id && loaded?.id === id ? loaded.url : null;
  if (url) return <img src={url} alt={alt} className={cn('h-full w-full bg-surface-2 object-cover', className)} data-testid="carpet-photo" />;
  if (id && !loaded) return <span role="img" aria-label={alt} className={cn('block h-full w-full bg-surface-2', className)} />;
  return <ProductArt design={design ?? alt} length={length} width={width} seed={seed} label={alt} className={className} />;
}
