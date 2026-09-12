import { beforeEach, describe, expect, it } from 'vitest';
import { AI_RATE_LIMIT, aiRateLimiter, createRateLimiter } from '../server/ai/ratelimit';

describe('createRateLimiter', () => {
  it('allows up to the limit and then blocks', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(true);
    const third = limiter.check('a');
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = limiter.check('a');
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('tracks keys independently', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    expect(limiter.check('b').allowed).toBe(true);
  });

  it('frees slots once the window slides past', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 10_000 });
    const t0 = 1_000_000;
    expect(limiter.check('a', t0).allowed).toBe(true);
    expect(limiter.check('a', t0 + 1).allowed).toBe(true);
    expect(limiter.check('a', t0 + 2).allowed).toBe(false);
    expect(limiter.check('a', t0 + 10_001).allowed).toBe(true);
  });

  it('reports a retry hint that matches the remaining window', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const t0 = 5_000_000;
    limiter.check('a', t0);
    expect(limiter.check('a', t0 + 20_000).retryAfterSeconds).toBe(40);
  });

  it('reset clears one key or everything', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter.check('a');
    limiter.check('b');
    limiter.reset('a');
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(false);
    limiter.reset();
    expect(limiter.check('b').allowed).toBe(true);
  });

  it('evicts stale keys instead of growing without bound', () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 1000, maxKeys: 4 });
    const t0 = 2_000_000;
    for (let i = 0; i < 4; i += 1) limiter.check(`key-${i}`, t0);
    expect(limiter.size()).toBe(4);
    limiter.check('fresh', t0 + 5000);
    expect(limiter.size()).toBe(1);
  });
});

describe('aiRateLimiter', () => {
  beforeEach(() => aiRateLimiter.reset());

  it('is configured as 30 requests per 10 minutes', () => {
    expect(AI_RATE_LIMIT).toEqual({ limit: 30, windowMs: 600_000 });
  });

  it('blocks the 31st request from one IP', () => {
    for (let i = 0; i < 30; i += 1) {
      expect(aiRateLimiter.check('203.0.113.7').allowed).toBe(true);
    }
    expect(aiRateLimiter.check('203.0.113.7').allowed).toBe(false);
    expect(aiRateLimiter.check('203.0.113.8').allowed).toBe(true);
  });
});
