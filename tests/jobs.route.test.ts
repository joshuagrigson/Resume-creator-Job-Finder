/**
 * HTTP contract for /api/jobs/*. The router is built with stub services so nothing
 * reaches a real job board.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { Job, JobSearchQuery, JobSearchResponse } from '../shared/types';
import { createJobsRouter } from '../server/routes/jobs';
import { makeJob } from './jobs.helpers';

const PORT = 9473;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let server: Server;
let received: JobSearchQuery[] = [];
let storedJob: Job | null = null;

function emptyResponse(query: JobSearchQuery): JobSearchResponse {
  return {
    jobs: storedJob ? [storedJob] : [],
    total: storedJob ? 1 : 0,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 25,
    sources: [{ source: 'remotive', status: 'ok', count: 1, ms: 3 }],
    cached: false,
    fetchedAt: '2026-09-12T00:00:00.000Z',
  };
}

beforeAll(async () => {
  const app = express();
  app.use(
    '/api/jobs',
    createJobsRouter({
      searchJobs: async (query) => {
        received.push(query);
        return emptyResponse(query);
      },
      getJob: async (id) => (storedJob && storedJob.id === id ? storedJob : null),
    }),
  );
  server = app.listen(PORT);
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  received = [];
  storedJob = null;
});

async function get(path: string) {
  const response = await fetch(`${BASE_URL}${path}`);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe('GET /api/jobs/search', () => {
  it('applies sensible defaults for a bare request', async () => {
    const { status } = await get('/api/jobs/search');
    expect(status).toBe(200);
    expect(received[0]).toEqual({ q: '', remoteOnly: false, page: 1, pageSize: 25, sort: 'relevance' });
  });

  it('parses every supported parameter', async () => {
    const { status } = await get(
      '/api/jobs/search?q=react%20engineer&location=Austin&remoteOnly=true&sources=remotive,jobicy' +
        '&postedWithinDays=14&employmentType=contract&page=3&pageSize=50&sort=date',
    );
    expect(status).toBe(200);
    expect(received[0]).toEqual({
      q: 'react engineer',
      location: 'Austin',
      remoteOnly: true,
      sources: ['remotive', 'jobicy'],
      postedWithinDays: 14,
      employmentType: 'contract',
      page: 3,
      pageSize: 50,
      sort: 'date',
    });
  });

  it('accepts the alternative truthy spellings for remoteOnly', async () => {
    await get('/api/jobs/search?remoteOnly=1');
    await get('/api/jobs/search?remoteOnly=false');
    expect(received[0]?.remoteOnly).toBe(true);
    expect(received[1]?.remoteOnly).toBe(false);
  });

  it('rejects an unknown source with a helpful 400', async () => {
    const { status, body } = await get('/api/jobs/search?sources=remotive,linkedin');
    expect(status).toBe(400);
    expect(body.code).toBe('bad_request');
    expect(String(body.error)).toContain('linkedin');
    expect(received).toHaveLength(0);
  });

  it('rejects an out-of-range pageSize', async () => {
    const { status, body } = await get('/api/jobs/search?pageSize=500');
    expect(status).toBe(400);
    expect(body.code).toBe('bad_request');
    expect(received).toHaveLength(0);
  });

  it('rejects a non-numeric page and an unknown sort or employmentType', async () => {
    expect((await get('/api/jobs/search?page=abc')).status).toBe(400);
    expect((await get('/api/jobs/search?sort=cheapest')).status).toBe(400);
    expect((await get('/api/jobs/search?employmentType=wizard')).status).toBe(400);
    expect((await get('/api/jobs/search?postedWithinDays=0')).status).toBe(400);
    expect(received).toHaveLength(0);
  });

  it('rejects an over-long query string', async () => {
    const { status } = await get(`/api/jobs/search?q=${'a'.repeat(201)}`);
    expect(status).toBe(400);
  });

  it('names the offending field in the details', async () => {
    const { body } = await get('/api/jobs/search?pageSize=500');
    expect(Array.isArray(body.details)).toBe(true);
    expect(JSON.stringify(body.details)).toContain('pageSize');
  });
});

describe('GET /api/jobs/:id', () => {
  it('returns a cached job, colon in the id included', async () => {
    storedJob = makeJob({ source: 'remotive', sourceId: '2086540', title: 'Inside Sales Contractor' });
    const { status, body } = await get('/api/jobs/remotive:2086540');
    expect(status).toBe(200);
    expect(body.title).toBe('Inside Sales Contractor');
  });

  it('404s with an ApiError body for an unknown id', async () => {
    const { status, body } = await get('/api/jobs/remotive:missing');
    expect(status).toBe(404);
    expect(body).toEqual({ error: 'Job not found', code: 'not_found' });
  });

  it('handles a percent-encoded id', async () => {
    storedJob = makeJob({ source: 'himalayas', sourceId: 'acme/staff-engineer' });
    const { status } = await get(`/api/jobs/${encodeURIComponent('himalayas:acme/staff-engineer')}`);
    expect(status).toBe(200);
  });
});
