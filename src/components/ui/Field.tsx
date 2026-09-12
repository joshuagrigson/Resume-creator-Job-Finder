import { createContext, useContext, useId, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cx } from './utils';
import './controls.css';

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldProps {
  label?: ReactNode;
  /** Helper text under the control. Hidden while an error is shown. */
  hint?: ReactNode;
  /** Error message; also flags the control as invalid. */
  error?: ReactNode;
  required?: boolean;
  /** Label to the left of the control instead of above (good for switches). */
  horizontal?: boolean;
  /** Override the generated id shared by label + control. */
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Label + hint + error wrapper. Any `Input`/`Textarea`/`Select` rendered inside picks up
 * the generated id, `aria-describedby` and `aria-invalid` automatically.
 */
export function Field({ label, hint, error, required = false, horizontal = false, htmlFor, className, children }: FieldProps) {
  const auto = useId();
  const id = htmlFor ?? auto;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, !error ? hintId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>
      <div className={cx('ui-field', horizontal && 'ui-field--horizontal', className)}>
        {label ? (
          <label className="ui-field__label" htmlFor={id}>
            {label}
            {required ? (
              <span className="ui-field__req" aria-hidden="true">
                *
              </span>
            ) : null}
          </label>
        ) : null}
        <div className={horizontal ? undefined : 'grow'}>{children}</div>
        {error ? (
          <span className="ui-field__error" id={errorId} role="alert">
            <AlertCircle size={13} aria-hidden="true" />
            {error}
          </span>
        ) : hint ? (
          <span className="ui-field__hint" id={hintId}>
            {hint}
          </span>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export interface FieldControlProps {
  id?: string;
  invalid?: boolean;
  'aria-describedby'?: string;
  required?: boolean;
}

/**
 * Used by form controls to inherit the surrounding `Field`'s wiring.
 * Explicit props always win over the context.
 */
export function useFieldControl(props: FieldControlProps): {
  id: string | undefined;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean | undefined;
} {
  const ctx = useContext(FieldContext);
  const describedBy = [props['aria-describedby'], ctx?.describedBy].filter(Boolean).join(' ') || undefined;
  return {
    id: props.id ?? ctx?.id,
    describedBy,
    invalid: props.invalid ?? ctx?.invalid ?? false,
    required: props.required ?? ctx?.required,
  };
}
