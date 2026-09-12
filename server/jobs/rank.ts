/**
 * Relevance ranking.
 *
 * A term that hits the title counts for much more than one buried in the description:
 *   score = title×5 + tags×3 + company×2 + description×1
 * Ties break on recency, then on id so the ordering is fully deterministic across runs.
 */
import type { Job, JobSearchQuery } from '../../shared/types';

export const FIELD_WEIGHTS = { title: 5, tags: 3, company: 2, description: 1 } as const;

/** Number of the query's terms present in each weighted field, times that field's weight. */
export function scoreRelevance(job: Job, terms: readonly string[]): number {
  if (terms.length === 0) return 0;
  const title = job.title.toLowerCase();
  const company = job.company.toLowerCase();
  const tags = job.tags.join(' ').toLowerCase();
  const description = job.descriptionText.toLowerCase();

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += FIELD_WEIGHTS.title;
    if (tags.includes(term)) score += FIELD_WEIGHTS.tags;
    if (company.includes(term)) score += FIELD_WEIGHTS.company;
    if (description.includes(term)) score += FIELD_WEIGHTS.description;
  }
  return score;
}

function postedTime(job: Job): number {
  const ms = Date.parse(job.postedAt);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Sort by the requested order. `relevance` falls back to recency for equal scores (and with
 * an empty query every score is 0, so it degrades gracefully into a newest-first list).
 */
export function rankJobs(
  jobs: readonly Job[],
  terms: readonly string[],
  sort: NonNullable<JobSearchQuery['sort']> = 'relevance',
): Job[] {
  const scored = jobs.map((job) => ({
    job,
    score: sort === 'date' ? 0 : scoreRelevance(job, terms),
    posted: postedTime(job),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.posted !== a.posted) return b.posted - a.posted;
    return a.job.id < b.job.id ? -1 : a.job.id > b.job.id ? 1 : 0;
  });

  return scored.map((entry) => entry.job);
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Slice after ranking. Out-of-range pages return an empty list with an honest total. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const requestedSize = Math.floor(pageSize);
  const safeSize = Number.isFinite(requestedSize) && requestedSize > 0 ? Math.min(100, requestedSize) : 25;
  const requestedPage = Math.floor(page);
  const safePage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const start = (safePage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    page: safePage,
    pageSize: safeSize,
    total: items.length,
  };
}
