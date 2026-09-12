import { NavLink } from 'react-router-dom';
import { cx } from '@/components/ui';
import { NAV_ITEMS } from './nav';
import './layout.css';

/** Bottom tab bar shown under 768px. */
export function MobileNav() {
  return (
    <nav className="app-mobilenav no-print" aria-label="Main">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cx('app-mobilenav__link', isActive && 'app-mobilenav__link--active')}
          >
            <Icon size={19} aria-hidden="true" />
            <span className="app-mobilenav__label">{item.shortLabel ?? item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
