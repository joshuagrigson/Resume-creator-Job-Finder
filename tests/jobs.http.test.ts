import { describe, expect, it } from 'vitest';
import { fetchJson, HttpError, redactUrl, TimeoutError, userAgent } from '../server/jobs/http';
import type { FetchLike } from '../server/jobs/types';

const KEYED_URL = 'https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=abc123&app_key=super-secret';

describe('redactUrl', () => {
  it('drops the query string so credentials never reach a log', () => {
    expect(redactUrl(KEYED_URL)).toBe('https://api.adzuna.com/v1/api/jobs/us/search/1');
    expect(redactUrl('not a url')).toBe('not a url');
  });
});

describe('userAgent', () => {
  it('identifies the app and is overridable', () => {
    expect(userAgent({})).toContain('Launchpad');
    expect(userAgent({ JOBS_USER_AGENT: 'CustomAgent/2.0' })).toBe('CustomAgent/2.0');
  });
});

describe('fetchJson', () => {
  it('parses a JSON body and sends a user agent', async () => {
    let headers: Record<string, string> = {};
    const stub = (async (_input: unknown, init?: { headers?: Record<string, string> }) => {
      headers = init?.headers ?? {};
      return new Response(JSON.stringify({ jobs: [1, 2] }), { status: 200 });
    }) as FetchLike;

    await expect(fetchJson('https://example.test/api', { fetch: stub, retries: 0 })).resolves.toEqual({
      jobs: [1, 2],
    });
    expect(headers['user-agent']).toBeTruthy();
  });

  it('retries a 503 and succeeds on the second attempt', async () => {
    let attempts = 0;
    const stub = (async () => {
      attempts += 1;
      return attempts === 1 ? new Response('nope', { status: 503 }) : new Response('{"ok":true}', { status: 200 });
    }) as FetchLike;

    await expect(fetchJson('https://example.test/api', { fetch: stub, retries: 1 })).resolves.toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  it('does not retry a 404', async () => {
    let attempts = 0;
    const stub = (async () => {
      attempts += 1;
      return new Response('missing', { status: 404 });
    }) as FetchLike;

    await expect(fetchJson('https://example.test/api', { fetch: stub, retries: 2 })).rejects.toBeInstanceOf(HttpError);
    expect(attempts).toBe(1);
  });

  it('keeps credentials out of the error message', async () => {
    const stub = (async () => new Response('denied', { status: 401 })) as FetchLike;
    await expect(fetchJson(KEYED_URL, { fetch: stub, retries: 0 })).rejects.toThrow(
      /api\.adzuna\.com\/v1\/api\/jobs\/us\/search\/1/,
    );
    let message = '';
    try {
      await fetchJson(KEYED_URL, { fetch: stub, retries: 0 });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).not.toContain('super-secret');
    expect(message).not.toContain('abc123');
    expect(message).toContain('api.adzuna.com');
  });

  it('rejects a non-JSON body without retrying forever', async () => {
    const stub = (async () => new Response('<html>maintenance</html>', { status: 200 })) as FetchLike;
    await expect(fetchJson('https://example.test/api', { fetch: stub, retries: 0 })).rejects.toThrow(/non-JSON/);
  });

  it('rejects an oversized body exactly once', async () => {
    let attempts = 0;
    const stub = (async () => {
      attempts += 1;
      return new Response(JSON.stringify(Array.from({ length: 1000 }, (_, i) => i)), { status: 200 });
    }) as FetchLike;

    await expect(fetchJson('https://example.test/api', { fetch: stub, retries: 2, maxBytes: 100 })).rejects.toThrow(
      /limit 100/,
    );
    expect(attempts).toBe(1);
  });

  it('times out on its own deadline', async () => {
    const stub = ((_input: unknown, init?: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason as Error), { once: true });
      })) as FetchLike;

    await expect(fetchJson('https://example.test/api', { fetch: stub, timeoutMs: 20, retries: 0 })).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });

  it('stops immediately when the caller aborts and does not retry', async () => {
    const controller = new AbortController();
    let attempts = 0;
    const stub = ((_input: unknown, init?: { signal?: AbortSignal }) => {
      attempts += 1;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason as Error), { once: true });
      });
    }) as FetchLike;

    const promise = fetchJson('https://example.test/api', { fetch: stub, signal: controller.signal, retries: 3 });
    controller.abort(new TimeoutError('caller gave up'));
    await expect(promise).rejects.toThrow(/caller gave up/);
    expect(attempts).toBe(1);
  });

  it('retries a network-level failure', async () => {
    let attempts = 0;
    const stub = (async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError('fetch failed');
      return new Response('{"ok":true}', { status: 200 });
    }) as FetchLike;

    await expect(fetchJson('https://example.test/api', { fetch: stub, retries: 1 })).resolves.toEqual({ ok: true });
    expect(attempts).toBe(2);
  });
});
