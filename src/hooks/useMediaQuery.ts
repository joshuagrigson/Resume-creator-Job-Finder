import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query.
 *
 * SSR/test-safe: returns `false` when `window.matchMedia` is unavailable.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => getMatch(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

function getMatch(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/** Breakpoints used across the app. Keep in sync with the CSS media queries. */
export const BREAKPOINTS = {
  /** Phones / bottom tab bar. */
  mobile: '(max-width: 767px)',
  /** Tablet & narrow desktop — the sidebar collapses to icons. */
  compact: '(min-width: 768px) and (max-width: 1099px)',
  /** Full desktop. */
  desktop: '(min-width: 1100px)',
} as const;

export const useIsMobile = (): boolean => useMediaQuery(BREAKPOINTS.mobile);
export const usePrefersReducedMotion = (): boolean => useMediaQuery('(prefers-reduced-motion: reduce)');
