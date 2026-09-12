import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ToastProvider } from '@/components/ui';
import { useMediaQuery, BREAKPOINTS } from '@/hooks/useMediaQuery';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useTheme } from '@/hooks/useTheme';
import { useSettingsStore } from '@/stores/settingsStore';
import { MobileNav } from './MobileNav';
import { Sidebar } from './Sidebar';
import { TopBar, TopBarSlotProvider } from './TopBar';
import { navTitleFor } from './nav';
import './layout.css';

export interface AppShellProps {
  children: ReactNode;
}

/**
 * Application frame: sidebar nav (desktop), bottom tabs (mobile), sticky top bar with a
 * page-actions slot, toast provider, theme application and a one-time health check.
 */
export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const isCompact = useMediaQuery(BREAKPOINTS.compact);
  const [collapsePref, setCollapsePref] = useLocalStorage<boolean | null>('launchpad.sidebar.collapsed', null);
  const [slotEl, setSlotEl] = useState<HTMLDivElement | null>(null);

  useTheme();

  // New page → back to the top, the way a full page load would behave.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const scroller = document.scrollingElement ?? document.documentElement;
    if (scroller) scroller.scrollTop = 0;
  }, [location.pathname]);

  const refreshHealth = useSettingsStore((s) => s.refreshHealth);
  const healthRequested = useRef(false);
  useEffect(() => {
    if (healthRequested.current) return;
    healthRequested.current = true;
    void refreshHealth();
  }, [refreshHealth]);

  const collapsed = collapsePref ?? isCompact;
  const toggleCollapsed = useCallback(() => setCollapsePref(!collapsed), [collapsed, setCollapsePref]);

  return (
    <ToastProvider>
      <TopBarSlotProvider value={slotEl}>
        <div className="app-shell">
          <a className="app-skip-link" href="#main">
            Skip to content
          </a>

          <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

          <div className="app-frame">
            <TopBar title={navTitleFor(location.pathname)} slotRef={setSlotEl} />
            <main id="main" className="app-main" tabIndex={-1}>
              <div className="app-content">{children}</div>
            </main>
          </div>

          <MobileNav />
        </div>
      </TopBarSlotProvider>
    </ToastProvider>
  );
}

export default AppShell;
