import type { ReactNode } from 'react';
import { useIsDesktop } from './useIsDesktop';

/** Rendered only below 1024 px — phones and small tablets get exactly today's markup. */
export function PhoneOnly({ children }: { children: ReactNode }) {
  return useIsDesktop() ? null : <>{children}</>;
}

/** Rendered only at ≥ 1024 px (SPEC-019 desktop layout). */
export function DesktopOnly({ children }: { children: ReactNode }) {
  return useIsDesktop() ? <>{children}</> : null;
}
