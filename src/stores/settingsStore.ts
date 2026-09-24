/**
 * App settings — theme, server capability status, and small UX preferences. Persisted.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSafeStorage } from '@/stores/storage';
import type { AiStatus, HealthResponse } from '@shared/types';
import { api } from '@/lib/api';

export type ThemeMode = 'system' | 'light' | 'dark';

/** The five house colorways: one accent, one metal, all on the same ivory. Ink & Brass is the default. */
export type Colorway = 'ink-brass' | 'bordeaux' | 'hunter' | 'graphite' | 'verdigris';

export const COLORWAYS: { value: Colorway; label: string; accent: string; metal: string }[] = [
  { value: 'ink-brass', label: 'Ink & Brass', accent: '#22334a', metal: '#a8894f' },
  { value: 'bordeaux', label: 'Bordeaux & Rose Gold', accent: '#6e2f3c', metal: '#b08d6e' },
  { value: 'hunter', label: 'Hunter & Antique Gold', accent: '#2e4a3d', metal: '#9c8a5a' },
  { value: 'graphite', label: 'Graphite & Gold', accent: '#2c2c30', metal: '#b3945b' },
  { value: 'verdigris', label: 'Verdigris & Copper', accent: '#2f5f66', metal: '#a26b4a' },
];

export interface SettingsState {
  theme: ThemeMode;
  colorway: Colorway;
  /** Whether the user has dismissed the first-run welcome. */
  onboarded: boolean;
  /** Last known server health (not persisted). */
  health: HealthResponse | null;
  ai: AiStatus | null;
  healthError: string | null;
  /** The ZIP he calls home: used when the location box is empty, one tap away when it isn't. */
  homeZip: string | null;

  setTheme: (theme: ThemeMode) => void;
  setColorway: (colorway: Colorway) => void;
  setOnboarded: (v: boolean) => void;
  setHomeZip: (zip: string | null) => void;
  /** Fetch /api/health once; safe to call repeatedly. */
  refreshHealth: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      colorway: 'ink-brass',
      onboarded: false,
      health: null,
      ai: null,
      healthError: null,
      homeZip: null,

      setTheme: (theme) => set({ theme }),
      setColorway: (colorway) => set({ colorway: COLORWAYS.some((c) => c.value === colorway) ? colorway : 'ink-brass' }),
      setHomeZip: (zip) => set({ homeZip: zip && /^\d{5}$/.test(zip.trim()) ? zip.trim() : null }),
      setOnboarded: (v) => set({ onboarded: v }),

      refreshHealth: async () => {
        try {
          const health = await api.health();
          set({ health, ai: health.ai, healthError: null });
        } catch (e) {
          set({ healthError: (e as Error).message || 'Server unreachable', ai: { enabled: false, reason: 'Server unreachable' } });
        }
      },
    }),
    {
      name: 'launchpad.settings.v1',
      storage: createSafeStorage(),
      version: 1,
      partialize: (s) => ({ theme: s.theme, colorway: s.colorway, onboarded: s.onboarded, homeZip: s.homeZip }),
    },
  ),
);

/** Resolve 'system' to the actual mode using the OS preference. */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
