import { Monitor, Moon, Sun } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import type { ThemeMode } from '@/stores/settingsStore';
import './layout.css';

const NEXT_LABEL: Record<ThemeMode, string> = {
  light: 'Switch to dark theme',
  dark: 'Switch to system theme',
  system: 'Switch to light theme',
};

const CURRENT_LABEL: Record<ThemeMode, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
};

export interface ThemeToggleProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Cycles light → dark → system and keeps `<html data-theme>` in sync. */
export function ThemeToggle({ size = 'md', className }: ThemeToggleProps) {
  const { mode, cycle } = useTheme();
  const icon = mode === 'light' ? <Sun size={16} /> : mode === 'dark' ? <Moon size={16} /> : <Monitor size={16} />;

  return (
    <IconButton
      label={NEXT_LABEL[mode]}
      title={`${CURRENT_LABEL[mode]} — ${NEXT_LABEL[mode].toLowerCase()}`}
      icon={icon}
      size={size}
      className={className}
      onClick={cycle}
    />
  );
}
