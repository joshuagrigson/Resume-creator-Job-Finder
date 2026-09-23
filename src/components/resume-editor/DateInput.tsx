/**
 * Month-precision date field with an optional "Current" checkbox.
 *
 * Typed with the number pad only: "062022" shows as "06 / 2022" and is stored as
 * "2022-06". The separator is drawn, never typed, so a phone keyboard never switches
 * layouts mid-date. A finished date, or Enter, moves straight on to the next field.
 */
import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Checkbox, Field, Input } from '@/components/ui';
import {
  formatMonthDigits,
  monthDigitsFrom,
  monthDigitsToValue,
  nextMonthDigits,
} from '@/lib/resume/monthMask';

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

const FOCUSABLE = 'input:not([type="hidden"]):not([type="checkbox"]):not([disabled]), textarea:not([disabled]), select:not([disabled])';

/** Focus the next text field on the page, so dates can be typed start-to-end without tapping. */
function focusNextField(from: HTMLElement) {
  const fields = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE));
  const next = fields[fields.indexOf(from) + 1];
  next?.focus();
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
  const [digits, setDigits] = useState(() => monthDigitsFrom(value));
  const [touched, setTouched] = useState(false);
  // What we last reported upward, so our own onChange echoing back as `value` doesn't
  // overwrite a half-typed date.
  const emitted = useRef(value);

  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setDigits(monthDigitsFrom(value));
  }, [value]);

  const display = formatMonthDigits(digits);
  const incomplete = digits.length > 0 && digits.length < 6;
  const invalidStored = digits.length === 0 && isInvalidMonth(value);

  function emit(next: string) {
    const nextValue = monthDigitsToValue(next) ?? '';
    if (nextValue !== emitted.current) {
      emitted.current = nextValue;
      onChange(nextValue);
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = nextMonthDigits(digits, display, event.target.value);
    setDigits(next);
    emit(next);
    if (next.length === 6 && digits.length < 6) focusNextField(event.target);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      focusNextField(event.currentTarget);
    }
  }

  const error =
    touched && incomplete
      ? 'Finish the date: 2 digits for the month, then 4 for the year.'
      : invalidStored
        ? 'That date could not be read. Type it as numbers, e.g. 062022.'
        : undefined;

  return (
    <div className="re-date">
      <Field label={label} htmlFor={id} hint={hint ?? 'Just the numbers, e.g. 062022'} error={error}>
        <Input
          type="text"
          value={display}
          disabled={disabled}
          placeholder="MM / YYYY"
          inputMode="numeric"
          pattern="[0-9 /]*"
          enterKeyHint="next"
          autoComplete="off"
          maxLength={9}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTouched(true)}
          onFocus={() => setTouched(false)}
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
