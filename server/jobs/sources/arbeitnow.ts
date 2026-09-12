/**
 * Arbeitnow — https://www.arbeitnow.com/api/job-board-api
 *
 * Keyless, mostly European (a lot of German-language postings). Page 1 is ~2 MB and 250 items,
 * so it is fetched once per TTL and filtered locally — never per search.
 *
 * Item: `{ slug, company_name, title, description, remote, url, tags, job_types, location,
 *          created_at }` with `created_at` in epoch seconds.
 */
import { fetchJson } from '../http';
import { buildJob, normalizeAll, pickArray } from '../normalize';
import type { JobSourceAdapter } from '../types';

const ENDPOINT = 'https://www.arbeitnow.com/api/job-board-api?page=1';

export const arbeitnowSource: JobSourceAdapter = {
  source: 'arbeitnow',
  needsKey: false,

  disabledReason() {
    return null;
  },

  cacheKey() {
    // The feed is not searchable server-side; one cached page serves every query.
    return 'page=1';
  },

  async fetchJobs(_query, ctx) {
    const payload = await fetchJson(ENDPOINT, { fetch: ctx.fetch, signal: ctx.signal, maxBytes: 8_000_000 });

    return normalizeAll(pickArray(payload, 'data'), (item) =>
      buildJob({
        source: 'arbeitnow',
        sourceId: item.slug,
        title: item.title,
        company: item.company_name,
        location: item.location,
        remote: item.remote === true,
        // `job_types` mixes real types ("Full Time") with seniority ("Senior manager"),
        // so it is treated as a hint list rather than an authoritative field.
        employmentTypeTags: item.job_types,
        tags: item.tags,
        descriptionHtml: item.description,
        url: item.url,
        postedAt: item.created_at,
        fetchedAt: ctx.fetchedAt,
      }),
    );
  },
};
