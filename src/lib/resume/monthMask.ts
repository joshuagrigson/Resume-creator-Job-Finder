/**
 * Digits-only month entry ("MM / YYYY") for résumé dates.
 *
 * The field only ever needs the number pad: the separator is drawn by the mask, never
 * typed, so a phone keyboard never has to switch layouts for a dash, slash or dot.
 *
 *   "3"      → "03 / "      (a month can't start with 2–9, so the 0 is implied)
 *   "062022" → "06 / 2022"  → stored as "2022-06"
 */

const MAX_DIGITS = 6;

/**
 * Keep only digits a valid MM + YYYY can contain, in order. A digit that would make the
 * month impossible (13, 00) is dropped rather than accepted and flagged later.
 */
export function normalizeMonthDigits(input: string): string {
  let out = '';
  for (const ch of input.replace(/\D/g, '')) {
    if (out.length === 0 && ch >= '2') out = '0';
    if (out.length === 1) {
      const month = Number(out + ch);
      if (month < 1 || month > 12) continue;
    }
    // Years are 19xx or 20xx; anything else is a slip of the thumb.
    if (out.length === 2 && ch !== '1' && ch !== '2') continue;
    if (out.length === 3 && ((out[2] === '1' && ch !== '9') || (out[2] === '2' && ch !== '0'))) continue;
    out += ch;
    if (out.length >= MAX_DIGITS) break;
  }
  return out.slice(0, MAX_DIGITS);
}

/** "0620" → "06 / 20". Two digits show the separator straight away so the year follows. */
export function formatMonthDigits(digits: string): string {
  if (digits.length === 0) return '';
  if (digits.length < 2) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

/** Complete digits → "YYYY-MM"; anything shorter → null. */
export function monthDigitsToValue(digits: string): string | null {
  if (digits.length !== MAX_DIGITS) return null;
  return `${digits.slice(2)}-${digits.slice(0, 2)}`;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Stored value or pasted text → mask digits. Understands "2021-03", "03/2021", "3/2021",
 * "03.2021", "March 2021" and "Mar '21" is left alone (too ambiguous).
 */
export function monthDigitsFrom(text: string): string {
  const t = text.trim();
  if (!t) return '';
  let m = t.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return normalizeMonthDigits(m[2]!.padStart(2, '0') + m[1]);
  m = t.match(/^(\d{1,2})\s*[/.\-\s]\s*(\d{4})$/);
  if (m) return normalizeMonthDigits(m[1]!.padStart(2, '0') + m[2]);
  m = t.match(/^([a-z]{3,9})\.?\s+(\d{4})$/i);
  if (m) {
    const index = MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase());
    if (index >= 0) return String(index + 1).padStart(2, '0') + m[2];
  }
  return normalizeMonthDigits(t);
}

/**
 * The next digits after an edit. When the only thing removed was the drawn separator
 * (backspace right after "06 / "), the digits are unchanged — so drop one, or the mask
 * would redraw the separator and backspace would appear to do nothing.
 */
export function nextMonthDigits(previousDigits: string, previousDisplay: string, typed: string): string {
  const digits = normalizeMonthDigits(typed);
  if (digits === previousDigits && typed.length < previousDisplay.length) return previousDigits.slice(0, -1);
  return digits;
}
