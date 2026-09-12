/**
 * Shared helpers for the server/jobs test suite. Not a test file — vitest only collects
 * `tests/**\/*.test.ts`.
 */
import type { Job, JobSource } from '../shared/types';
import type { FetchLike, SourceContext, SourceEnv } from '../server/jobs/types';

export const FETCHED_AT = '2026-09-12T00:00:00.000Z';
export const NOW = new Date('2026-09-12T00:00:00.000Z');

/** A fetch stub that serves recorded fixtures by URL substring. */
export function fixtureFetch(routes: Record<string, unknown>): FetchLike {
  return (async (input: unknown) => {
    const url = String(input);
    for (const [needle, body] of Object.entries(routes)) {
      if (url.includes(needle)) {
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    return new Response('{"error":"no fixture"}', { status: 404 });
  }) as FetchLike;
}

/** A fetch stub that always fails with the given status. */
export function failingFetch(status = 503): FetchLike {
  return (async () => new Response('upstream down', { status })) as FetchLike;
}

/** A fetch stub that never resolves until the caller's signal aborts. */
export function hangingFetch(): FetchLike {
  return ((_input: unknown, init?: { signal?: AbortSignal }) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      if (signal.aborted) {
        reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => reject(signal.reason instanceof Error ? signal.reason : new Error('aborted')),
        { once: true },
      );
    })) as FetchLike;
}

export function makeContext(fetchImpl: FetchLike, env: SourceEnv = {}, signal?: AbortSignal): SourceContext {
  return {
    fetch: fetchImpl,
    signal: signal ?? new AbortController().signal,
    env,
    now: NOW,
    fetchedAt: FETCHED_AT,
  };
}

/** Minimal valid `Job` with overridable fields, for filter/rank/dedupe tests. */
export function makeJob(overrides: Partial<Job> & { sourceId?: string } = {}): Job {
  const source: JobSource = overrides.source ?? 'remotive';
  const sourceId = overrides.sourceId ?? '1';
  return {
    id: overrides.id ?? `${source}:${sourceId}`,
    source,
    sourceId,
    title: 'Frontend Engineer',
    company: 'Acme',
    location: 'Remote',
    remote: true,
    tags: ['react'],
    descriptionHtml: '<p>Build things.</p>',
    descriptionText: 'Build things.',
    url: 'https://example.com/jobs/1',
    postedAt: '2026-09-01T00:00:00.000Z',
    fetchedAt: FETCHED_AT,
    ...overrides,
  };
}

/** Every `Job` invariant we rely on downstream. */
export function assertValidJob(job: Job, expectedSource: JobSource): string[] {
  const problems: string[] = [];
  if (job.source !== expectedSource) problems.push(`source is ${job.source}`);
  if (job.id !== `${expectedSource}:${job.sourceId}`) problems.push(`id ${job.id} does not match sourceId`);
  if (!job.title) problems.push('empty title');
  if (!job.company) problems.push('empty company');
  if (!/^https?:\/\//.test(job.url)) problems.push(`url is not http(s): ${job.url}`);
  if (Number.isNaN(Date.parse(job.postedAt))) problems.push(`postedAt not parseable: ${job.postedAt}`);
  if (job.postedAt !== new Date(job.postedAt).toISOString()) problems.push(`postedAt not ISO: ${job.postedAt}`);
  if (Number.isNaN(Date.parse(job.fetchedAt))) problems.push(`fetchedAt not parseable: ${job.fetchedAt}`);
  if (typeof job.remote !== 'boolean') problems.push('remote is not boolean');
  if (!Array.isArray(job.tags)) problems.push('tags is not an array');
  if (job.tags.some((tag) => tag !== tag.toLowerCase())) problems.push('tags are not lowercased');
  if (new Set(job.tags).size !== job.tags.length) problems.push('tags contain duplicates');
  if (typeof job.descriptionText !== 'string') problems.push('descriptionText missing');
  if (/<script/i.test(job.descriptionHtml)) problems.push('descriptionHtml still contains <script>');
  if (job.salary) {
    if (job.salary.min !== undefined && !(job.salary.min > 0)) problems.push('salary.min is not positive');
    if (job.salary.max !== undefined && !(job.salary.max > 0)) problems.push('salary.max is not positive');
    if (job.salary.min !== undefined && job.salary.max !== undefined && job.salary.min > job.salary.max) {
      problems.push('salary.min > salary.max');
    }
  }
  return problems;
}
