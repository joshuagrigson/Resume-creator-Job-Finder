/**
 * Adzuna — https://api.adzuna.com/v1/api/jobs/{country}/search/{page}
 *
 * Requires `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` (free developer tier). Without both the
 * adapter reports `disabled` and is never called, so no request is ever made with a
 * missing key. Country defaults to `us` and can be overridden with `ADZUNA_COUNTRY`.
 *
 * Item: `{ id, title, company:{display_name}, location:{display_name, area}, description,
 *          redirect_url, created, salary_min, salary_max, contract_type, contract_time,
 *          category:{label} }`
 */
import type { JobSearchQuery } from '../../../shared/types';
import { fetchJson } from '../http';
import { asString, buildJob, normalizeAll, pickArray } from '../normalize';
import type { JobSourceAdapter, SourceEnv } from '../types';

const RESULTS_PER_PAGE = 50;
const SUPPORTED_COUNTRIES = new Set([
  'gb',
  'us',
  'at',
  'au',
  'be',
  'br',
  'ca',
  'ch',
  'de',
  'es',
  'fr',
  'in',
  'it',
  'mx',
  'nl',
  'nz',
  'pl',
  'sg',
  'za',
]);

/** Adzuna reports salaries in the country's own currency and does not name it in the payload. */
const COUNTRY_CURRENCY: Readonly<Record<string, string>> = {
  gb: 'GBP',
  us: 'USD',
  at: 'EUR',
  au: 'AUD',
  be: 'EUR',
  br: 'BRL',
  ca: 'CAD',
  ch: 'CHF',
  de: 'EUR',
  es: 'EUR',
  fr: 'EUR',
  in: 'INR',
  it: 'EUR',
  mx: 'MXN',
  nl: 'EUR',
  nz: 'NZD',
  pl: 'PLN',
  sg: 'SGD',
  za: 'ZAR',
};

function country(env: SourceEnv): string {
  const raw = (env.ADZUNA_COUNTRY ?? 'us').trim().toLowerCase();
  return SUPPORTED_COUNTRIES.has(raw) ? raw : 'us';
}

function credentials(env: SourceEnv): { appId: string; appKey: string } | null {
  const appId = (env.ADZUNA_APP_ID ?? '').trim();
  const appKey = (env.ADZUNA_APP_KEY ?? '').trim();
  if (!appId || !appKey) return null;
  return { appId, appKey };
}

export const adzunaSource: JobSourceAdapter = {
  source: 'adzuna',
  needsKey: true,
  searchesByRadius: true,

  disabledReason(env) {
    return credentials(env) ? null : 'ADZUNA_APP_ID and ADZUNA_APP_KEY are not set';
  },

  cacheKey(query: JobSearchQuery) {
    const what = (query.q ?? '').trim().toLowerCase();
    const where = (query.location ?? '').trim().toLowerCase();
    return `what=${what}&where=${where}&radius=${query.radiusMiles ?? ''}&days=${query.postedWithinDays ?? ''}&remote=${query.remoteOnly ? 1 : 0}`;
  },

  async fetchJobs(query, ctx) {
    const creds = credentials(ctx.env);
    if (!creds) throw new Error('Adzuna credentials are not configured');

    const countryCode = country(ctx.env);
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1`);
    url.searchParams.set('app_id', creds.appId);
    url.searchParams.set('app_key', creds.appKey);
    url.searchParams.set('results_per_page', String(RESULTS_PER_PAGE));
    url.searchParams.set('content-type', 'application/json');
    const what = (query.q ?? '').trim();
    if (what) url.searchParams.set('what', what);
    const where = (query.location ?? '').trim();
    if (where && !/^remote$/i.test(where)) {
      url.searchParams.set('where', where);
      // Adzuna measures from the centre of `where` in kilometres and defaults to 5 km.
      if (query.radiusMiles) url.searchParams.set('distance', String(Math.round(query.radiusMiles * 1.609344)));
    }
    if (query.remoteOnly) url.searchParams.set('what_or', 'remote');
    if (query.postedWithinDays && query.postedWithinDays > 0) {
      url.searchParams.set('max_days_old', String(Math.min(365, Math.round(query.postedWithinDays))));
    }

    const payload = await fetchJson(url.toString(), { fetch: ctx.fetch, signal: ctx.signal });

    return normalizeAll(pickArray(payload, 'results'), (item) => {
      const company = item.company as Record<string, unknown> | undefined;
      const location = item.location as Record<string, unknown> | undefined;
      const category = item.category as Record<string, unknown> | undefined;
      const locationText = asString(location?.display_name);

      return buildJob({
        source: 'adzuna',
        sourceId: asString(item.id),
        title: item.title,
        company: company?.display_name,
        location: locationText,
        employmentType: [asString(item.contract_time), asString(item.contract_type)].filter(Boolean).join(' '),
        category: category?.label,
        tags: category?.label ? [asString(category.label)] : [],
        salary: {
          min: item.salary_min,
          max: item.salary_max,
          currency: COUNTRY_CURRENCY[countryCode] ?? 'USD',
          period: 'year',
        },
        descriptionHtml: item.description,
        url: item.redirect_url,
        postedAt: item.created,
        fetchedAt: ctx.fetchedAt,
        geo: item.latitude !== undefined && item.longitude !== undefined ? [{ lat: item.latitude, lon: item.longitude }] : [],
      });
    });
  },
};
