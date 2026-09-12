/**
 * Himalayas — https://himalayas.app/jobs/api
 *
 * Keyless, remote-only. Supports `limit` (max 50) and `offset`; there is no keyword filter,
 * so one cached page serves every query.
 *
 * Item: `{ title, excerpt, companyName, companySlug, companyLogo, employmentType, minSalary,
 *          maxSalary, salaryPeriod, currency, seniority, locationRestrictions,
 *          timezoneRestrictions, categories, parentCategories, description, pubDate,
 *          expiryDate, applicationLink, guid }` — `pubDate` is epoch seconds and there is no
 *          numeric id, so the guid path is used as the source id.
 */
import { fetchJson } from '../http';
import { asString, asStringList, buildJob, normalizeAll, pickArray } from '../normalize';
import type { JobSourceAdapter } from '../types';

const ENDPOINT = 'https://himalayas.app/jobs/api?limit=50&offset=0';

/** `https://himalayas.app/companies/acme/jobs/staff-engineer` → `acme/staff-engineer`. */
function idFromGuid(guid: string, companySlug: string, title: string): string {
  try {
    const segments = new URL(guid).pathname.split('/').filter(Boolean);
    const slug = segments[segments.length - 1];
    if (slug) return companySlug ? `${companySlug}/${slug}` : slug;
  } catch {
    /* fall through to the derived id below */
  }
  const derived = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return companySlug ? `${companySlug}/${derived}` : derived;
}

export const himalayasSource: JobSourceAdapter = {
  source: 'himalayas',
  needsKey: false,

  disabledReason() {
    return null;
  },

  cacheKey() {
    return 'limit=50&offset=0';
  },

  async fetchJobs(_query, ctx) {
    const payload = await fetchJson(ENDPOINT, { fetch: ctx.fetch, signal: ctx.signal });

    return normalizeAll(pickArray(payload, 'jobs'), (item) => {
      const guid = asString(item.guid) || asString(item.applicationLink);
      const companySlug = asString(item.companySlug);
      const title = asString(item.title);
      const restrictions = asStringList(item.locationRestrictions);
      const categories = asStringList(item.parentCategories);
      const seniority = asStringList(item.seniority);

      return buildJob({
        source: 'himalayas',
        sourceId: idFromGuid(guid, companySlug, title),
        title,
        company: item.companyName,
        companyLogo: item.companyLogo,
        location: restrictions.length > 0 ? `Remote — ${restrictions.join(', ')}` : 'Remote',
        remote: true,
        employmentType: item.employmentType,
        category: categories[0],
        tags: [...categories, ...seniority],
        salary: {
          min: item.minSalary,
          max: item.maxSalary,
          currency: item.currency,
          period: item.salaryPeriod,
        },
        descriptionHtml: item.description,
        descriptionText: item.excerpt,
        url: item.applicationLink ?? item.guid,
        postedAt: item.pubDate,
        fetchedAt: ctx.fetchedAt,
      });
    });
  },
};
