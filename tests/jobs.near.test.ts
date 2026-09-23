/**
 * ZIP-radius search: the Census tables, location-string resolution, the radius filter,
 * how the search pipeline talks to each kind of board, and the HTTP contract.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { Job, JobSearchQuery, JobSource } from '../shared/types';
import { anchorCity, findPlace, haversineMiles, nearestPlace, resolveLocation, zipPoint } from '../server/geo/index';
import { normalizePlaceName } from '../server/geo/names';
import { applyRadius, resolveNear, sortByDistance, UnknownZipError } from '../server/jobs/near';
import { clearJobCaches, searchJobs } from '../server/jobs/index';
import { adzunaSource } from '../server/jobs/sources/index';
import { usaJobsSource as usajobsSource } from '../server/jobs/sources/usajobs';
import type { JobSourceAdapter } from '../server/jobs/types';
import { createJobsRouter } from '../server/routes/jobs';
import { fixtureFetch, makeContext, makeJob } from './jobs.helpers';
import adzunaFixture from './fixtures/jobs/adzuna.json';

const WESTLAKE = '78746'; // West Lake Hills, just west of downtown Austin

describe('geo tables', () => {
  it('places a ZIP and measures real distances', () => {
    const home = zipPoint(WESTLAKE)!;
    expect(home).toBeTruthy();
    const austin = findPlace('Austin', 'TX')!;
    const roundRock = findPlace('Round Rock', 'Texas')!;
    const dallas = findPlace('Dallas', 'TX')!;
    expect(haversineMiles(home, austin)).toBeLessThan(8);
    expect(haversineMiles(home, roundRock)).toBeGreaterThan(12);
    expect(haversineMiles(home, roundRock)).toBeLessThan(25);
    // Austin → Dallas is ~180 miles by air.
    expect(haversineMiles(austin, dallas)).toBeGreaterThan(170);
    expect(haversineMiles(austin, dallas)).toBeLessThan(190);
  });

  it('returns null for a ZIP that is not in the table', () => {
    expect(zipPoint('00000')).toBeNull();
  });

  it('names a ZIP after the town it sits in, not the nearest town centre', () => {
    const name = (zip: string) => {
      const place = nearestPlace(zipPoint(zip)!)!;
      return `${place.name}, ${place.state}`;
    };
    expect(name(WESTLAKE)).toBe('west lake hills, TX');
    // Manhattan's centroid is nearer Hoboken's centre than New York's.
    expect(name('10001')).toBe('new york, NY');
    // Consolidated city-counties are filed as "(balance)" entities.
    expect(name('37203')).toBe('nashville, TN');
    expect(name('40202')).toBe('louisville, KY');
  });

  it('anchors a suburb ZIP to the big city boards list jobs under', () => {
    const anchor = anchorCity(zipPoint(WESTLAKE)!, 25)!;
    expect(`${anchor.name}, ${anchor.state}`).toBe('austin, TX');
  });

  it('normalizes Census place names the way postings write them', () => {
    expect(normalizePlaceName('Austin city')).toEqual(['austin']);
    expect(normalizePlaceName('Wake Village city')).toEqual(['wake village']);
    expect(normalizePlaceName('Boise City city')).toEqual(['boise city']);
    expect(normalizePlaceName('Carson City')).toEqual(['carson city']);
    expect(normalizePlaceName('Nashville-Davidson metropolitan government (balance)')).toContain('nashville');
    expect(normalizePlaceName('Urban Honolulu CDP')).toContain('honolulu');
  });
});

describe('resolveLocation', () => {
  it.each([
    'Austin, TX',
    'Austin, Texas',
    'Austin, TX, US',
    'Austin, Texas, United States',
    'Austin TX',
    'Hybrid - Austin, TX',
    'Austin, TX 78701',
    'St. Louis, MO',
    'Saint Louis, Missouri',
    'Brooklyn, NY',
    'Washington, DC',
    'Fort Worth, TX',
  ])('places %s', (location) => {
    expect(resolveLocation(location)).toHaveLength(1);
  });

  it('returns one point per place in a multi-location posting', () => {
    expect(resolveLocation('Austin, TX; Dallas, TX')).toHaveLength(2);
    expect(resolveLocation('New York, NY | San Francisco, CA')).toHaveLength(2);
    expect(resolveLocation('Austin, TX or Remote')).toHaveLength(1);
  });

  it.each(['Remote', 'Remote — USA', 'Springfield', 'Berlin, Germany', 'United States', ''])(
    'does not guess at %j',
    (location) => {
      expect(resolveLocation(location)).toEqual([]);
    },
  );
});

describe('applyRadius', () => {
  const near = resolveNear({ q: '', location: WESTLAKE, radiusMiles: 25 })!;
  const local = makeJob({ sourceId: 'local', location: 'Austin, TX', remote: false });
  const suburb = makeJob({ sourceId: 'suburb', location: 'Round Rock, TX', remote: false });
  const far = makeJob({ sourceId: 'far', location: 'Dallas, TX', remote: false });
  const remote = makeJob({ sourceId: 'remote', location: 'Remote — USA', remote: true });
  const vague = makeJob({ sourceId: 'vague', location: 'Texas', remote: false });

  it('keeps jobs inside the radius, stamped with their distance', () => {
    const { jobs } = applyRadius([local, suburb, far], near);
    expect(jobs.map((j) => j.sourceId)).toEqual(['local', 'suburb']);
    expect(jobs[0]!.distanceMiles).toBeLessThan(8);
    expect(jobs[1]!.distanceMiles).toBeGreaterThan(12);
  });

  it('never mutates the cached originals', () => {
    applyRadius([local], near);
    expect(local.distanceMiles).toBeUndefined();
  });

  it('keeps remote roles by default and drops them when asked', () => {
    expect(applyRadius([remote], near).jobs).toHaveLength(1);
    const strict = resolveNear({ q: '', location: WESTLAKE, includeRemote: false })!;
    expect(applyRadius([remote], strict).jobs).toHaveLength(0);
  });

  it('counts on-site US postings it could not place instead of hiding them silently', () => {
    const abroad = makeJob({ sourceId: 'abroad', location: 'Berlin, Germany', remote: false });
    const { jobs, unplaced } = applyRadius([vague, far, remote, abroad], near);
    expect(jobs.map((j) => j.sourceId)).toEqual(['remote']);
    // "Texas" is US but unmeasurable; Berlin is simply elsewhere, not unplaced.
    expect(unplaced).toBe(1);
  });

  it.each([
    ['Remote', true],
    ['Remote — USA', true],
    ['Remote (US)', true],
    ['Worldwide', true],
    ['Anywhere', true],
    ['North America', true],
    ['Remote - Austin, TX', true],
    ['Brazil', false],
    ['LATAM', false],
    ['Latin America', false],
    ['South America', false],
    ['Remote (EU)', false],
    ['Türkiye', false],
    ['Remote — Germany', false],
  ])('keeps remote role %j for a US searcher: %s', (location, kept) => {
    const job = makeJob({ sourceId: 'r', location, remote: true });
    expect(applyRadius([job], near).jobs).toHaveLength(kept ? 1 : 0);
  });

  it('prefers board-supplied coordinates over the location text', () => {
    const pinned = makeJob({
      sourceId: 'pinned',
      location: 'Dallas, TX', // text says far away…
      remote: false,
      geo: [{ lat: 30.27, lon: -97.74 }], // …but the board's pin is downtown Austin
    });
    expect(applyRadius([pinned], near).jobs).toHaveLength(1);
  });

  it('measures multi-location postings to their nearest location', () => {
    const multi = makeJob({ sourceId: 'multi', location: 'Dallas, TX; Austin, TX', remote: false });
    const [job] = applyRadius([multi], near).jobs;
    expect(job!.distanceMiles).toBeLessThan(8);
  });

  it('sorts nearest first with undistanced remote roles last', () => {
    const kept = applyRadius([remote, suburb, local], near).jobs;
    expect(sortByDistance(kept).map((j) => j.sourceId)).toEqual(['local', 'suburb', 'remote']);
  });

  it('clamps and defaults the radius', () => {
    expect(resolveNear({ q: '', location: WESTLAKE })!.radiusMiles).toBe(25);
    expect(resolveNear({ q: '', location: WESTLAKE, radiusMiles: 5000 })!.radiusMiles).toBe(200);
  });

  it('ignores anything that is not a ZIP and rejects an unknown ZIP', () => {
    expect(resolveNear({ q: '', location: 'Austin, TX' })).toBeNull();
    expect(() => resolveNear({ q: '', location: '00000' })).toThrow(UnknownZipError);
  });
});

describe('searchJobs in radius mode', () => {
  beforeEach(() => clearJobCaches());

  function adapter(source: JobSource, jobs: Job[], seen: JobSearchQuery[], searchesByRadius = false): JobSourceAdapter {
    return {
      source,
      needsKey: false,
      searchesByRadius,
      disabledReason: () => null,
      cacheKey: (q) => `${q.location}|${q.radiusMiles}`,
      async fetchJobs(query) {
        seen.push(query);
        return jobs;
      },
    };
  }

  it('filters by distance, reports what it searched, and sorts by distance on request', async () => {
    const seen: JobSearchQuery[] = [];
    const jobs = [
      makeJob({ source: 'themuse', sourceId: 'far', location: 'Dallas, TX', remote: false }),
      makeJob({ source: 'themuse', sourceId: 'suburb', location: 'Round Rock, TX', remote: false }),
      makeJob({ source: 'themuse', sourceId: 'local', location: 'Austin, TX', remote: false }),
      makeJob({ source: 'themuse', sourceId: 'remote', location: 'Remote', remote: true }),
      makeJob({ source: 'themuse', sourceId: 'vague', location: 'Texas', remote: false }),
    ].map((job, i) => ({ ...job, title: `Analyst ${i}`, url: `https://example.com/${i}` }));
    const response = await searchJobs(
      { q: '', location: WESTLAKE, radiusMiles: 25, sort: 'distance' },
      { adapters: [adapter('themuse', jobs, seen)], useCache: false },
    );
    expect(response.jobs.map((j) => j.sourceId)).toEqual(['local', 'suburb', 'remote']);
    expect(response.near).toEqual({
      zip: WESTLAKE,
      label: 'West Lake Hills, TX',
      radiusMiles: 25,
      includeRemote: true,
      unplaced: 1,
    });
  });

  it('sends radius boards the ZIP\'s own town + radius and city-only boards the big city', async () => {
    const seen: JobSearchQuery[] = [];
    const radiusSeen: JobSearchQuery[] = [];
    await searchJobs(
      { q: 'analyst', location: WESTLAKE, radiusMiles: 10 },
      {
        adapters: [adapter('themuse', [], seen), adapter('adzuna', [], radiusSeen, true)],
        useCache: false,
      },
    );
    expect(seen[0]).toMatchObject({ location: 'Austin, TX', radiusMiles: undefined });
    expect(radiusSeen[0]).toMatchObject({ location: 'West Lake Hills, TX', radiusMiles: 10 });
  });

  it('rejects an unknown ZIP before calling any board', async () => {
    const seen: JobSearchQuery[] = [];
    await expect(
      searchJobs({ q: '', location: '00000' }, { adapters: [adapter('themuse', [], seen)], useCache: false }),
    ).rejects.toBeInstanceOf(UnknownZipError);
    expect(seen).toHaveLength(0);
  });

  it('leaves text-location searches exactly as they were', async () => {
    const seen: JobSearchQuery[] = [];
    const response = await searchJobs(
      { q: '', location: 'Austin' },
      {
        adapters: [adapter('themuse', [makeJob({ source: 'themuse', location: 'Austin, TX', remote: false })], seen)],
        useCache: false,
      },
    );
    expect(seen[0]!.location).toBe('Austin');
    expect(response.near).toBeUndefined();
    expect(response.jobs[0]!.distanceMiles).toBeUndefined();
  });
});

describe('radius-aware boards', () => {
  it('Adzuna gets the radius in kilometres and its coordinates are kept', async () => {
    const urls: string[] = [];
    const base = fixtureFetch({ 'api.adzuna.com': {
      results: (adzunaFixture as { results: Record<string, unknown>[] }).results.map((item) => ({
        ...item,
        latitude: 30.27,
        longitude: -97.74,
      })),
    } });
    const fetchImpl = (async (input: unknown, init?: RequestInit) => {
      urls.push(String(input));
      return base(input as string, init);
    }) as typeof fetch;
    const jobs = await adzunaSource.fetchJobs(
      { q: 'analyst', location: 'West Lake Hills, TX', radiusMiles: 25 },
      makeContext(fetchImpl, { ADZUNA_APP_ID: 'id', ADZUNA_APP_KEY: 'key' }),
    );
    const url = new URL(urls[0]!);
    expect(url.searchParams.get('where')).toBe('West Lake Hills, TX');
    expect(url.searchParams.get('distance')).toBe('40');
    expect(jobs[0]!.geo).toEqual([{ lat: 30.27, lon: -97.74 }]);
  });

  it('USAJOBS gets the radius in miles', async () => {
    const urls: string[] = [];
    const fetchImpl = (async (input: unknown) => {
      urls.push(String(input));
      return new Response(JSON.stringify({ SearchResult: { SearchResultItems: [] } }), { status: 200 });
    }) as typeof fetch;
    await usajobsSource.fetchJobs(
      { q: '', location: 'West Lake Hills, TX', radiusMiles: 25 },
      makeContext(fetchImpl, { USAJOBS_API_KEY: 'k', USAJOBS_USER_AGENT: 'me@example.com' }),
    );
    expect(new URL(urls[0]!).searchParams.get('Radius')).toBe('25');
  });

  it('cache keys separate different radii', () => {
    const a = adzunaSource.cacheKey({ q: 'x', location: 'Austin, TX', radiusMiles: 10 });
    const b = adzunaSource.cacheKey({ q: 'x', location: 'Austin, TX', radiusMiles: 50 });
    expect(a).not.toBe(b);
  });
});

describe('GET /api/jobs/search — radius parameters', () => {
  const PORT = 9481;
  let server: Server;
  let received: JobSearchQuery[] = [];

  beforeAll(async () => {
    const app = express();
    app.use(
      '/api/jobs',
      createJobsRouter({
        searchJobs: async (query) => {
          received.push(query);
          if (query.location === '00000') throw new UnknownZipError('00000');
          return { jobs: [], total: 0, page: 1, pageSize: 25, sources: [], cached: false, fetchedAt: '' };
        },
        getJob: async () => null,
      }),
    );
    server = app.listen(PORT);
    await new Promise<void>((resolve) => server.once('listening', resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    received = [];
  });

  it('parses radiusMiles, includeRemote and sort=distance', async () => {
    const response = await fetch(
      `http://127.0.0.1:${PORT}/api/jobs/search?location=78746&radiusMiles=50&includeRemote=false&sort=distance`,
    );
    expect(response.status).toBe(200);
    expect(received[0]).toMatchObject({ location: '78746', radiusMiles: 50, includeRemote: false, sort: 'distance' });
  });

  it('turns an unknown ZIP into a 400 that says what to do', async () => {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/jobs/search?location=00000`);
    const body = (await response.json()) as { error: string };
    expect(response.status).toBe(400);
    expect(body.error).toMatch(/00000/);
    expect(body.error).toMatch(/try the ZIP where you live/i);
  });

  it('rejects an out-of-range radius', async () => {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/jobs/search?location=78746&radiusMiles=900`);
    expect(response.status).toBe(400);
  });
});
