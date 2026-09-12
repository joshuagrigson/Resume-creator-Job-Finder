import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from './utils';
import { useFieldControl } from './Field';
import type { ControlSize } from './Input';
import './controls.css';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'children'> {
  uiSize?: ControlSize;
  invalid?: boolean;
  /** Convenience alternative to passing `<option>` children. */
  options?: SelectOption[];
  /** Shown as a disabled first option when the value is empty. */
  placeholder?: string;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { uiSize = 'md', invalid, options, placeholder, className, children, ...rest },
  ref,
) {
  const field = useFieldControl({ id: rest.id, invalid, 'aria-describedby': rest['aria-describedby'], required: rest.required });

  return (
    <span className={cx('ui-select-wrap', className)}>
      <select
        {...rest}
        ref={ref}
        id={field.id}
        required={field.required}
        aria-describedby={field.describedBy}
        aria-invalid={field.invalid || undefined}
        className={cx('ui-select', uiSize !== 'md' && `ui-select--${uiSize}`)}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown className="ui-select-wrap__chevron" size={15} aria-hidden="true" />
    </span>
  );
});
