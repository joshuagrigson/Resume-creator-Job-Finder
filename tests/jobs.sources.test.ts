/**
 * Every adapter is exercised against a small recorded sample of its real payload
 * (captured with curl, descriptions trimmed). No network.
 */
import { describe, expect, it } from 'vitest';
import type { JobSearchQuery, JobSource } from '../shared/types';
import {
  adzunaSource,
  arbeitnowSource,
  himalayasSource,
  jobicySource,
  remoteOkSource,
  remotiveSource,
  theMuseSource,
  usaJobsSource,
} from '../server/jobs/sources/index';
import type { JobSourceAdapter } from '../server/jobs/types';
import { assertValidJob, failingFetch, fixtureFetch, makeContext } from './jobs.helpers';

import arbeitnowFixture from './fixtures/jobs/arbeitnow.json';
import adzunaFixture from './fixtures/jobs/adzuna.json';
import himalayasFixture from './fixtures/jobs/himalayas.json';
import jobicyFixture from './fixtures/jobs/jobicy.json';
import remoteokFixture from './fixtures/jobs/remoteok.json';
import remotiveFixture from './fixtures/jobs/remotive.json';
import themuseFixture from './fixtures/jobs/themuse.json';
import usajobsFixture from './fixtures/jobs/usajobs.json';

const EMPTY_QUERY: JobSearchQuery = { q: '' };

interface Case {
  adapter: JobSourceAdapter;
  source: JobSource;
  host: string;
  fixture: unknown;
  env?: Record<string, string>;
  minJobs: number;
}

const CASES: Case[] = [
  { adapter: remotiveSource, source: 'remotive', host: 'remotive.com', fixture: remotiveFixture, minJobs: 3 },
  { adapter: remoteOkSource, source: 'remoteok', host: 'remoteok.com', fixture: remoteokFixture, minJobs: 3 },
  { adapter: arbeitnowSource, source: 'arbeitnow', host: 'arbeitnow.com', fixture: arbeitnowFixture, minJobs: 3 },
  { adapter: theMuseSource, source: 'themuse', host: 'themuse.com', fixture: themuseFixture, minJobs: 3 },
  { adapter: jobicySource, source: 'jobicy', host: 'jobicy.com', fixture: jobicyFixture, minJobs: 3 },
  { adapter: himalayasSource, source: 'himalayas', host: 'himalayas.app', fixture: himalayasFixture, minJobs: 3 },
  {
    adapter: adzunaSource,
    source: 'adzuna',
    host: 'api.adzuna.com',
    fixture: adzunaFixture,
    env: { ADZUNA_APP_ID: 'test-id', ADZUNA_APP_KEY: 'test-key' },
    minJobs: 2,
  },
  {
    adapter: usaJobsSource,
    source: 'usajobs',
    host: 'data.usajobs.gov',
    fixture: usajobsFixture,
    env: { USAJOBS_API_KEY: 'test-key', USAJOBS_USER_AGENT: 'tests@example.com' },
    minJobs: 2,
  },
];

describe.each(CASES)('$source adapter', ({ adapter, source, host, fixture, env, minJobs }) => {
  const ctx = () => makeContext(fixtureFetch({ [host]: fixture }), env ?? {});

  it('normalizes its fixture into valid Job objects', async () => {
    const jobs = await adapter.fetchJobs(EMPTY_QUERY, ctx());
    expect(jobs.length).toBeGreaterThanOrEqual(minJobs);
    for (const job of jobs) {
      expect(assertValidJob(job, source)).toEqual([]);
    }
  });

  it('reports a failing upstream by throwing, not by returning junk', async () => {
    await expect(adapter.fetchJobs(EMPTY_QUERY, makeContext(failingFetch(503), env ?? {}))).rejects.toThrow();
  });

  it('produces a stable cache key for the same query', () => {
    expect(adapter.cacheKey(EMPTY_QUERY)).toBe(adapter.cacheKey({ q: '' }));
    expect(typeof adapter.cacheKey(EMPTY_QUERY)).toBe('string');
  });
});

describe('remotive', () => {
  it('sends the search term and a limit', async () => {
    const seen: string[] = [];
    const spy = (async (input: unknown) => {
      seen.push(String(input));
      return new Response(JSON.stringify(remotiveFixture), { status: 200 });
    }) as Parameters<typeof makeContext>[0];

    await remotiveSource.fetchJobs({ q: 'react developer' }, makeContext(spy));
    expect(seen[0]).toContain('search=react+developer');
    expect(seen[0]).toContain('limit=');
  });

  it('marks every posting remote and parses the zone-less publication date', async () => {
    const jobs = await remotiveSource.fetchJobs(EMPTY_QUERY, makeContext(fixtureFetch({ 'remotive.com': remotiveFixture })));
    expect(jobs.every((job) => job.remote)).toBe(true);
    expect(jobs.every((job) => job.postedAt.endsWith('Z'))).toBe(true);
  });

  it('parses the free-text salary field', async () => {
    const jobs = await remotiveSource.fetchJobs(EMPTY_QUERY, makeContext(fixtureFetch({ 'remotive.com': remotiveFixture })));
    const withSalary = jobs.find((job) => job.salary?.display);
    expect(withSalary?.salary?.display).toBeTruthy();
  });
});

describe('remoteok', () => {
  it('skips the legal-notice element that leads the array', async () => {
    const jobs = await remoteOkSource.fetchJobs(EMPTY_QUERY, makeContext(fixtureFetch({ 'remoteok.com': remoteokFixture })));
    expect(jobs).toHaveLength(3);
    expect(jobs.some((job) => /API Terms of Service/i.test(job.title))).toBe(false);
  });

  it('does not invent an employment type from its generic tag list', async () => {
    const jobs = await remoteOkSource.fetchJobs(EMPTY_QUERY, makeContext(fixtureFetch({ 'remoteok.com': remoteokFixture })));
    const bogus = jobs.filter((job) => job.employmentType === 'other');
    expect(bogus).toHaveLength(0);
  });
});

describe('arbeitnow', () => {
  it('converts epoch-second timestamps and honours the remote flag', async () => {
    const jobs = await arbeitnowSource.fetchJobs(
      EMPTY_QUERY,
      makeContext(fixtureFetch({ 'arbeitnow.com': arbeitnowFixture })),
    );
    expect(jobs.every((job) => Date.parse(job.postedAt) > Date.parse('2020-01-01'))).toBe(true);
    const remoteFlags = new Set(jobs.map((job) => job.remote));
    expect(remoteFlags.size).toBeGreaterThan(0);
  });
});

describe('themuse', () => {
  it('requests two pages and flattens them', async () => {
    const seen: string[] = [];
    const spy = (async (input: unknown) => {
      seen.push(String(input));
      return new Response(JSON.stringify(themuseFixture), { status: 200 });
    }) as Parameters<typeof makeContext>[0];

    const jobs = await theMuseSource.fetchJobs(EMPTY_QUERY, makeContext(spy));
    expect(seen).toHaveLength(2);
    expect(seen.some((url) => url.includes('page=1'))).toBe(true);
    expect(seen.some((url) => url.includes('page=2'))).toBe(true);
    // Same fixture twice — the id de-duplication inside normalizeAll keeps one copy.
    expect(jobs).toHaveLength(3);
  });

  it('translates a plain "Remote" location into The Muse\'s own spelling', () => {
    expect(theMuseSource.cacheKey({ q: '', location: 'Remote' })).toContain('flexible / remote');
  });
});

describe('jobicy', () => {
  it('maps a location to a supported geo slug and the first term to a tag', () => {
    expect(jobicySource.cacheKey({ q: 'react developer', location: 'United States' })).toBe('tag=react&geo=usa');
    expect(jobicySource.cacheKey({ q: '', location: 'Nowhereland' })).toBe('tag=&geo=');
  });

  it('normalizes its salary fields', async () => {
    const jobs = await jobicySource.fetchJobs(EMPTY_QUERY, makeContext(fixtureFetch({ 'jobicy.com': jobicyFixture })));
    const paid = jobs.find((job) => job.salary?.min);
    expect(paid?.salary?.currency).toBe('USD');
    expect(paid?.salary?.period).toBe('year');
  });
});

describe('himalayas', () => {
  it('derives a stable id from the guid when the payload has none', async () => {
    const jobs = await himalayasSource.fetchJobs(
      EMPTY_QUERY,
      makeContext(fixtureFetch({ 'himalayas.app': himalayasFixture })),
    );
    expect(jobs.every((job) => job.sourceId.includes('/'))).toBe(true);
    expect(new Set(jobs.map((job) => job.id)).size).toBe(jobs.length);
  });

  it('turns location restrictions into a readable remote location', async () => {
    const jobs = await himalayasSource.fetchJobs(
      EMPTY_QUERY,
      makeContext(fixtureFetch({ 'himalayas.app': himalayasFixture })),
    );
    expect(jobs.every((job) => job.remote)).toBe(true);
    expect(jobs.some((job) => job.location.startsWith('Remote'))).toBe(true);
  });
});

describe('keyed sources', () => {
  it('adzuna reports disabled with a clear reason and is never called without keys', async () => {
    expect(adzunaSource.needsKey).toBe(true);
    expect(adzunaSource.disabledReason({})).toMatch(/ADZUNA_APP_ID/);
    expect(adzunaSource.disabledReason({ ADZUNA_APP_ID: 'x' })).toMatch(/ADZUNA_APP_KEY|ADZUNA_APP_ID/);
    expect(adzunaSource.disabledReason({ ADZUNA_APP_ID: 'x', ADZUNA_APP_KEY: 'y' })).toBeNull();
  });

  it('usajobs reports disabled with a clear reason', () => {
    expect(usaJobsSource.needsKey).toBe(true);
    expect(usaJobsSource.disabledReason({})).toMatch(/USAJOBS_API_KEY/);
    expect(usaJobsSource.disabledReason({ USAJOBS_API_KEY: 'k' })).toMatch(/USAJOBS/);
    expect(
      usaJobsSource.disabledReason({ USAJOBS_API_KEY: 'k', USAJOBS_USER_AGENT: 'me@example.com' }),
    ).toBeNull();
  });

  it('keeps credentials out of the cache key', () => {
    const key = adzunaSource.cacheKey({ q: 'react', location: 'Austin' });
    expect(key).not.toContain('app_key');
    expect(key).toContain('what=react');
  });

  it('sends the USAJOBS credentials as headers, never in the URL', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    const spy = (async (input: unknown, init?: { headers?: Record<string, string> }) => {
      seenUrl = String(input);
      seenHeaders = init?.headers ?? {};
      return new Response(JSON.stringify(usajobsFixture), { status: 200 });
    }) as Parameters<typeof makeContext>[0];

    await usaJobsSource.fetchJobs(
      { q: 'analyst' },
      makeContext(spy, { USAJOBS_API_KEY: 'secret-key', USAJOBS_USER_AGENT: 'me@example.com' }),
    );
    expect(seenUrl).not.toContain('secret-key');
    expect(seenHeaders['Authorization-Key']).toBe('secret-key');
    expect(seenHeaders['User-Agent']).toBe('me@example.com');
  });

  it('maps USAJOBS pay intervals onto our salary periods', async () => {
    const jobs = await usaJobsSource.fetchJobs(
      EMPTY_QUERY,
      makeContext(fixtureFetch({ 'data.usajobs.gov': usajobsFixture }), {
        USAJOBS_API_KEY: 'k',
        USAJOBS_USER_AGENT: 'me@example.com',
      }),
    );
    expect(jobs[0]?.salary).toMatchObject({ min: 99200, max: 153354, currency: 'USD', period: 'year' });
    expect(jobs[1]?.salary).toMatchObject({ min: 21, max: 28, currency: 'USD', period: 'hour' });
    expect(jobs[0]?.remote).toBe(true);
    expect(jobs[1]?.employmentType).toBe('part_time');
  });

  it('maps Adzuna contract fields and drops its zero salaries', async () => {
    const jobs = await adzunaSource.fetchJobs(
      EMPTY_QUERY,
      makeContext(fixtureFetch({ 'api.adzuna.com': adzunaFixture }), {
        ADZUNA_APP_ID: 'id',
        ADZUNA_APP_KEY: 'key',
      }),
    );
    expect(jobs[0]?.employmentType).toBe('full_time');
    expect(jobs[0]?.salary).toMatchObject({ min: 140000, max: 175000, currency: 'USD', period: 'year' });
    expect(jobs[1]?.employmentType).toBe('part_time');
    expect(jobs[1]?.salary).toBeUndefined();
    expect(jobs[1]?.remote).toBe(true);
  });
});
