import { FileText, KanbanSquare, LayoutDashboard, Search, Settings, Wand2 } from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavItem {
  to: string;
  label: string;
  /** Shorter label for the mobile tab bar. */
  shortLabel?: string;
  icon: ComponentType<{ size?: number | string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  /** Only match the exact path (used for "/"). */
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard, end: true },
  { to: '/resume', label: 'Resume', icon: FileText },
  { to: '/jobs', label: 'Jobs', icon: Search },
  { to: '/tracker', label: 'Tracker', icon: KanbanSquare },
  { to: '/tailor', label: 'Tailor', icon: Wand2 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/** Title for the top bar: the deepest nav item whose path prefixes `pathname`. */
export function navTitleFor(pathname: string): string {
  let best: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    if (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)) {
      if (!best || item.to.length > best.to.length) best = item;
    }
  }
  return best?.label ?? 'Launchpad';
}
