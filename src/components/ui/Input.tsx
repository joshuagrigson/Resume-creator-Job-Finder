import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from './utils';
import { useFieldControl } from './Field';
import './controls.css';

export type ControlSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visual size (the native `size` attribute is not used). */
  uiSize?: ControlSize;
  invalid?: boolean;
  /** Decoration inside the field, e.g. a search icon. */
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { uiSize = 'md', invalid, leftIcon, rightSlot, className, type = 'text', ...rest },
  ref,
) {
  const field = useFieldControl({ id: rest.id, invalid, 'aria-describedby': rest['aria-describedby'], required: rest.required });

  const input = (
    <input
      {...rest}
      ref={ref}
      type={type}
      id={field.id}
      required={field.required}
      aria-describedby={field.describedBy}
      aria-invalid={field.invalid || undefined}
      className={cx('ui-input', uiSize !== 'md' && `ui-input--${uiSize}`, !leftIcon && !rightSlot ? className : undefined)}
    />
  );

  if (!leftIcon && !rightSlot) return input;

  return (
    <span
      className={cx(
        'ui-input-wrap',
        leftIcon && 'ui-input-wrap--has-left',
        rightSlot && 'ui-input-wrap--has-right',
        className,
      )}
    >
      {leftIcon ? (
        <span className="ui-input__adornment ui-input__adornment--left" aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}
      {input}
      {rightSlot ? (
        <span className="ui-input__adornment ui-input__adornment--right ui-input__adornment--interactive">{rightSlot}</span>
      ) : null}
    </span>
  );
});
