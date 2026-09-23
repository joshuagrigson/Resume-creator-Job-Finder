/**
 * JSearch (Google for Jobs): the keyed source that brings in Indeed, LinkedIn and
 * Glassdoor listings without scraping any of them.
 */
import { describe, expect, it } from 'vitest';
import { bestApplyLink, jsearchQueryText, jsearchSource } from '../server/jobs/sources/jsearch';
import { assertValidJob, makeContext } from './jobs.helpers';

const ITEM = {
  job_id: 'abc123==',
  job_title: 'Forklift Operator',
  employer_name: 'Twin City Freight',
  employer_logo: 'https://example.com/logo.png',
  job_publisher: 'Indeed',
  job_apply_link: 'https://www.indeed.com/viewjob?jk=abc',
  apply_options: [
    { publisher: 'Indeed', apply_link: 'https://www.indeed.com/viewjob?jk=abc', is_direct: false },
    { publisher: 'Twin City Freight Careers', apply_link: 'https://careers.twincity.example/jobs/42', is_direct: true },
  ],
  job_description: 'Operate a sit-down forklift. Forklift certification required. Lift 50 lbs.',
  job_is_remote: false,
  job_city: 'Texarkana',
  job_state: 'AR',
  job_country: 'US',
  job_latitude: 33.436,
  job_longitude: -93.987,
  job_posted_at_datetime_utc: '2026-09-21T14:00:00.000Z',
  job_employment_type: 'FULLTIME',
  job_min_salary: 17,
  job_max_salary: 19,
  job_salary_period: 'HOUR',
};

function capture(body: unknown) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

describe('jsearch source', () => {
  it('is off without a key and never calls out', () => {
    expect(jsearchSource.needsKey).toBe(true);
    expect(jsearchSource.disabledReason({})).toMatch(/JSEARCH_API_KEY/);
    expect(jsearchSource.disabledReason({ JSEARCH_API_KEY: 'k' })).toBeNull();
  });

  it('puts the place in the query text and the radius in kilometres', async () => {
    const { calls, fetchImpl } = capture({ status: 'OK', data: [ITEM] });
    await jsearchSource.fetchJobs(
      { q: 'forklift', location: 'Texarkana, TX', radiusMiles: 25, postedWithinDays: 7 },
      makeContext(fetchImpl, { JSEARCH_API_KEY: 'secret' }),
    );
    const url = new URL(calls[0]!.url);
    expect(url.origin + url.pathname).toBe('https://api.openwebninja.com/jsearch/search-v2');
    expect(url.searchParams.get('query')).toBe('forklift in Texarkana, TX');
    expect(url.searchParams.get('radius')).toBe('40');
    expect(url.searchParams.get('date_posted')).toBe('week');
    expect(calls[0]!.headers['x-api-key']).toBe('secret');
    // The key travels in a header, never in the URL.
    expect(calls[0]!.url).not.toContain('secret');
  });

  it('speaks the RapidAPI dialect when asked to', async () => {
    const { calls, fetchImpl } = capture({ status: 'OK', data: [] });
    await jsearchSource.fetchJobs({ q: 'stocker', remoteOnly: true }, makeContext(fetchImpl, { JSEARCH_API_KEY: 'k', JSEARCH_PROVIDER: 'rapidapi' }));
    const url = new URL(calls[0]!.url);
    expect(url.host).toBe('jsearch.p.rapidapi.com');
    expect(url.searchParams.get('remote_jobs_only')).toBe('true');
    expect(calls[0]!.headers['X-RapidAPI-Key']).toBe('k');
  });

  it('normalizes a Google for Jobs listing, with coordinates and the employer\'s own apply link', async () => {
    const { fetchImpl } = capture({ status: 'OK', data: [ITEM, { job_title: 'broken' }] });
    const jobs = await jsearchSource.fetchJobs({ q: 'forklift' }, makeContext(fetchImpl, { JSEARCH_API_KEY: 'k' }));
    expect(jobs).toHaveLength(1);
    const job = jobs[0]!;
    expect(assertValidJob(job, 'jsearch')).toEqual([]);
    expect(job.location).toBe('Texarkana, AR');
    expect(job.url).toBe('https://careers.twincity.example/jobs/42');
    expect(job.via).toBe('Employer site');
    expect(job.geo).toEqual([{ lat: 33.436, lon: -93.987 }]);
    expect(job.salary).toMatchObject({ min: 17, max: 19, period: 'hour' });
    expect(job.employmentType).toBe('full_time');
  });

  it('accepts the v2 shape where jobs sit under data.jobs', async () => {
    const { fetchImpl } = capture({ status: 'OK', data: { jobs: [ITEM], cursor: 'next' } });
    const jobs = await jsearchSource.fetchJobs({ q: 'forklift' }, makeContext(fetchImpl, { JSEARCH_API_KEY: 'k' }));
    expect(jobs).toHaveLength(1);
  });

  it('falls back to the board link when no employer link is offered', () => {
    expect(bestApplyLink({ job_apply_link: 'https://www.indeed.com/viewjob?jk=1', job_publisher: 'Indeed' })).toEqual({
      url: 'https://www.indeed.com/viewjob?jk=1',
      via: 'Indeed',
    });
  });

  it('builds query text without a place for remote searches', () => {
    expect(jsearchQueryText({ q: 'data entry', location: 'remote' })).toBe('data entry');
    expect(jsearchQueryText({ q: '' })).toBe('jobs');
  });
});
