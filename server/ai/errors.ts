/**
 * Typed errors for the AI module and the mapping from Anthropic SDK errors to HTTP responses.
 *
 * Mapping contract (see docs/SPEC.md):
 *   no API key            → 503 { code: 'ai_disabled' }
 *   zod validation failed → 400 { code: 'bad_request', details }
 *   local or upstream 429 → 429 { code: 'rate_limited', details: { source, retryAfterSeconds } }
 *   any other API error   → 502 { code: 'ai_upstream' }
 */
import { APIError, RateLimitError } from '@anthropic-ai/sdk';
import type { ApiError } from '../../shared/types';

export type AiErrorCode = 'ai_disabled' | 'bad_request' | 'rate_limited' | 'ai_upstream';

export interface AiErrorOptions {
  details?: unknown;
  /** Populates the `Retry-After` header when present. */
  retryAfterSeconds?: number;
  cause?: unknown;
}

export class AiError extends Error {
  readonly status: number;
  readonly code: AiErrorCode;
  readonly details?: unknown;
  readonly retryAfterSeconds?: number;

  constructor(status: number, code: AiErrorCode, message: string, options: AiErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AiError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  /** Response body shape shared with the rest of the API. */
  toBody(): ApiError {
    const body: ApiError = { error: this.message, code: this.code };
    if (this.details !== undefined) body.details = this.details;
    return body;
  }
}

export function aiDisabledError(reason = 'ANTHROPIC_API_KEY not set'): AiError {
  return new AiError(503, 'ai_disabled', 'AI features are not configured on this server.', {
    details: { reason },
  });
}

export function badRequestError(message: string, details?: unknown): AiError {
  return new AiError(400, 'bad_request', message, { details });
}

export function rateLimitedError(
  source: 'local' | 'upstream',
  retryAfterSeconds: number,
  message = 'Too many AI requests. Try again shortly.',
): AiError {
  const retryAfter = Number.isFinite(retryAfterSeconds) ? Math.max(1, Math.ceil(retryAfterSeconds)) : 60;
  return new AiError(429, 'rate_limited', message, {
    retryAfterSeconds: retryAfter,
    details: { source, retryAfterSeconds: retryAfter },
  });
}

export function upstreamError(message = 'The AI provider could not complete this request.', details?: unknown): AiError {
  return new AiError(502, 'ai_upstream', message, { details });
}

function retryAfterFromHeaders(headers: unknown): number | undefined {
  if (!headers || typeof (headers as Headers).get !== 'function') return undefined;
  let raw: string | null = null;
  try {
    raw = (headers as Headers).get('retry-after');
  } catch {
    return undefined;
  }
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate)) return Math.max(0, (asDate - Date.now()) / 1000);
  return undefined;
}

/**
 * Turns anything thrown while talking to the model into an AiError. Never leaks the API key,
 * request bodies, or stack traces — only the provider's error `type` and HTTP status.
 */
export function mapUpstreamError(err: unknown): AiError {
  if (err instanceof AiError) return err;

  if (err instanceof RateLimitError) {
    return rateLimitedError(
      'upstream',
      retryAfterFromHeaders(err.headers) ?? 30,
      'The AI provider is rate limiting this server. Try again shortly.',
    );
  }

  if (err instanceof APIError) {
    const status = typeof err.status === 'number' ? err.status : undefined;
    return upstreamError('The AI provider could not complete this request.', {
      upstreamStatus: status ?? null,
      upstreamType: err.type ?? null,
    });
  }

  return upstreamError('The AI request failed unexpectedly.');
}
