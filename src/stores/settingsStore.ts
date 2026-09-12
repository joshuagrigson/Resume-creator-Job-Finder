/**
 * App settings — theme, server capability status, and small UX preferences. Persisted.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AiStatus, HealthResponse } from '@shared/types';
import { api } from '@/lib/api';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface SettingsState {
  theme: ThemeMode;
  /** Whether the user has dismissed the first-run welcome. */
  onboarded: boolean;
  /** Last known server health (not persisted). */
  health: HealthResponse | null;
  ai: AiStatus | null;
  healthError: string | null;

  setTheme: (theme: ThemeMode) => void;
  setOnboarded: (v: boolean) => void;
  /** Fetch /api/health once; safe to call repeatedly. */
  refreshHealth: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      onboarded: false,
      health: null,
      ai: null,
      healthError: null,

      setTheme: (theme) => set({ theme }),
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
      version: 1,
      partialize: (s) => ({ theme: s.theme, onboarded: s.onboarded }),
    },
  ),
);

/** Resolve 'system' to the actual mode using the OS preference. */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
