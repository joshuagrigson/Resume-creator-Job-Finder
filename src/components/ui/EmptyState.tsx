import type { ReactNode } from 'react';
import { cx } from './utils';
import './surfaces.css';

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Usually a lucide icon element. */
  icon?: ReactNode;
  /** Primary/secondary buttons. */
  actions?: ReactNode;
  size?: 'sm' | 'md';
  /** Drop the dashed border + surface (for use inside an existing card). */
  plain?: boolean;
  className?: string;
}

/** Friendly "nothing here yet" block with an optional call to action. */
export function EmptyState({ title, description, icon, actions, size = 'md', plain = false, className }: EmptyStateProps) {
  return (
    <div className={cx('ui-empty', size === 'sm' && 'ui-empty--sm', plain && 'ui-empty--plain', className)}>
      {icon ? (
        <div className="ui-empty__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <div className="ui-empty__title">{title}</div>
      {description ? <div className="ui-empty__desc">{description}</div> : null}
      {actions ? <div className="ui-empty__actions">{actions}</div> : null}
    </div>
  );
}
