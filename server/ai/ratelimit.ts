/**
 * Tiny in-memory sliding-window rate limiter (per client IP).
 *
 * Single-process only — good enough for a hobby deployment where the AI proxy is the
 * expensive part. Nothing is persisted and no request content is stored, only timestamps.
 */

export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Safety valve so a flood of unique keys cannot grow the map without bound. */
  maxKeys?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  /** Requests left in the current window after this one. */
  remaining: number;
  /** Seconds until at least one slot frees up (>= 1 when blocked, 0 when allowed). */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult;
  /** Clears one key, or everything when called without arguments. */
  reset(key?: string): void;
  /** Number of keys currently tracked (diagnostics/tests). */
  size(): number;
}

const DEFAULT_MAX_KEYS = 5_000;

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowMs = Math.max(1, Math.floor(options.windowMs));
  const maxKeys = Math.max(1, Math.floor(options.maxKeys ?? DEFAULT_MAX_KEYS));
  const hits = new Map<string, number[]>();

  function sweep(now: number): void {
    for (const [key, stamps] of hits) {
      const alive = stamps.filter((t) => t > now - windowMs);
      if (alive.length === 0) hits.delete(key);
      else hits.set(key, alive);
    }
    // Still too many distinct keys: drop the oldest inserted ones (Map keeps insertion order).
    while (hits.size > maxKeys) {
      const oldest = hits.keys().next();
      if (oldest.done) break;
      hits.delete(oldest.value);
    }
  }

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      if (hits.size >= maxKeys) sweep(now);

      const cutoff = now - windowMs;
      const previous = hits.get(key) ?? [];
      const stamps = previous.length > 0 ? previous.filter((t) => t > cutoff) : previous;

      if (stamps.length >= limit) {
        hits.set(key, stamps);
        const oldest = stamps[0] ?? now;
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        return { allowed: false, limit, remaining: 0, retryAfterSeconds };
      }

      stamps.push(now);
      hits.set(key, stamps);
      return { allowed: true, limit, remaining: Math.max(0, limit - stamps.length), retryAfterSeconds: 0 };
    },

    reset(key?: string): void {
      if (key === undefined) hits.clear();
      else hits.delete(key);
    },

    size(): number {
      return hits.size;
    },
  };
}

/** Spec default: 30 AI requests per 10 minutes per IP. */
export const AI_RATE_LIMIT: RateLimitOptions = { limit: 30, windowMs: 10 * 60 * 1000 };

/** Shared limiter used by the AI routes. */
export const aiRateLimiter: RateLimiter = createRateLimiter(AI_RATE_LIMIT);
