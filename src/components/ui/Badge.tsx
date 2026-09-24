import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './utils';
import './surfaces.css';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'metal';
export type BadgeVariant = 'soft' | 'solid' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: 'sm' | 'lg';
  /** Leading status dot — useful when colour alone must not carry meaning. */
  dot?: boolean;
  leftIcon?: ReactNode;
  children: ReactNode;
}

/** Compact status label. Always pair colour with text so meaning is never colour-only. */
export function Badge({ tone = 'neutral', variant = 'soft', size = 'sm', dot, leftIcon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={cx('ui-badge', `ui-badge--${variant}`, `ui-badge--${tone}`, size === 'lg' && 'ui-badge--lg', className)}
    >
      {dot ? <span className="ui-badge__dot" aria-hidden="true" /> : null}
      {leftIcon ? <span aria-hidden="true">{leftIcon}</span> : null}
      {children}
    </span>
  );
}
