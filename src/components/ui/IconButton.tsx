import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from './utils';
import './controls.css';

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required accessible name — icon-only buttons have no text. */
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  loading?: boolean;
  /** Renders in the "on" state (e.g. a toggled filter). Also sets aria-pressed. */
  active?: boolean;
}

const SPINNER_SIZE: Record<IconButtonSize, number> = { sm: 12, md: 14, lg: 17 };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', size = 'md', loading = false, active, disabled, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-label={label}
      title={rest.title ?? label}
      aria-pressed={active === undefined ? undefined : active}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cx(
        'ui-iconbtn',
        `ui-iconbtn--${variant}`,
        size !== 'md' && `ui-iconbtn--${size}`,
        active && 'ui-iconbtn--active',
        className,
      )}
    >
      {loading ? <Loader2 size={SPINNER_SIZE[size]} className="ui-spin" aria-hidden="true" /> : icon}
    </button>
  );
});
