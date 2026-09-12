/**
 * Remote OK — https://remoteok.com/api
 *
 * Keyless, no query parameters at all: it returns one ~600 KB array of the latest ~100 jobs,
 * whose FIRST element is a legal notice object (`{ legal, last_updated }`) and must be skipped.
 * We fetch it once per TTL and filter locally.
 *
 * Item: `{ slug, id, epoch, date, company, company_logo, position, tags, description,
 *          location, apply_url, url, salary_min, salary_max, logo }`
 */
import { fetchJson } from '../http';
import { asString, buildJob, normalizeAll, asRecordArray } from '../normalize';
import type { JobSourceAdapter } from '../types';

const ENDPOINT = 'https://remoteok.com/api';

export const remoteOkSource: JobSourceAdapter = {
  source: 'remoteok',
  needsKey: false,

  disabledReason() {
    return null;
  },

  cacheKey() {
    // The endpoint ignores every query parameter — one cached copy serves all searches.
    return 'all';
  },

  async fetchJobs(_query, ctx) {
    const payload = await fetchJson(ENDPOINT, { fetch: ctx.fetch, signal: ctx.signal });
    const items = asRecordArray(payload).filter((item) => item.legal === undefined && item.position !== undefined);

    return normalizeAll(items, (item) =>
      buildJob({
        source: 'remoteok',
        sourceId: asString(item.id) || asString(item.slug),
        title: item.position,
        company: item.company,
        companyLogo: item.company_logo ?? item.logo,
        location: asString(item.location) || 'Remote',
        remote: true,
        employmentTypeTags: item.tags,
        tags: item.tags,
        salary: { min: item.salary_min, max: item.salary_max, currency: 'USD', period: 'year' },
        descriptionHtml: item.description,
        url: item.url ?? item.apply_url,
        postedAt: item.epoch ?? item.date,
        fetchedAt: ctx.fetchedAt,
      }),
    );
  },
};
