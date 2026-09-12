/**
 * The Muse — https://www.themuse.com/api/public/jobs
 *
 * Keyless. No keyword parameter; it supports `page`, `descending`, and repeatable
 * `category`/`location` filters. 20 results per page, so we pull the first two pages.
 *
 * Item: `{ id, name, contents, publication_date, locations:[{name}], categories:[{name}],
 *          levels:[{name}], company:{name}, refs:{landing_page}, type }`
 */
import type { JobSearchQuery } from '../../../shared/types';
import { fetchJson } from '../http';
import { asString, asStringList, buildJob, normalizeAll, pickArray } from '../normalize';
import type { JobSourceAdapter, SourceContext } from '../types';

const ENDPOINT = 'https://www.themuse.com/api/public/jobs';
const PAGES = [1, 2];

function museLocation(query: JobSearchQuery): string {
  const location = (query.location ?? '').trim();
  if (!location) return '';
  // The Muse expects "City, State" exactly; "Remote" is spelled "Flexible / Remote".
  return /^remote$/i.test(location) ? 'Flexible / Remote' : location;
}

function buildUrl(query: JobSearchQuery, page: number): string {
  const url = new URL(ENDPOINT);
  url.searchParams.set('page', String(page));
  url.searchParams.set('descending', 'true');
  const location = museLocation(query);
  if (location) url.searchParams.append('location', location);
  return url.toString();
}

async function fetchPage(query: JobSearchQuery, ctx: SourceContext, page: number) {
  const payload = await fetchJson(buildUrl(query, page), { fetch: ctx.fetch, signal: ctx.signal });
  return pickArray(payload, 'results');
}

export const theMuseSource: JobSourceAdapter = {
  source: 'themuse',
  needsKey: false,

  disabledReason() {
    return null;
  },

  cacheKey(query: JobSearchQuery) {
    return `location=${museLocation(query).toLowerCase()}`;
  },

  async fetchJobs(query, ctx) {
    const pages = await Promise.all(PAGES.map((page) => fetchPage(query, ctx, page)));
    const items = pages.flat();

    return normalizeAll(items, (item) => {
      const company = item.company as Record<string, unknown> | undefined;
      const refs = item.refs as Record<string, unknown> | undefined;
      const locations = asStringList(item.locations);
      const categories = asStringList(item.categories);
      const levels = asStringList(item.levels);

      return buildJob({
        source: 'themuse',
        sourceId: asString(item.id),
        title: item.name,
        company: company?.name,
        location: locations.join(' · ') || 'Not specified',
        remote: locations.some((entry) => /remote|flexible/i.test(entry)),
        employmentTypeTags: levels,
        category: categories[0],
        tags: [...categories, ...levels],
        descriptionHtml: item.contents,
        url: refs?.landing_page ?? item.short_name,
        postedAt: item.publication_date,
        fetchedAt: ctx.fetchedAt,
      });
    });
  },
};
