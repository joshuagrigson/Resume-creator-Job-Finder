import type { ReactNode } from 'react';
import { cx } from './utils';
import './surfaces.css';

export interface PageHeaderProps {
  title: ReactNode;
  /** Small uppercase label above the title. */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Rendered next to the title (badges, score chips). */
  badge?: ReactNode;
  /** Right-aligned action buttons. */
  actions?: ReactNode;
  className?: string;
  /** Heading level for correct document outline. */
  as?: 'h1' | 'h2';
}

/** Standard page title block: eyebrow, title (+badge), description, actions. */
export function PageHeader({ title, eyebrow, description, badge, actions, className, as = 'h1' }: PageHeaderProps) {
  const Heading = as;
  return (
    <header className={cx('ui-pageheader', className)}>
      <div className="ui-pageheader__main">
        {eyebrow ? <div className="ui-pageheader__eyebrow">{eyebrow}</div> : null}
        <Heading className="ui-pageheader__title">
          <span className="truncate">{title}</span>
          {badge}
        </Heading>
        {description ? <p className="ui-pageheader__desc">{description}</p> : null}
      </div>
      {actions ? <div className="ui-pageheader__actions">{actions}</div> : null}
    </header>
  );
}
