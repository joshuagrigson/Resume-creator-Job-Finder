import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from './utils';
import './controls.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks clicks. */
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** Stretch to the container width. */
  fullWidth?: boolean;
}

const SPINNER_SIZE: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 17 };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx(
        'ui-btn',
        `ui-btn--${variant}`,
        size !== 'md' && `ui-btn--${size}`,
        fullWidth && 'ui-btn--block',
        loading && 'ui-btn--loading',
        className,
      )}
    >
      {leftIcon ? (
        <span className="ui-btn__icon" aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}
      {children !== undefined && children !== null && children !== false ? (
        <span className="ui-btn__label">{children}</span>
      ) : null}
      {rightIcon ? (
        <span className="ui-btn__icon" aria-hidden="true">
          {rightIcon}
        </span>
      ) : null}
      {loading ? (
        <span className="ui-btn__spinner">
          <Loader2 size={SPINNER_SIZE[size]} className="ui-spin" aria-hidden="true" />
        </span>
      ) : null}
    </button>
  );
});
