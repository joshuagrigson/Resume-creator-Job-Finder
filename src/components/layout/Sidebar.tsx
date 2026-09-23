import { NavLink } from 'react-router-dom';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { IconButton, Tooltip, cx } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { NAV_ITEMS } from './nav';
import './layout.css';
import { BrandMark } from './BrandMark';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/** Desktop navigation rail. Collapses to icons on narrow desktops. */
export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  return (
    <nav className={cx('app-sidebar', 'no-print', collapsed && 'app-sidebar--collapsed')} aria-label="Main">
      <NavLink to="/" className="app-brand" aria-label="Launchpad — dashboard">
        <span className="app-brand__mark" aria-hidden="true">
          <BrandMark />
        </span>
        {collapsed ? null : <span className="app-brand__name">Launchpad</span>}
      </NavLink>

      <div className="app-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cx('app-nav__link', isActive && 'app-nav__link--active')}
              aria-label={collapsed ? item.label : undefined}
            >
              <Icon size={17} aria-hidden="true" />
              {collapsed ? null : <span>{item.label}</span>}
            </NavLink>
          );
          return collapsed ? (
            <Tooltip key={item.to} content={item.label} side="right">
              {link}
            </Tooltip>
          ) : (
            link
          );
        })}
      </div>

      <div className="app-sidebar__footer">
        <AiStatus collapsed={collapsed} />
        {collapsed ? null : <p className="app-privacy">Local-first — your data stays in this browser.</p>}
        <IconButton
          className="app-sidebar__collapse"
          size="sm"
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          icon={collapsed ? <PanelLeft size={15} /> : <PanelLeftClose size={15} />}
          onClick={onToggleCollapsed}
        />
      </div>
    </nav>
  );
}

/** AI availability indicator fed by `/api/health`. */
export function AiStatus({ collapsed = false }: { collapsed?: boolean }) {
  const ai = useSettingsStore((s) => s.ai);
  const healthError = useSettingsStore((s) => s.healthError);

  const state = healthError ? 'error' : ai === null ? 'unknown' : ai.enabled ? 'on' : 'off';
  const text =
    state === 'error'
      ? 'Server offline'
      : state === 'unknown'
        ? 'Checking AI…'
        : state === 'on'
          ? 'AI features ready'
          : 'AI off';
  const detail = state === 'off' ? (ai?.reason ?? 'Add an API key on the server to enable AI.') : undefined;

  const dotClass =
    state === 'on' ? 'app-status__dot--on' : state === 'error' ? 'app-status__dot--error' : 'app-status__dot--off';

  const body = (
    <div className="app-status" title={collapsed ? text : detail}>
      <span className={cx('app-status__dot', dotClass)} aria-hidden="true" />
      {collapsed ? null : <span className="truncate">{text}</span>}
      <span className="visually-hidden">{detail ? `${text}. ${detail}` : text}</span>
    </div>
  );

  return collapsed ? (
    <Tooltip content={text} side="right">
      {body}
    </Tooltip>
  ) : (
    body
  );
}
