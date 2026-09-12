/**
 * USAJOBS — https://data.usajobs.gov/api/search
 *
 * Requires `USAJOBS_API_KEY` plus `USAJOBS_USER_AGENT` (the email address registered with
 * the API). Both are sent as headers. Without them the adapter reports `disabled` and is
 * never called.
 *
 * Response: `SearchResult.SearchResultItems[].MatchedObjectDescriptor` with
 * `{ PositionID, PositionTitle, OrganizationName, PositionLocationDisplay, PositionURI,
 *    PublicationStartDate, ApplicationCloseDate, PositionSchedule, JobCategory,
 *    PositionRemuneration:[{MinimumRange, MaximumRange, RateIntervalCode}],
 *    UserArea.Details.JobSummary }`
 */
import type { JobSearchQuery } from '../../../shared/types';
import { fetchJson } from '../http';
import { asString, asStringList, buildJob, normalizeAll } from '../normalize';
import type { JobSourceAdapter, SourceEnv } from '../types';

const ENDPOINT = 'https://data.usajobs.gov/api/search';
const RESULTS_PER_PAGE = 50;

interface Credentials {
  apiKey: string;
  userAgent: string;
}

function credentials(env: SourceEnv): Credentials | null {
  const apiKey = (env.USAJOBS_API_KEY ?? '').trim();
  const userAgent = (env.USAJOBS_USER_AGENT ?? '').trim();
  if (!apiKey || !userAgent) return null;
  return { apiKey, userAgent };
}

/** `RateIntervalCode` values: PA (per year), PH (per hour), PM (per month), BW/PD/… */
function periodFromRateCode(code: string): string {
  switch (code.toUpperCase()) {
    case 'PA':
    case 'PY':
      return 'year';
    case 'PH':
      return 'hour';
    case 'PM':
      return 'month';
    default:
      return '';
  }
}

export const usaJobsSource: JobSourceAdapter = {
  source: 'usajobs',
  needsKey: true,

  disabledReason(env) {
    return credentials(env) ? null : 'USAJOBS_API_KEY and USAJOBS_USER_AGENT are not set';
  },

  cacheKey(query: JobSearchQuery) {
    return `keyword=${(query.q ?? '').trim().toLowerCase()}&location=${(query.location ?? '').trim().toLowerCase()}`;
  },

  async fetchJobs(query, ctx) {
    const creds = credentials(ctx.env);
    if (!creds) throw new Error('USAJOBS credentials are not configured');

    const url = new URL(ENDPOINT);
    url.searchParams.set('ResultsPerPage', String(RESULTS_PER_PAGE));
    const keyword = (query.q ?? '').trim();
    if (keyword) url.searchParams.set('Keyword', keyword);
    const location = (query.location ?? '').trim();
    if (location && !/^remote$/i.test(location)) url.searchParams.set('LocationName', location);

    const payload = await fetchJson<Record<string, unknown>>(url.toString(), {
      fetch: ctx.fetch,
      signal: ctx.signal,
      headers: {
        Host: 'data.usajobs.gov',
        'User-Agent': creds.userAgent,
        'Authorization-Key': creds.apiKey,
      },
    });

    const searchResult = payload?.SearchResult as Record<string, unknown> | undefined;
    const rawItems = Array.isArray(searchResult?.SearchResultItems) ? searchResult.SearchResultItems : [];

    return normalizeAll(rawItems, (entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const descriptor = (entry as Record<string, unknown>).MatchedObjectDescriptor as
        | Record<string, unknown>
        | undefined;
      if (!descriptor) return null;

      const userArea = descriptor.UserArea as Record<string, unknown> | undefined;
      const details = userArea?.Details as Record<string, unknown> | undefined;
      const remuneration = Array.isArray(descriptor.PositionRemuneration)
        ? (descriptor.PositionRemuneration[0] as Record<string, unknown> | undefined)
        : undefined;
      const schedule = asStringList(descriptor.PositionSchedule);
      const categories = asStringList(descriptor.JobCategory);
      const location = asStringList(descriptor.PositionLocationDisplay).join(', ') ||
        asString(descriptor.PositionLocationDisplay);

      return buildJob({
        source: 'usajobs',
        sourceId: asString(descriptor.PositionID) || asString((entry as Record<string, unknown>).MatchedObjectId),
        title: descriptor.PositionTitle,
        company: descriptor.OrganizationName,
        location,
        remote: asString(details?.TeleworkEligible) === 'true' || /remote/i.test(location),
        employmentType: schedule,
        category: categories[0],
        tags: categories,
        salary: {
          min: remuneration?.MinimumRange,
          max: remuneration?.MaximumRange,
          currency: asString(remuneration?.RateIntervalCode) ? 'USD' : undefined,
          period: periodFromRateCode(asString(remuneration?.RateIntervalCode)),
        },
        descriptionHtml: details?.JobSummary,
        url: descriptor.PositionURI,
        postedAt: descriptor.PublicationStartDate,
        fetchedAt: ctx.fetchedAt,
      });
    });
  },
};
