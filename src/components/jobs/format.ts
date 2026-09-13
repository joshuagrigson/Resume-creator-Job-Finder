/**
 * Small pure formatters shared by the job finder UI. No React, no store access —
 * everything here is deterministic so the components stay easy to test.
 */
import type { EmploymentType, Job, JobSalary, JobSource, SourceStatus } from '@shared/types';
import { JOB_SOURCE_LABELS } from '@shared/types';

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "3d ago", "2h ago", "just now". Returns an empty string for unusable input. */
export function relativeTime(iso: string | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const diff = now - then;
  if (diff < 0) return 'just now';
  if (diff < 45 * MINUTE) {
    const minutes = Math.floor(diff / MINUTE);
    return minutes < 1 ? 'just now' : `${minutes}m ago`;
  }
  if (diff < DAY) return `${Math.max(1, Math.round(diff / HOUR))}h ago`;
  const days = Math.floor(diff / DAY);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Absolute posted date for tooltips / `title` attributes. */
export function absoluteDate(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** "312ms" / "1.4s" for the source status strip. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Salary
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CAD: 'CA$',
  AUD: 'A$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  CHF: 'CHF ',
  SEK: 'SEK ',
  PLN: 'PLN ',
  BRL: 'R$',
};

function currencyPrefix(currency: string | undefined): string {
  if (!currency) return '';
  const code = currency.trim().toUpperCase();
  return CURRENCY_SYMBOLS[code] ?? `${code} `;
}

const PERIOD_SUFFIX: Record<NonNullable<JobSalary['period']>, string> = {
  year: '/yr',
  month: '/mo',
  hour: '/hr',
  unknown: '',
};

/** 120000 → "120k", 1500 → "1,500", 45.5 → "45.50". */
export function abbreviateAmount(value: number): string {
  if (!Number.isFinite(value)) return '';
  const abs = Math.abs(value);
  if (abs >= 10_000) {
    const thousands = value / 1000;
    const rounded = Math.round(thousands * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}k`;
  }
  if (Number.isInteger(value)) return value.toLocaleString('en-US');
  return value.toFixed(2);
}

/**
 * "$120k – $150k/yr", "£45/hr", or the source's own display string.
 * Returns null when there is nothing worth showing.
 */
export function formatSalary(salary: JobSalary | undefined): string | null {
  if (!salary) return null;
  const prefix = currencyPrefix(salary.currency);
  const suffix = PERIOD_SUFFIX[salary.period ?? 'unknown'] ?? '';
  const min = typeof salary.min === 'number' && Number.isFinite(salary.min) ? salary.min : undefined;
  const max = typeof salary.max === 'number' && Number.isFinite(salary.max) ? salary.max : undefined;

  if (min !== undefined && max !== undefined && max > min) {
    return `${prefix}${abbreviateAmount(min)} – ${prefix}${abbreviateAmount(max)}${suffix}`;
  }
  const single = min ?? max;
  if (single !== undefined) {
    const lead = min !== undefined && max === undefined ? 'From ' : '';
    return `${lead}${prefix}${abbreviateAmount(single)}${suffix}`;
  }
  const display = (salary.display ?? '').trim();
  return display || null;
}

// ---------------------------------------------------------------------------
// Job bits
// ---------------------------------------------------------------------------

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  internship: 'Internship',
  temporary: 'Temporary',
  other: 'Other',
};

export function sourceLabel(source: JobSource): string {
  return JOB_SOURCE_LABELS[source] ?? source;
}

/** First letter of the company name, used as the logo fallback. */
export function companyInitial(company: string | undefined): string {
  const match = /\p{L}|\p{N}/u.exec((company ?? '').trim());
  return match ? match[0].toUpperCase() : '?';
}

/** Location line for a card: falls back to "Remote" when a remote job has no place. */
export function locationLabel(job: Pick<Job, 'location' | 'remote'>): string {
  const location = (job.location ?? '').trim();
  if (location) return location;
  return job.remote ? 'Remote' : 'Location not listed';
}

/** Tone + wording for a source report pill. */
export function sourceStatusMeta(status: SourceStatus): {
  label: string;
  tone: 'success' | 'danger' | 'warning' | 'neutral';
} {
  switch (status) {
    case 'ok':
      return { label: 'Responded', tone: 'success' };
    case 'error':
      return { label: 'Failed', tone: 'danger' };
    case 'timeout':
      return { label: 'Timed out', tone: 'warning' };
    case 'disabled':
      return { label: 'Needs API key', tone: 'neutral' };
    case 'skipped':
    default:
      return { label: 'Not searched', tone: 'neutral' };
  }
}

/** "1–25 of 342" for the results meta line. */
export function rangeLabel(page: number, pageSize: number, total: number, shown: number): string {
  if (total <= 0 || shown <= 0) return '0 jobs';
  const first = (Math.max(1, page) - 1) * pageSize + 1;
  const last = Math.min(total, first + shown - 1);
  if (total <= pageSize) return `${total.toLocaleString('en-US')} ${total === 1 ? 'job' : 'jobs'}`;
  return `${first.toLocaleString('en-US')}–${last.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} jobs`;
}

/** Total number of pages for a result set (at least 1). */
export function pageCount(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(pageSize) || pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Shareable deep link to a posting inside this app. */
export function jobPermalink(jobId: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/jobs/${encodeURIComponent(jobId)}`;
}

/** Human summary of the active filters, used as the default saved-search name. */
export function describeQuery(q: string, location: string | undefined, remoteOnly: boolean | undefined): string {
  const keywords = (q ?? '').trim();
  const place = (location ?? '').trim();
  const parts: string[] = [];
  parts.push(keywords || 'All jobs');
  if (place) parts.push(`in ${place}`);
  else if (remoteOnly) parts.push('· Remote');
  return parts.join(' ');
}
