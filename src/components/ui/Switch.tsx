import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx, useControllableState } from './utils';
import './controls.css';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'type' | 'children'> {
  /** Controlled state. Omit and use `defaultChecked` for uncontrolled. */
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Visible text next to the track. When omitted, pass `aria-label`. */
  label?: ReactNode;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, defaultChecked = false, onCheckedChange, label, disabled, className, onClick, ...rest },
  ref,
) {
  const [on, setOn] = useControllableState(checked, defaultChecked, onCheckedChange);

  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        setOn(!on);
      }}
      className={cx('ui-switch', disabled && 'ui-switch--disabled', className)}
    >
      <span className="ui-switch__track" aria-hidden="true">
        <span className="ui-switch__thumb" />
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
});
