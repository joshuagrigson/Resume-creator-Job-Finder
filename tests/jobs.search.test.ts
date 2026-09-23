/**
 * The search orchestrator, driven entirely through injected adapters and fetch stubs.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Job, JobSearchQuery, JobSource } from '../shared/types';
import { clearJobCaches, getJob, listSourceConfig, searchJobs } from '../server/jobs/index';
import type { JobSourceAdapter } from '../server/jobs/types';
import { hangingFetch, makeJob, NOW } from './jobs.helpers';

/** Build a stub adapter with full control over what it does. */
function stubAdapter(
  source: JobSource,
  behaviour: {
    jobs?: Job[];
    throws?: Error;
    hang?: boolean;
    disabled?: string;
    needsKey?: boolean;
    cacheKey?: string;
    onFetch?: () => void;
  },
): JobSourceAdapter {
  return {
    source,
    needsKey: behaviour.needsKey ?? false,
    disabledReason: () => behaviour.disabled ?? null,
    cacheKey: () => behaviour.cacheKey ?? 'k',
    async fetchJobs(_query, ctx) {
      behaviour.onFetch?.();
      if (behaviour.throws) throw behaviour.throws;
      if (behaviour.hang) {
        await hangingFetch()('https://example.test/hang', { signal: ctx.signal });
      }
      return behaviour.jobs ?? [];
    },
  };
}

const BASE: JobSearchQuery = { q: '', page: 1, pageSize: 25 };

beforeEach(() => {
  clearJobCaches();
});

describe('searchJobs — source reporting', () => {
  it('reports ok, error, timeout and disabled honestly in one run', async () => {
    const adapters = [
      stubAdapter('remotive', { jobs: [makeJob({ source: 'remotive', sourceId: '1' })] }),
      stubAdapter('remoteok', { throws: new Error('upstream exploded') }),
      stubAdapter('arbeitnow', { hang: true }),
      stubAdapter('adzuna', { disabled: 'ADZUNA_APP_ID and ADZUNA_APP_KEY are not set', needsKey: true }),
    ];

    const response = await searchJobs(BASE, {
      adapters,
      now: NOW,
      env: {},
      perSourceTimeoutMs: 40,
      overallBudgetMs: 500,
    });

    const byName = new Map(response.sources.map((report) => [report.source, report]));
    expect(byName.get('remotive')).toMatchObject({ status: 'ok', count: 1 });
    expect(byName.get('remoteok')).toMatchObject({ status: 'error', count: 0 });
    expect(byName.get('remoteok')?.error).toContain('upstream exploded');
    expect(byName.get('arbeitnow')).toMatchObject({ status: 'timeout', count: 0 });
    expect(byName.get('arbeitnow')?.error).toMatch(/no response within/);
    expect(byName.get('adzuna')).toMatchObject({ status: 'disabled', count: 0 });
    expect(byName.get('adzuna')?.error).toMatch(/ADZUNA_APP_ID/);

    // One good source is still a successful search.
    expect(response.jobs).toHaveLength(1);
    expect(response.total).toBe(1);
  });

  it('records a timing for every source', async () => {
    const response = await searchJobs(BASE, {
      adapters: [stubAdapter('remotive', { jobs: [makeJob()] })],
      now: NOW,
      env: {},
    });
    expect(response.sources.every((report) => typeof report.ms === 'number' && report.ms >= 0)).toBe(true);
  });

  it('never calls a source that is missing its credentials', async () => {
    let called = 0;
    const adapters = [
      stubAdapter('usajobs', {
        disabled: 'USAJOBS_API_KEY and USAJOBS_USER_AGENT are not set',
        needsKey: true,
        onFetch: () => {
          called += 1;
        },
      }),
    ];
    const response = await searchJobs(BASE, { adapters, now: NOW, env: {} });
    expect(called).toBe(0);
    expect(response.sources[0]?.status).toBe('disabled');
  });

  it('survives an adapter that rejects with a non-Error value', async () => {
    const rogue: JobSourceAdapter = {
      source: 'jobicy',
      needsKey: false,
      disabledReason: () => null,
      cacheKey: () => 'k',
      fetchJobs: async () => {
        throw 'a string, not an Error';
      },
    };
    const response = await searchJobs(BASE, { adapters: [rogue], now: NOW, env: {} });
    expect(response.sources[0]).toMatchObject({ source: 'jobicy', status: 'error' });
    expect(response.jobs).toEqual([]);
  });

  it('marks a requested source that does not exist as skipped', async () => {
    const response = await searchJobs(
      { ...BASE, sources: ['remotive', 'himalayas'] },
      { adapters: [stubAdapter('remotive', { jobs: [makeJob()] })], now: NOW, env: {} },
    );
    expect(response.sources.map((report) => [report.source, report.status])).toEqual([
      ['remotive', 'ok'],
      ['himalayas', 'skipped'],
    ]);
  });

  it('only runs the requested sources', async () => {
    let remotiveCalls = 0;
    let jobicyCalls = 0;
    const adapters = [
      stubAdapter('remotive', { jobs: [makeJob()], onFetch: () => (remotiveCalls += 1) }),
      stubAdapter('jobicy', { jobs: [], onFetch: () => (jobicyCalls += 1) }),
    ];
    await searchJobs({ ...BASE, sources: ['remotive'] }, { adapters, now: NOW, env: {} });
    expect(remotiveCalls).toBe(1);
    expect(jobicyCalls).toBe(0);
  });
});

describe('searchJobs — pipeline', () => {
  it('dedupes across sources, ranks, and paginates with an honest total', async () => {
    const adapters = [
      stubAdapter('remotive', {
        jobs: [
          makeJob({ source: 'remotive', sourceId: '1', title: 'React Engineer', postedAt: '2026-09-01T00:00:00.000Z' }),
          makeJob({
            source: 'remotive',
            sourceId: '2',
            title: 'Data Analyst',
            company: 'Initech',
            tags: ['sql'],
            descriptionText: 'react is mentioned once',
            postedAt: '2026-09-02T00:00:00.000Z',
          }),
        ],
      }),
      stubAdapter('jobicy', {
        jobs: [
          // Same posting as remotive:1, but newer.
          makeJob({ source: 'jobicy', sourceId: '9', title: 'React Engineer', postedAt: '2026-09-08T00:00:00.000Z' }),
        ],
      }),
    ];

    const response = await searchJobs({ q: 'react', page: 1, pageSize: 1 }, { adapters, now: NOW, env: {} });
    expect(response.total).toBe(2);
    expect(response.pageSize).toBe(1);
    expect(response.jobs).toHaveLength(1);
    expect(response.jobs[0]?.id).toBe('jobicy:9');

    const second = await searchJobs({ q: 'react', page: 2, pageSize: 1 }, { adapters, now: NOW, env: {} });
    expect(second.jobs[0]?.id).toBe('remotive:2');
  });

  it('applies every query constraint end to end', async () => {
    const adapters = [
      stubAdapter('remotive', {
        jobs: [
          makeJob({ source: 'remotive', sourceId: 'a', title: 'React Engineer', remote: true, employmentType: 'full_time' }),
          makeJob({
            source: 'remotive',
            sourceId: 'b',
            title: 'React Engineer',
            company: 'Globex',
            location: 'Austin, TX',
            remote: false,
            employmentType: 'full_time',
          }),
          makeJob({
            source: 'remotive',
            sourceId: 'c',
            title: 'React Engineer',
            company: 'Initech',
            remote: true,
            employmentType: 'contract',
          }),
        ],
      }),
    ];

    const response = await searchJobs(
      { q: 'react', remoteOnly: true, employmentType: 'full_time' },
      { adapters, now: NOW, env: {} },
    );
    expect(response.jobs.map((job) => job.sourceId)).toEqual(['a']);
  });

  it('sorts by date when asked', async () => {
    const adapters = [
      stubAdapter('remotive', {
        jobs: [
          makeJob({ source: 'remotive', sourceId: 'old', title: 'React Engineer', postedAt: '2026-08-01T00:00:00.000Z' }),
          makeJob({
            source: 'remotive',
            sourceId: 'new',
            title: 'Engineer',
            company: 'Globex',
            descriptionText: 'react',
            postedAt: '2026-09-10T00:00:00.000Z',
          }),
        ],
      }),
    ];
    const byDate = await searchJobs({ q: 'react', sort: 'date' }, { adapters, now: NOW, env: {} });
    expect(byDate.jobs.map((job) => job.sourceId)).toEqual(['new', 'old']);

    const byRelevance = await searchJobs({ q: 'react', sort: 'relevance' }, { adapters, now: NOW, env: {} });
    expect(byRelevance.jobs.map((job) => job.sourceId)).toEqual(['old', 'new']);
  });

  it('returns an empty, well-formed response when every source fails', async () => {
    const adapters = [
      stubAdapter('remotive', { throws: new Error('down') }),
      stubAdapter('jobicy', { throws: new Error('down') }),
    ];
    const response = await searchJobs(BASE, { adapters, now: NOW, env: {} });
    expect(response.jobs).toEqual([]);
    expect(response.total).toBe(0);
    expect(response.cached).toBe(false);
    expect(response.page).toBe(1);
    expect(Date.parse(response.fetchedAt)).not.toBeNaN();
    expect(response.sources).toHaveLength(2);
  });

  it('handles a source that returns a non-array', async () => {
    const rogue: JobSourceAdapter = {
      source: 'remotive',
      needsKey: false,
      disabledReason: () => null,
      cacheKey: () => 'k',
      fetchJobs: async () => null as unknown as Job[],
    };
    const response = await searchJobs(BASE, { adapters: [rogue], now: NOW, env: {} });
    expect(response.sources[0]).toMatchObject({ status: 'ok', count: 0 });
    expect(response.jobs).toEqual([]);
  });
});

describe('searchJobs — caching', () => {
  it('fetches once per TTL and flags the cached response', async () => {
    let calls = 0;
    const adapters = [
      stubAdapter('remotive', {
        jobs: [makeJob({ source: 'remotive', sourceId: '1' })],
        onFetch: () => {
          calls += 1;
        },
      }),
    ];

    const first = await searchJobs(BASE, { adapters, now: NOW, env: {} });
    expect(first.cached).toBe(false);
    expect(calls).toBe(1);

    const second = await searchJobs(BASE, { adapters, now: NOW, env: {} });
    expect(second.cached).toBe(true);
    expect(calls).toBe(1);
    expect(second.total).toBe(first.total);
  });

  it('keys the cache on the parts of the query the source actually uses', async () => {
    let calls = 0;
    const adapters = [
      stubAdapter('remotive', {
        jobs: [makeJob()],
        cacheKey: 'search=react',
        onFetch: () => {
          calls += 1;
        },
      }),
      // Same-query-agnostic source: one fetch serves both queries.
      stubAdapter('arbeitnow', { jobs: [], cacheKey: 'page=1' }),
    ];

    await searchJobs({ ...BASE, q: 'react' }, { adapters, now: NOW, env: {} });
    await searchJobs({ ...BASE, q: 'react', location: 'Austin' }, { adapters, now: NOW, env: {} });
    expect(calls).toBe(1);
  });

  it('is not cached when at least one source was fetched fresh', async () => {
    const cachedSource = stubAdapter('remotive', { jobs: [makeJob()], cacheKey: 'shared' });
    await searchJobs(BASE, { adapters: [cachedSource], now: NOW, env: {} });

    const freshSource = stubAdapter('jobicy', { jobs: [makeJob({ source: 'jobicy', sourceId: 'z' })] });
    const response = await searchJobs(BASE, { adapters: [cachedSource, freshSource], now: NOW, env: {} });
    expect(response.cached).toBe(false);
  });

  it('bypasses the cache when asked', async () => {
    let calls = 0;
    const adapters = [
      stubAdapter('remotive', {
        jobs: [makeJob()],
        onFetch: () => {
          calls += 1;
        },
      }),
    ];
    await searchJobs(BASE, { adapters, now: NOW, env: {}, useCache: false });
    await searchJobs(BASE, { adapters, now: NOW, env: {}, useCache: false });
    expect(calls).toBe(2);
  });
});

describe('getJob', () => {
  it('returns a job seen in an earlier search and null for anything else', async () => {
    const job = makeJob({ source: 'remotive', sourceId: 'detail-1', title: 'Platform Engineer' });
    await searchJobs(BASE, { adapters: [stubAdapter('remotive', { jobs: [job] })], now: NOW, env: {} });

    await expect(getJob('remotive:detail-1')).resolves.toMatchObject({ title: 'Platform Engineer' });
    await expect(getJob('remotive:nope')).resolves.toBeNull();
    await expect(getJob('')).resolves.toBeNull();
  });

  it('remembers jobs that were filtered out of the response', async () => {
    const job = makeJob({ source: 'remotive', sourceId: 'hidden', title: 'Warehouse Associate' });
    await searchJobs({ ...BASE, q: 'kubernetes' }, { adapters: [stubAdapter('remotive', { jobs: [job] })], now: NOW, env: {} });
    await expect(getJob('remotive:hidden')).resolves.not.toBeNull();
  });
});

describe('listSourceConfig', () => {
  it('lists every board with its key requirement', () => {
    const config = listSourceConfig({});
    expect(config.map((entry) => entry.source)).toEqual([
      'remotive',
      'remoteok',
      'arbeitnow',
      'themuse',
      'jobicy',
      'himalayas',
      'adzuna',
      'usajobs',
      'jsearch',
    ]);
    expect(config.filter((entry) => entry.needsKey).map((entry) => entry.source)).toEqual(['adzuna', 'usajobs', 'jsearch']);
    expect(config.filter((entry) => entry.enabled)).toHaveLength(6);
  });

  it('enables a keyed source once its credentials are present', () => {
    const config = listSourceConfig({
      ADZUNA_APP_ID: 'id',
      ADZUNA_APP_KEY: 'key',
      USAJOBS_API_KEY: 'k',
      USAJOBS_USER_AGENT: 'me@example.com',
      JSEARCH_API_KEY: 'k',
    });
    expect(config.filter((entry) => entry.enabled)).toHaveLength(9);
  });
});
