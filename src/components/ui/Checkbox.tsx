import { forwardRef, useCallback, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from './utils';
import './controls.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
  /** Mixed state (visual only — `checked` still drives the value). */
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, indeterminate = false, className, disabled, ...rest },
  ref,
) {
  const innerRef = useRef<HTMLInputElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (node) node.indeterminate = indeterminate;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    },
    [ref, indeterminate],
  );

  return (
    <label className={cx('ui-check', disabled && 'ui-check--disabled', className)}>
      <input
        {...rest}
        ref={setRefs}
        type="checkbox"
        disabled={disabled}
        aria-checked={indeterminate ? 'mixed' : undefined}
        className="ui-check__input"
      />
      {label || description ? (
        <span className="ui-check__text">
          {label}
          {description ? <span className="ui-check__desc">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
});
