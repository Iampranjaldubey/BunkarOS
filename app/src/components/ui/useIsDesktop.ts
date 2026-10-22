import { useSyncExternalStore } from 'react';

/** Tailwind `lg` breakpoint — the desktop layout starts here (SPEC-019). */
export const DESKTOP_QUERY = '(min-width: 1024px)';

function subscribe(query: string) {
  return (onChange: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  };
}

/** True while `query` matches. Read synchronously, so the first paint is already correct. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/**
 * True at ≥ 1024 px. Use it to render EITHER the phone markup OR the desktop markup —
 * never both hidden with CSS — so phones get exactly today's DOM (no duplicate
 * names for screen readers or tests) and phones don't pay for desktop markup.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
