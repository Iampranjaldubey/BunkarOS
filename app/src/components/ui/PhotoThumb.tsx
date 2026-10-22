import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { photoUrl } from '../../db/photos';
import { cn } from '../../lib/utils';

/** Shows a stored photo (M5) by id. Falls back to an icon or initials when missing. */
export function PhotoThumb({ id, alt, size = 56, initials, className }: {
  id?: string; alt: string; size?: number; initials?: string; className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (id) void photoUrl(id).then((u) => { if (live) setUrl(u); });
    else setUrl(null);
    return () => { live = false; };
  }, [id]);
  const style = { width: size, height: size };
  if (url) return <img src={url} alt={alt} style={style} className={cn('rounded-xl object-cover bg-bg', className)} />;
  return (
    <span role="img" aria-label={alt} style={style}
      className={cn('inline-grid place-items-center rounded-xl bg-bg text-muted font-bold', className)}>
      {initials ? initials.slice(0, 2).toUpperCase() : <ImageOff aria-hidden="true" size={size / 2.5} />}
    </span>
  );
}
