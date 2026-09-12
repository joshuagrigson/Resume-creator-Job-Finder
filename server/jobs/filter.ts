/**
 * Local filtering. Every board returns far more than the user asked for (several ignore the
 * query entirely), so the real search happens here against the normalized, cached corpus.
 */
import type { Job, JobSearchQuery } from '../../shared/types';

const REMOTE_TOKEN_RE = /\b(remote|anywhere|worldwide)\b/;
const ANYWHERE_RE = /\b(anywhere|worldwide|global|international)\b/;

/**
 * Split a query into required terms. Quoted spans stay together as a single phrase:
 *   `senior "product manager" saas` → ['senior', 'product manager', 'saas']
 * Everything is lowercased; tokens like `c++`, `c#`, `.net`, `node.js` survive intact.
 */
export function parseQueryTerms(q: string | undefined): string[] {
  if (!q) return [];
  const terms: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const term = raw.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!term || seen.has(term)) return;
    seen.add(term);
    terms.push(term);
  };

  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(q)) !== null) {
    const phrase = match[1] ?? match[2];
    if (phrase !== undefined) {
      push(phrase);
    } else {
      // Trim punctuation that only ever appears as a separator.
      push((match[3] ?? '').replace(/^[,;:!?()[\]{}]+|[,;:!?()[\]{}]+$/g, ''));
    }
  }
  return terms;
}

/** Lowercased title + company + tags + description, built once per job per search. */
export function haystack(job: Job): string {
  return `${job.title}\n${job.company}\n${job.tags.join(' ')}\n${job.descriptionText}`.toLowerCase();
}

/** Every term must appear somewhere in the job. */
export function matchesTerms(job: Job, terms: readonly string[]): boolean {
  if (terms.length === 0) return true;
  const text = haystack(job);
  return terms.every((term) => text.includes(term));
}

/**
 * Location matching.
 *
 * - Empty query matches everything.
 * - Comma/slash separated parts are OR'd ("austin, remote").
 * - A part containing `remote`/`anywhere`/`worldwide` matches remote roles; any extra words
 *   in that part must still appear in the job's location (or the job must be worldwide),
 *   so "remote us" keeps US-restricted and worldwide remote roles but drops "Remote (EU)".
 * - Anything else is a plain case-insensitive substring test on `job.location`.
 */
export function matchesLocation(job: Job, location: string | undefined): boolean {
  const query = (location ?? '').trim().toLowerCase();
  if (!query) return true;

  const jobLocation = job.location.toLowerCase();
  const parts = query
    .split(/[,;/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return true;

  return parts.some((part) => {
    if (!REMOTE_TOKEN_RE.test(part)) return jobLocation.includes(part);
    const isRemoteJob = job.remote || REMOTE_TOKEN_RE.test(jobLocation);
    if (!isRemoteJob) return false;
    const rest = part.replace(new RegExp(REMOTE_TOKEN_RE.source, 'g'), ' ').replace(/\s+/g, ' ').trim();
    if (!rest) return true;
    return jobLocation.includes(rest) || ANYWHERE_RE.test(jobLocation) || jobLocation === '';
  });
}

export function matchesPostedWithin(job: Job, days: number | undefined, now: Date): boolean {
  if (!days || !Number.isFinite(days) || days <= 0) return true;
  const posted = Date.parse(job.postedAt);
  if (Number.isNaN(posted)) return true;
  return posted >= now.getTime() - days * 24 * 60 * 60 * 1000;
}

export interface FilterOptions {
  now?: Date;
  /** Pre-parsed terms, so ranking and filtering can share one parse. */
  terms?: string[];
}

/** Apply every query constraint. Order of the input list is preserved. */
export function filterJobs(jobs: readonly Job[], query: JobSearchQuery, options: FilterOptions = {}): Job[] {
  const now = options.now ?? new Date();
  const terms = options.terms ?? parseQueryTerms(query.q);

  return jobs.filter((job) => {
    if (query.remoteOnly && !job.remote) return false;
    if (query.employmentType && job.employmentType !== query.employmentType) return false;
    if (!matchesPostedWithin(job, query.postedWithinDays, now)) return false;
    if (!matchesLocation(job, query.location)) return false;
    return matchesTerms(job, terms);
  });
}
