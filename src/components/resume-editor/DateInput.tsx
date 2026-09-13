/** Month-precision date field ("YYYY-MM") with an optional "Current" checkbox. */
import { useId } from 'react';
import { Checkbox, Field, Input } from '@/components/ui';

export interface DateInputProps {
  label: string;
  /** "YYYY-MM" or an empty string. */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  disabled?: boolean;
  /** When provided, a checkbox is rendered under the field. */
  current?: boolean;
  onCurrentChange?: (current: boolean) => void;
  currentLabel?: string;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** True when the string is non-empty and not a valid "YYYY-MM" value. */
export function isInvalidMonth(value: string): boolean {
  return value.trim().length > 0 && !MONTH_RE.test(value.trim());
}

export function DateInput({
  label,
  value,
  onChange,
  hint,
  disabled = false,
  current,
  onCurrentChange,
  currentLabel = 'I currently work here',
}: DateInputProps) {
  const id = useId();
  const invalid = isInvalidMonth(value);

  return (
    <div className="re-date">
      <Field
        label={label}
        htmlFor={id}
        hint={hint ?? 'Month and year'}
        error={invalid ? 'Use the YYYY-MM format, for example 2021-03.' : undefined}
      >
        <Input
          type="month"
          value={value}
          disabled={disabled}
          placeholder="YYYY-MM"
          inputMode="numeric"
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
      {onCurrentChange ? (
        <Checkbox
          className="re-date__current"
          label={currentLabel}
          checked={Boolean(current)}
          onChange={(e) => onCurrentChange(e.target.checked)}
        />
      ) : null}
    </div>
  );
}
