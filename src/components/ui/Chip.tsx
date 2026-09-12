import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from './utils';
import './controls.css';

export type ChipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect' | 'onToggle'> {
  tone?: ChipTone;
  /** Renders as a toggle button with `aria-pressed`. */
  selected?: boolean;
  /** When provided the chip is a toggle button; otherwise it is a static span. */
  onToggle?: (selected: boolean) => void;
  /** Shows an inline remove button. */
  onRemove?: () => void;
  /** Accessible name for the remove button; defaults to "Remove <text>". */
  removeLabel?: string;
  leftIcon?: ReactNode;
  children: ReactNode;
}

/** Small pill for skills, tags, filters. Interactive when `onToggle` or `onRemove` is set. */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { tone = 'neutral', selected, onToggle, onRemove, removeLabel, leftIcon, className, children, disabled, ...rest },
  ref,
) {
  const classes = cx(
    'ui-chip',
    tone !== 'neutral' && tone !== 'accent' && `ui-chip--${tone}`,
    (tone === 'accent' || selected) && 'ui-chip--selected',
    className,
  );

  const inner = (
    <>
      {leftIcon ? <span aria-hidden="true">{leftIcon}</span> : null}
      <span className="ui-chip__text">{children}</span>
      {onRemove ? (
        <span
          role="button"
          tabIndex={0}
          className="ui-chip__remove"
          aria-label={removeLabel ?? (typeof children === 'string' ? `Remove ${children}` : 'Remove')}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
        >
          <X size={12} aria-hidden="true" />
        </span>
      ) : null}
    </>
  );

  if (onToggle) {
    return (
      <button
        {...rest}
        ref={ref}
        type="button"
        disabled={disabled}
        aria-pressed={Boolean(selected)}
        onClick={(e) => {
          rest.onClick?.(e);
          if (e.defaultPrevented) return;
          onToggle(!selected);
        }}
        className={classes}
      >
        {inner}
      </button>
    );
  }

  return (
    <span {...(rest as React.HTMLAttributes<HTMLSpanElement>)} className={classes}>
      {inner}
    </span>
  );
});
