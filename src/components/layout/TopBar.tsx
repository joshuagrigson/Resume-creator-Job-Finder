import { createContext, useContext, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import './layout.css';

const TopBarSlotContext = createContext<HTMLElement | null>(null);

export function TopBarSlotProvider({ value, children }: { value: HTMLElement | null; children: ReactNode }) {
  return <TopBarSlotContext.Provider value={value}>{children}</TopBarSlotContext.Provider>;
}

/**
 * Renders page-level actions into the app top bar.
 *
 *   <TopBarActions><Button variant="primary">Export</Button></TopBarActions>
 *
 * Safe to render anywhere inside the shell; renders nothing until the bar is mounted.
 */
export function TopBarActions({ children }: { children: ReactNode }) {
  const slot = useContext(TopBarSlotContext);
  if (!slot) return null;
  return createPortal(children, slot);
}

export interface TopBarProps {
  title: string;
  /** Callback ref for the actions slot container. */
  slotRef: Ref<HTMLDivElement>;
}

/** Sticky bar with the current section title, a page-actions slot and the theme toggle. */
export function TopBar({ title, slotRef }: TopBarProps) {
  return (
    <header className="app-topbar no-print">
      <NavLink to="/" className="app-brand app-topbar__brand" aria-label="Launchpad — dashboard">
        <span className="app-brand__mark" aria-hidden="true">
          L
        </span>
        <span className="app-brand__name">Launchpad</span>
      </NavLink>
      {/* Plain text, not a heading: each page owns its own <h1> via <PageHeader>. */}
      <div className="app-topbar__title truncate">{title}</div>
      <div className="app-topbar__slot" ref={slotRef} />
      <div className="app-topbar__tools">
        <ThemeToggle />
      </div>
    </header>
  );
}
