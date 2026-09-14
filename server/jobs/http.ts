/**
 * Small HTTP helper for the job adapters: timeouts, one retry on transient failures,
 * a polite user agent, a response size guard, and errors that never echo credentials.
 */
import type { FetchLike } from './types';

/** Thrown when one of our own deadlines fires (as opposed to a caller cancelling). */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Non-2xx response from an upstream board. */
export class HttpError extends Error {
  readonly status: number;
  readonly target: string;

  constructor(status: number, target: string, message?: string) {
    super(message ?? `${target} responded ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.target = target;
  }
}

export interface FetchJsonOptions {
  fetch?: FetchLike;
  /** External cancellation (per-source timeout / overall budget). */
  signal?: AbortSignal;
  /** Additional deadline owned by this call. */
  timeoutMs?: number;
  /** Retries for 429/5xx/network errors. Default 1. */
  retries?: number;
  headers?: Record<string, string>;
  /** Reject responses larger than this many characters. Default 16 MB. */
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;
const RETRY_DELAY_MS = 300;

/** Oversized response — retrying would only download the same thing again. */
class PayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayloadError';
  }
}

/** Identifies us to the boards; several of them ask for a real UA. */
export function userAgent(env: Readonly<Record<string, string | undefined>> = process.env): string {
  return env.JOBS_USER_AGENT?.trim() || 'LaunchpadJobSearch/0.1 (+https://github.com/launchpad-resume-job-finder)';
}

/** `https://api.example.com/v1/search` — query string (and therefore any key) removed. */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split('?')[0] ?? 'upstream';
  }
}

interface LinkedAbort {
  signal: AbortSignal;
  dispose(): void;
}

function linkAbort(external: AbortSignal | undefined, timeoutMs: number | undefined): LinkedAbort {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onAbort = () => controller.abort(external?.reason);

  if (external) {
    if (external.aborted) controller.abort(external.reason);
    else external.addEventListener('abort', onAbort, { once: true });
  }
  if (timeoutMs !== undefined && timeoutMs > 0 && !controller.signal.aborted) {
    timer = setTimeout(() => controller.abort(new TimeoutError(`timed out after ${timeoutMs}ms`)), timeoutMs);
  }

  return {
    signal: controller.signal,
    dispose() {
      if (timer !== undefined) clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
}

/** Rethrow whatever the external signal was aborted with, preserving timeout/abort identity. */
function externalAbortError(signal: AbortSignal): Error {
  const reason = signal.reason;
  if (reason instanceof Error) return reason;
  const err = new Error('request aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * Read a response body, aborting as soon as it exceeds the cap.
 *
 * Streaming lets an oversized board response be rejected part-way instead of after the
 * whole thing is in memory. Falls back to a plain read when the runtime gives us no
 * readable stream (some fetch polyfills, and the mocks in tests).
 */
async function readCapped(response: Response, maxBytes: number, target: string): Promise<string> {
  const body = response.body;
  if (!body || typeof body.getReader !== 'function') {
    const text = await response.text();
    if (text.length > maxBytes) {
      throw new PayloadError(`${target} returned ${text.length} bytes (limit ${maxBytes})`);
    }
    return text;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value?.byteLength ?? 0;
      if (total > maxBytes) {
        await reader.cancel();
        throw new PayloadError(`${target} returned more than ${maxBytes} bytes (limit ${maxBytes})`);
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock?.();
  }
  chunks.push(decoder.decode());
  return chunks.join('');
}

/** Raw body fetch, retrying only transient conditions. */
async function fetchTextWithRetry(url: string, options: FetchJsonOptions, target: string): Promise<string> {
  const doFetch: FetchLike = options.fetch ?? globalThis.fetch;
  const retries = Math.max(0, options.retries ?? 1);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  let lastError: Error = new Error(`${target}: request failed`);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (options.signal?.aborted) throw externalAbortError(options.signal);

    const linked = linkAbort(options.signal, options.timeoutMs);
    let transient: Error | undefined;
    try {
      const response = await doFetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
          'accept-language': 'en',
          'user-agent': userAgent(),
          ...options.headers,
        },
        signal: linked.signal,
      });

      if (response.ok) {
        // Refuse before reading when the board tells us how big the body is, so an
        // oversized response is never fully buffered into memory first.
        const declared = Number(response.headers.get('content-length') ?? '');
        if (Number.isFinite(declared) && declared > maxBytes) {
          throw new PayloadError(`${target} declared ${declared} bytes (limit ${maxBytes})`);
        }
        const body = await readCapped(response, maxBytes, target);
        return body;
      }

      const httpError = new HttpError(response.status, target);
      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        transient = httpError;
      } else {
        throw httpError;
      }
    } catch (err) {
      // Caller cancelled (per-source timeout or overall budget) — never retry that.
      if (options.signal?.aborted) throw externalAbortError(options.signal);
      if (isAbort(err)) throw err;
      if (err instanceof HttpError || err instanceof PayloadError) throw err;
      // Network-level failures (DNS, reset, proxy hiccup) are worth one more try.
      transient = err instanceof Error ? new Error(`${target}: ${err.message}`) : new Error(`${target}: request failed`);
    } finally {
      linked.dispose();
    }

    lastError = transient;
    if (attempt < retries) await sleep(RETRY_DELAY_MS * (attempt + 1));
  }

  throw lastError;
}

/**
 * GET JSON with timeout + retry. Errors carry a redacted target so API keys never reach logs.
 */
export async function fetchJson<T = unknown>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const target = redactUrl(url);
  const body = await fetchTextWithRetry(url, options, target);
  if (body.trim().length === 0) throw new Error(`${target} returned an empty body`);
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`${target} returned a non-JSON body`);
  }
}
