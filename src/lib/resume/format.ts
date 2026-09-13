/**
 * Presentation-level formatting shared by the resume preview templates and the DOCX export.
 *
 * Everything here is pure and dependency-free so it can run in the browser, in a print
 * iframe, and in node (docx export tests).
 */

export const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** En dash used between dates. */
export const DATE_SEPARATOR = '–';

/**
 * `"2021-03"` → `"Mar 2021"`. A bare year (`"2021"`) stays as-is, and anything that is not a
 * recognised month string is returned trimmed so free-text dates ("Summer 2020") survive.
 */
export function formatMonth(value: string | undefined | null, style: 'short' | 'long' = 'short'): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';

  const match = /^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/.exec(raw);
  if (match) {
    const year = match[1];
    const monthIndex = Number(match[2]) - 1;
    const names = style === 'long' ? MONTH_NAMES : MONTH_ABBREVIATIONS;
    const name = names[monthIndex];
    return name ? `${name} ${year}` : year;
  }

  if (/^\d{4}$/.test(raw)) return raw;
  return raw;
}

/**
 * `formatRange("2021-03", "", true)` → `"Mar 2021 – Present"`.
 * Missing halves degrade gracefully: only a start → `"Mar 2021 – Present"` is *not* assumed,
 * you get just `"Mar 2021"` unless `current` says otherwise.
 */
export function formatRange(
  startDate: string | undefined | null,
  endDate: string | undefined | null,
  current = false,
  style: 'short' | 'long' = 'short',
): string {
  const start = formatMonth(startDate, style);
  const end = current ? 'Present' : formatMonth(endDate, style);
  if (start && end) return `${start} ${DATE_SEPARATOR} ${end}`;
  return start || end;
}

/**
 * Strips the protocol and any trailing slash so a URL reads as plain text on a resume:
 * `"https://jordanrivera.dev/"` → `"jordanrivera.dev"`.
 */
export function displayUrl(url: string | undefined | null): string {
  let value = (url ?? '').trim();
  if (!value) return '';
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  value = value.replace(/^mailto:/i, '');
  value = value.replace(/\/+$/, '');
  return value;
}

/** Turns a display URL back into something safe to put in `href`. */
export function linkHref(url: string | undefined | null): string {
  const value = (url ?? '').trim();
  if (!value) return '';
  if (/^(https?|mailto|tel):/i.test(value)) return value;
  return `https://${displayUrl(value)}`;
}

/**
 * Light-touch phone formatting: normalises bare 10/11-digit US numbers and otherwise leaves
 * the user's own formatting (including international numbers) untouched.
 */
export function formatPhone(phone: string | undefined | null): string {
  const raw = (phone ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw.replace(/\s+/g, ' ');

  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw.replace(/\s+/g, ' ');
}

/** Joins the non-empty pieces of a line with a separator. */
export function joinParts(parts: readonly (string | undefined | null)[], separator = ' · '): string {
  return parts
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(separator);
}

/** Trims, collapses whitespace and drops empty entries from a list of strings. */
export function cleanList(values: readonly (string | undefined | null)[] | undefined): string[] {
  return (values ?? [])
    .map((value) => (value ?? '').replace(/\s+/g, ' ').trim())
    .filter((value) => value.length > 0);
}
