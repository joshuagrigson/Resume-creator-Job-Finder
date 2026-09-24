import { useCallback, useEffect, useState } from 'react';
import { resolveTheme, useSettingsStore, type ThemeMode } from '@/stores/settingsStore';

export interface UseThemeResult {
  /** What the user picked: 'system' | 'light' | 'dark'. */
  mode: ThemeMode;
  /** What is actually rendered right now. */
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  /** Cycles light → dark → system. */
  cycle: () => void;
  /** Flips between light and dark (leaving 'system' behind). */
  toggle: () => void;
}

const MODES: ThemeMode[] = ['light', 'dark', 'system'];

/**
 * Applies the chosen theme to `<html data-theme>` and keeps it in sync with the OS
 * preference while the mode is 'system'. Mount once (AppShell does); extra mounts are
 * harmless because every instance writes the same value.
 */
export function useTheme(): UseThemeResult {
  const mode = useSettingsStore((s) => s.theme);
  const setMode = useSettingsStore((s) => s.setTheme);
  const colorway = useSettingsStore((s) => s.colorway);
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveTheme(mode));

  useEffect(() => {
    const apply = () => {
      const next = resolveTheme(mode);
      setResolved(next);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', next);
        document.documentElement.style.colorScheme = next;
      }
    };

    apply();

    if (mode !== 'system') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [mode]);

  // The colorway lives on <html data-colorway> next to the theme; index.html sets it before first paint.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (colorway && colorway !== 'ink-brass') document.documentElement.setAttribute('data-colorway', colorway);
    else document.documentElement.removeAttribute('data-colorway');
  }, [colorway]);

  const cycle = useCallback(() => {
    const i = MODES.indexOf(mode);
    setMode(MODES[(i + 1) % MODES.length] ?? 'system');
  }, [mode, setMode]);

  const toggle = useCallback(() => {
    setMode(resolveTheme(mode) === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  return { mode, resolved, setMode, cycle, toggle };
}
