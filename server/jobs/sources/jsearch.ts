/**
 * JSearch (OpenWeb Ninja) — Google for Jobs as an API.
 *
 * Google for Jobs indexes listings from Indeed, LinkedIn, Glassdoor, ZipRecruiter and
 * employers' own career sites, so this one source is how Indeed-listed jobs reach
 * Launchpad without scraping Indeed (which Indeed's terms forbid and its bot wall blocks).
 *
 * Requires `JSEARCH_API_KEY` (free tier: 200 requests/month). Two ways to buy it:
 *   JSEARCH_PROVIDER=openwebninja (default) → https://api.openwebninja.com/jsearch/search-v2, header x-api-key
 *   JSEARCH_PROVIDER=rapidapi               → https://jsearch.p.rapidapi.com/search, headers X-RapidAPI-*
 *
 * Item: `{ job_id, job_title, employer_name, employer_logo, job_publisher, job_apply_link,
 *          apply_options:[{publisher, apply_link, is_direct}], job_description, job_is_remote,
 *          job_city, job_state, job_country, job_location, job_latitude, job_longitude,
 *          job_posted_at_datetime_utc, job_employment_type, job_min_salary, job_max_salary,
 *          job_salary_period, job_salary_string }`
 */
import type { JobSearchQuery } from '../../../shared/types';
import { fetchJson } from '../http';
import { asString, buildJob, normalizeAll, pickArray } from '../normalize';
import type { JobSourceAdapter, SourceEnv } from '../types';

type Provider = 'openwebninja' | 'rapidapi';

function config(env: SourceEnv): { key: string; provider: Provider } | null {
  const key = (env.JSEARCH_API_KEY ?? '').trim();
  if (!key) return null;
  const provider: Provider = (env.JSEARCH_PROVIDER ?? '').trim().toLowerCase() === 'rapidapi' ? 'rapidapi' : 'openwebninja';
  return { key, provider };
}

/** JSearch reads the place out of the query text: "forklift operator in Texarkana, TX". */
export function jsearchQueryText(query: JobSearchQuery): string {
  const what = (query.q ?? '').trim() || 'jobs';
  const where = (query.location ?? '').trim();
  return where && !/^remote$/i.test(where) ? `${what} in ${where}` : what;
}

function datePosted(days: number | undefined): string | undefined {
  if (!days || days <= 0) return undefined;
  if (days <= 1) return 'today';
  if (days <= 3) return '3days';
  if (days <= 7) return 'week';
  if (days <= 31) return 'month';
  return undefined;
}

/**
 * The link to apply through. Google for Jobs usually offers several; the employer's own
 * site (`is_direct`) is preferred, because that's where "Opens for you" should land and
 * it avoids routing him through a board that wants its own account.
 */
export function bestApplyLink(item: Record<string, unknown>): { url: string; via: string } {
  const options = Array.isArray(item.apply_options) ? (item.apply_options as Record<string, unknown>[]) : [];
  const direct = options.find((o) => o && o.is_direct === true && asString(o.apply_link));
  const pick = direct ?? options.find((o) => o && asString(o.apply_link));
  if (pick) return { url: asString(pick.apply_link), via: direct ? 'Employer site' : asString(pick.publisher) };
  return { url: asString(item.job_apply_link), via: asString(item.job_publisher) };
}

export const jsearchSource: JobSourceAdapter = {
  source: 'jsearch',
  needsKey: true,
  searchesByRadius: true,

  disabledReason(env) {
    return config(env) ? null : 'JSEARCH_API_KEY is not set';
  },

  cacheKey(query: JobSearchQuery) {
    return `q=${jsearchQueryText(query).toLowerCase()}&radius=${query.radiusMiles ?? ''}&days=${query.postedWithinDays ?? ''}&remote=${query.remoteOnly ? 1 : 0}`;
  },

  async fetchJobs(query, ctx) {
    const cfg = config(ctx.env);
    if (!cfg) throw new Error('JSearch API key is not configured');

    const url =
      cfg.provider === 'rapidapi'
        ? new URL('https://jsearch.p.rapidapi.com/search')
        : new URL('https://api.openwebninja.com/jsearch/search-v2');
    url.searchParams.set('query', jsearchQueryText(query));
    url.searchParams.set('country', (ctx.env.JSEARCH_COUNTRY ?? 'us').trim().toLowerCase() || 'us');
    if (cfg.provider === 'rapidapi') {
      url.searchParams.set('page', '1');
      url.searchParams.set('num_pages', '1');
    }
    const posted = datePosted(query.postedWithinDays);
    if (posted) url.searchParams.set('date_posted', posted);
    if (query.remoteOnly) url.searchParams.set(cfg.provider === 'rapidapi' ? 'remote_jobs_only' : 'work_from_home', 'true');
    // JSearch measures the radius in kilometres.
    if (query.radiusMiles && query.location) url.searchParams.set('radius', String(Math.round(query.radiusMiles * 1.609344)));

    const headers: Record<string, string> =
      cfg.provider === 'rapidapi'
        ? { 'X-RapidAPI-Key': cfg.key, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' }
        : { 'x-api-key': cfg.key };

    const payload = await fetchJson<Record<string, unknown>>(url.toString(), { fetch: ctx.fetch, signal: ctx.signal, headers });
    const data = payload?.data;
    const items = Array.isArray(data) ? pickArray(data) : pickArray(data, 'jobs', 'data');

    return normalizeAll(items, (item) => {
      const city = asString(item.job_city);
      const state = asString(item.job_state);
      const location = [city, state].filter(Boolean).join(', ') || asString(item.job_location) || asString(item.job_country);
      const apply = bestApplyLink(item);
      const job = buildJob({
        source: 'jsearch',
        sourceId: item.job_id,
        title: item.job_title,
        company: item.employer_name,
        companyLogo: item.employer_logo,
        location,
        remote: item.job_is_remote === true,
        employmentType: item.job_employment_type,
        tags: [],
        salary: {
          min: item.job_min_salary,
          max: item.job_max_salary,
          currency: 'USD',
          period: item.job_salary_period,
          display: item.job_salary_string,
        },
        descriptionText: item.job_description,
        url: apply.url,
        postedAt: item.job_posted_at_datetime_utc,
        fetchedAt: ctx.fetchedAt,
        geo:
          item.job_latitude !== undefined && item.job_longitude !== undefined
            ? [{ lat: item.job_latitude, lon: item.job_longitude }]
            : [],
      });
      if (job && apply.via) job.via = apply.via;
      return job;
    });
  },
};
