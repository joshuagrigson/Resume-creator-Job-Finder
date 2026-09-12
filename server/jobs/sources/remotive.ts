/**
 * Remotive — https://remotive.com/api/remote-jobs
 *
 * Keyless. Supports `search` and `limit`. Everything it lists is remote.
 * Response: `{ jobs: [{ id, url, title, company_name, company_logo, category, tags,
 *              job_type, publication_date, candidate_required_location, salary, description }] }`
 * `publication_date` has no timezone suffix and is UTC.
 */
import type { JobSearchQuery } from '../../../shared/types';
import { fetchJson } from '../http';
import { asString, buildJob, normalizeAll, pickArray } from '../normalize';
import type { JobSourceAdapter } from '../types';

const ENDPOINT = 'https://remotive.com/api/remote-jobs';
const LIMIT = 120;

export const remotiveSource: JobSourceAdapter = {
  source: 'remotive',
  needsKey: false,

  disabledReason() {
    return null;
  },

  cacheKey(query: JobSearchQuery) {
    return `search=${(query.q ?? '').trim().toLowerCase()}`;
  },

  async fetchJobs(query, ctx) {
    const url = new URL(ENDPOINT);
    url.searchParams.set('limit', String(LIMIT));
    const search = (query.q ?? '').trim();
    if (search) url.searchParams.set('search', search);

    const payload = await fetchJson(url.toString(), { fetch: ctx.fetch, signal: ctx.signal });

    return normalizeAll(pickArray(payload, 'jobs'), (item) =>
      buildJob({
        source: 'remotive',
        sourceId: asString(item.id),
        title: item.title,
        company: item.company_name,
        companyLogo: item.company_logo_url ?? item.company_logo,
        location: asString(item.candidate_required_location) || 'Remote',
        remote: true,
        employmentType: item.job_type,
        category: item.category,
        tags: item.tags,
        salary: { display: item.salary },
        descriptionHtml: item.description,
        url: item.url,
        postedAt: item.publication_date,
        fetchedAt: ctx.fetchedAt,
      }),
    );
  },
};
