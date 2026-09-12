/**
 * Turning wildly different board payloads into one `Job` shape.
 *
 * Every helper here is total: bad input produces a sensible default, never an exception,
 * because a single malformed item must never take down a whole source.
 */
import type { EmploymentType, Job, JobSalary, JobSource } from '../../shared/types';
import { MAX_DESCRIPTION_TEXT_CHARS, sanitizeHtml, toDescriptionText } from './sanitize';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return value.toString();
  return '';
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.\-]/g, '');
    if (!cleaned || cleaned === '-' || cleaned === '.') return undefined;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** Flatten a value that may be a string, an array of strings, or an array of `{name}` objects. */
export function asStringList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') {
    return value
      .split(/[,;|]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' || typeof item === 'number') {
      const s = asString(item);
      if (s) out.push(s);
    } else if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const s = asString(
        record.name ?? record.Name ?? record.label ?? record.title ?? record.value ?? record.Value,
      );
      if (s) out.push(s);
    }
  }
  return out;
}

/** Lowercased, trimmed, de-duplicated, capped. */
export function normalizeTags(value: unknown, limit = 25): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of asStringList(value)) {
    const tag = raw.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!tag || tag.length > 40) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const NAIVE_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse whatever a board calls a publication date into an ISO string.
 * Accepts epoch seconds, epoch milliseconds, ISO strings with or without a zone,
 * and plain `YYYY-MM-DD`. Falls back to `fallbackIso` when nothing parses.
 */
export function toIsoDate(value: unknown, fallbackIso: string): string {
  const parsed = tryParseDate(value);
  return parsed ?? fallbackIso;
}

function tryParseDate(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const ms = value < 1e11 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{9,13}$/.test(raw)) return tryParseDate(Number(raw));

  // Naive local timestamps from several boards are actually UTC.
  const candidate = NAIVE_DATETIME_RE.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : DATE_ONLY_RE.test(raw)
      ? `${raw}T00:00:00Z`
      : raw;

  const ms = Date.parse(candidate);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  // Guard against absurd values (bad epochs show up as year 1970 or year 55000).
  const year = d.getUTCFullYear();
  if (year < 1990 || year > 2100) return null;
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Remote / employment type / salary
// ---------------------------------------------------------------------------

const REMOTE_WORDS = /\b(remote|anywhere|worldwide|work[\s-]?from[\s-]?home|distributed|telecommut\w*|virtual)\b/i;

/** True when the location, tags, or an explicit flag say the role is remote. */
export function detectRemote(location: string, tags: readonly string[], explicit?: boolean): boolean {
  if (explicit === true) return true;
  if (REMOTE_WORDS.test(location)) return true;
  return tags.some((tag) => REMOTE_WORDS.test(tag));
}

const EMPLOYMENT_PATTERNS: ReadonlyArray<[RegExp, EmploymentType]> = [
  [/\b(intern|internship|praktikum|trainee|apprentice\w*|ausbildung|werkstudent)\b/i, 'internship'],
  [/\b(part[\s_-]?time|teilzeit|minijob)\b/i, 'part_time'],
  [/\b(contract\w*|freelance\w*|b2b|consultan\w*|self[\s-]?employed|1099)\b/i, 'contract'],
  [/\b(temporary|temp|seasonal|interim|befristet)\b/i, 'temporary'],
  [/\b(full[\s_-]?time|vollzeit|permanent|festanstellung)\b/i, 'full_time'],
  [/\b(volunteer|other)\b/i, 'other'],
];

function matchEmploymentPattern(haystack: string): EmploymentType | undefined {
  for (const [pattern, type] of EMPLOYMENT_PATTERNS) {
    if (pattern.test(haystack)) return type;
  }
  return undefined;
}

/**
 * Map a board's dedicated employment-type field onto our enum. Unrecognised but non-empty
 * values become `other`; an empty field yields `undefined`.
 */
export function mapEmploymentType(value: unknown): EmploymentType | undefined {
  const candidates = asStringList(value);
  if (candidates.length === 0) return undefined;
  return matchEmploymentPattern(candidates.join(' ')) ?? 'other';
}

/**
 * Map an employment type out of a general-purpose tag list (Remote OK, Arbeitnow…).
 * Returns `undefined` unless a tag genuinely looks like an employment type, so unrelated
 * tags such as `exec` or `senior` never masquerade as `other`.
 */
export function employmentTypeFromTags(value: unknown): EmploymentType | undefined {
  const candidates = asStringList(value);
  if (candidates.length === 0) return undefined;
  return matchEmploymentPattern(candidates.join(' '));
}

const PERIOD_PATTERNS: ReadonlyArray<[RegExp, NonNullable<JobSalary['period']>]> = [
  [/\b(hour|hourly|hr|per hour|\/hr|\/hour)\b/i, 'hour'],
  [/\b(day|daily|per day|\/day)\b/i, 'unknown'],
  [/\b(week|weekly|per week|\/wk)\b/i, 'unknown'],
  [/\b(month|monthly|per month|\/mo)\b/i, 'month'],
  [/\b(year|yearly|annual|annually|annum|per year|\/yr|pa)\b/i, 'year'],
];

export function mapSalaryPeriod(value: unknown): NonNullable<JobSalary['period']> | undefined {
  const text = asString(value);
  if (!text) return undefined;
  for (const [pattern, period] of PERIOD_PATTERNS) {
    if (pattern.test(text)) return period;
  }
  return undefined;
}

const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₹': 'INR',
  '¥': 'JPY',
  '₽': 'RUB',
  '₩': 'KRW',
  'C$': 'CAD',
  A$: 'AUD',
};

const CURRENCY_CODE_RE = /\b(USD|EUR|GBP|CAD|AUD|NZD|CHF|SEK|NOK|DKK|PLN|INR|JPY|BRL|MXN|SGD|ZAR|AED|ILS)\b/i;

export interface SalaryInput {
  min?: unknown;
  max?: unknown;
  currency?: unknown;
  period?: unknown;
  display?: unknown;
}

/** Build a `JobSalary`, dropping zero/absent numbers and inferring currency + period. */
export function normalizeSalary(input: SalaryInput): JobSalary | undefined {
  const display = asString(input.display);
  let min = asFiniteNumber(input.min);
  let max = asFiniteNumber(input.max);
  if (min !== undefined && min <= 0) min = undefined;
  if (max !== undefined && max <= 0) max = undefined;
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];

  let currency = asString(input.currency).toUpperCase();
  if (currency.length !== 3) currency = '';
  let period = mapSalaryPeriod(input.period);

  if (min === undefined && max === undefined && display) {
    const parsed = parseSalaryText(display);
    min = parsed.min;
    max = parsed.max;
    if (!currency && parsed.currency) currency = parsed.currency;
    if (!period && parsed.period) period = parsed.period;
  }
  if (!currency && display) {
    const parsed = parseSalaryText(display);
    if (parsed.currency) currency = parsed.currency;
  }

  if (min === undefined && max === undefined && !display) return undefined;

  if (!period && (min !== undefined || max !== undefined)) {
    const sample = max ?? min ?? 0;
    period = sample >= 2000 ? 'year' : sample >= 200 ? 'month' : 'hour';
  }

  const salary: JobSalary = {};
  if (min !== undefined) salary.min = Math.round(min);
  if (max !== undefined) salary.max = Math.round(max);
  if (currency) salary.currency = currency;
  if (period) salary.period = period;
  if (display) salary.display = display.slice(0, 120);
  return salary;
}

interface ParsedSalaryText {
  min?: number;
  max?: number;
  currency?: string;
  period?: NonNullable<JobSalary['period']>;
}

/** Best-effort numbers out of strings like "OTE $25k - $35k" or "€60.000 – €80.000 per year". */
export function parseSalaryText(text: string): ParsedSalaryText {
  const result: ParsedSalaryText = {};
  if (!text) return result;

  const codeMatch = CURRENCY_CODE_RE.exec(text);
  if (codeMatch?.[1]) {
    result.currency = codeMatch[1].toUpperCase();
  } else {
    for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
      if (text.includes(symbol)) {
        result.currency = code;
        break;
      }
    }
  }

  result.period = mapSalaryPeriod(text);

  const numbers: number[] = [];
  const numberRe = /(\d[\d.,]*)\s*([kKmM])?/g;
  let match: RegExpExecArray | null;
  while ((match = numberRe.exec(text)) !== null) {
    const rawNumber = match[1] ?? '';
    const suffix = (match[2] ?? '').toLowerCase();
    // "60.000" (European) vs "60.5" — treat a dot followed by exactly 3 digits as a separator.
    const normalized = rawNumber.replace(/,/g, '').replace(/\.(?=\d{3}\b)/g, '');
    const value = Number.parseFloat(normalized);
    if (!Number.isFinite(value) || value <= 0) continue;
    const scaled = suffix === 'k' ? value * 1000 : suffix === 'm' ? value * 1_000_000 : value;
    if (scaled < 1 || scaled > 100_000_000) continue;
    numbers.push(Math.round(scaled));
    if (numbers.length >= 4) break;
  }

  if (numbers.length === 1) {
    result.min = numbers[0];
  } else if (numbers.length >= 2) {
    const sorted = [...numbers].sort((a, b) => a - b);
    result.min = sorted[0];
    result.max = sorted[sorted.length - 1];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Job assembly
// ---------------------------------------------------------------------------

export interface RawJobInput {
  source: JobSource;
  sourceId: unknown;
  title: unknown;
  company: unknown;
  companyLogo?: unknown;
  location?: unknown;
  /** Explicit remote flag from the board, when it has one. */
  remote?: boolean;
  /** A dedicated employment-type field from the board. */
  employmentType?: unknown;
  /** A general tag list to mine for an employment type only when one is clearly present. */
  employmentTypeTags?: unknown;
  category?: unknown;
  tags?: unknown;
  salary?: SalaryInput;
  descriptionHtml?: unknown;
  /** Used when the board gives plain text instead of HTML. */
  descriptionText?: unknown;
  url: unknown;
  postedAt?: unknown;
  fetchedAt: string;
}

const HTTP_URL_RE = /^https?:\/\//i;

function safeUrl(value: unknown): string {
  const raw = asString(value);
  if (!raw) return '';
  const candidate = HTTP_URL_RE.test(raw) ? raw : raw.startsWith('//') ? `https:${raw}` : '';
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function collapse(value: unknown, max: number): string {
  return asString(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Build a `Job`. Returns `null` when the item is unusable (no title, company, or apply URL)
 * so adapters can simply skip it.
 */
export function buildJob(input: RawJobInput): Job | null {
  const title = collapse(input.title, 200);
  const company = collapse(input.company, 160);
  const url = safeUrl(input.url);
  const sourceId = collapse(input.sourceId, 200);
  if (!title || !company || !url || !sourceId) return null;

  const tags = normalizeTags(input.tags);
  const location = collapse(input.location, 160) || (input.remote ? 'Remote' : '');
  const descriptionHtml = sanitizeHtml(input.descriptionHtml);
  const explicitText = asString(input.descriptionText);
  const descriptionText = descriptionHtml
    ? toDescriptionText(descriptionHtml)
    : explicitText.slice(0, MAX_DESCRIPTION_TEXT_CHARS);

  const job: Job = {
    id: `${input.source}:${sourceId}`,
    source: input.source,
    sourceId,
    title,
    company,
    location,
    remote: detectRemote(location, tags, input.remote),
    tags,
    descriptionHtml,
    descriptionText,
    url,
    postedAt: toIsoDate(input.postedAt, input.fetchedAt),
    fetchedAt: input.fetchedAt,
  };

  const logo = safeUrl(input.companyLogo);
  if (logo) job.companyLogo = logo;

  const employmentType = mapEmploymentType(input.employmentType) ?? employmentTypeFromTags(input.employmentTypeTags);
  if (employmentType) job.employmentType = employmentType;

  const category = collapse(input.category, 80);
  if (category) job.category = category;

  if (input.salary) {
    const salary = normalizeSalary(input.salary);
    if (salary) job.salary = salary;
  }

  return job;
}

/** Map a list of raw items through a per-item builder, skipping anything that fails. */
export function normalizeAll<T>(items: readonly T[], build: (item: T) => Job | null): Job[] {
  const out: Job[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    let job: Job | null = null;
    try {
      job = build(item);
    } catch {
      job = null;
    }
    if (!job || seen.has(job.id)) continue;
    seen.add(job.id);
    out.push(job);
  }
  return out;
}

/** Narrow an unknown payload to an array of records. */
export function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
}

/** Read `payload[key]` as an array of records (for `{jobs:[…]}` / `{data:[…]}` shapes). */
export function pickArray(payload: unknown, ...keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(payload)) return asRecordArray(payload);
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(record[key])) return asRecordArray(record[key]);
  }
  return [];
}
