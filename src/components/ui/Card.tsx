import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from './utils';
import './surfaces.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Buttons rendered at the top right of the header. */
  actions?: ReactNode;
  footer?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevation?: 'flat' | 'default' | 'raised';
  /** Hover affordance — pair with `onClick` / `role`. */
  interactive?: boolean;
  selected?: boolean;
  /** Skip the inner body padding wrapper (children render directly). */
  bare?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    title,
    subtitle,
    actions,
    footer,
    padding = 'md',
    elevation = 'default',
    interactive = false,
    selected = false,
    bare = false,
    className,
    children,
    ...rest
  },
  ref,
) {
  const hasHeader = Boolean(title || subtitle || actions);
  return (
    <div
      {...rest}
      ref={ref}
      className={cx(
        'ui-card',
        elevation !== 'default' && `ui-card--${elevation}`,
        padding !== 'md' && `ui-card--pad-${padding}`,
        interactive && 'ui-card--interactive',
        selected && 'ui-card--selected',
        className,
      )}
    >
      {hasHeader ? (
        <div className="ui-card__header">
          <div className="ui-card__titles">
            {title ? <h3 className="ui-card__title">{title}</h3> : null}
            {subtitle ? <div className="ui-card__subtitle">{subtitle}</div> : null}
          </div>
          {actions ? <div className="ui-card__actions">{actions}</div> : null}
        </div>
      ) : null}
      {bare ? children : <div className="ui-card__body">{children}</div>}
      {footer ? <div className="ui-card__footer">{footer}</div> : null}
    </div>
  );
});
