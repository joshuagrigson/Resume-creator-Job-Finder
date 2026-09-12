/**
 * Jobicy — https://jobicy.com/api/v2/remote-jobs
 *
 * Keyless, remote-only. Supports `count` (max 50), `tag` (single keyword) and `geo`.
 * Item: `{ id, url, jobSlug, jobTitle, companyName, companyLogo, jobIndustry, jobType,
 *          jobGeo, jobLevel, jobExcerpt, jobDescription, pubDate, salaryMin, salaryMax,
 *          salaryCurrency, salaryPeriod }`
 */
import type { JobSearchQuery } from '../../../shared/types';
import { fetchJson } from '../http';
import { asString, asStringList, buildJob, normalizeAll, pickArray } from '../normalize';
import type { JobSourceAdapter } from '../types';

const ENDPOINT = 'https://jobicy.com/api/v2/remote-jobs';
const COUNT = 50;

/** Jobicy's `geo` accepts slugs like `usa`, `europe`, `uk`, `canada`, `anywhere`. */
const GEO_ALIASES: Readonly<Record<string, string>> = {
  us: 'usa',
  usa: 'usa',
  'united states': 'usa',
  america: 'usa',
  uk: 'uk',
  'united kingdom': 'uk',
  britain: 'uk',
  england: 'uk',
  canada: 'canada',
  europe: 'europe',
  eu: 'europe',
  germany: 'germany',
  france: 'france',
  india: 'india',
  australia: 'australia',
  asia: 'asia',
  'latin america': 'latam',
  latam: 'latam',
  remote: 'anywhere',
  anywhere: 'anywhere',
  worldwide: 'anywhere',
};

function geoFor(query: JobSearchQuery): string {
  const raw = (query.location ?? '').trim().toLowerCase();
  if (!raw) return '';
  return GEO_ALIASES[raw] ?? '';
}

/** Jobicy's `tag` takes a single keyword; we send the first term of the query. */
function tagFor(query: JobSearchQuery): string {
  const first = (query.q ?? '').trim().split(/\s+/)[0] ?? '';
  return first.replace(/["']/g, '').toLowerCase();
}

export const jobicySource: JobSourceAdapter = {
  source: 'jobicy',
  needsKey: false,

  disabledReason() {
    return null;
  },

  cacheKey(query: JobSearchQuery) {
    return `tag=${tagFor(query)}&geo=${geoFor(query)}`;
  },

  async fetchJobs(query, ctx) {
    const url = new URL(ENDPOINT);
    url.searchParams.set('count', String(COUNT));
    const tag = tagFor(query);
    if (tag) url.searchParams.set('tag', tag);
    const geo = geoFor(query);
    if (geo) url.searchParams.set('geo', geo);

    const payload = await fetchJson(url.toString(), { fetch: ctx.fetch, signal: ctx.signal });

    return normalizeAll(pickArray(payload, 'jobs'), (item) => {
      const industries = asStringList(item.jobIndustry);
      const levels = asStringList(item.jobLevel);

      return buildJob({
        source: 'jobicy',
        sourceId: asString(item.id) || asString(item.jobSlug),
        title: item.jobTitle,
        company: item.companyName,
        companyLogo: item.companyLogo,
        location: asString(item.jobGeo) || 'Remote',
        remote: true,
        employmentType: item.jobType,
        category: industries[0],
        tags: [...industries, ...levels],
        salary: {
          min: item.salaryMin ?? item.annualSalaryMin,
          max: item.salaryMax ?? item.annualSalaryMax,
          currency: item.salaryCurrency,
          period: item.salaryPeriod ?? 'year',
        },
        descriptionHtml: item.jobDescription,
        descriptionText: item.jobExcerpt,
        url: item.url,
        postedAt: item.pubDate,
        fetchedAt: ctx.fetchedAt,
      });
    });
  },
};
