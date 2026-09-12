import { beforeEach, describe, expect, it } from 'vitest';
import { clearJobCaches, jobLru, LruMap, recallJob, rememberJobs, TtlCache } from '../server/jobs/cache';
import { makeJob } from './jobs.helpers';

beforeEach(() => {
  clearJobCaches();
});

describe('TtlCache', () => {
  it('returns a stored value with its timestamp', () => {
    const cache = new TtlCache<number>(1000);
    cache.set('a', 1, 5_000);
    const hit = cache.get('a', 5_500);
    expect(hit?.value).toBe(1);
    expect(hit?.storedAt).toBe(5_000);
    expect(hit?.storedAtIso).toBe(new Date(5_000).toISOString());
  });

  it('expires entries once the TTL passes', () => {
    const cache = new TtlCache<string>(1000);
    cache.set('a', 'x', 0);
    expect(cache.get('a', 999)?.value).toBe('x');
    expect(cache.get('a', 1001)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('evicts the least recently used entry past the cap', () => {
    const cache = new TtlCache<number>(10_000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('a')?.value).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')?.value).toBe(3);
  });

  it('stores nothing when the TTL is zero', () => {
    const cache = new TtlCache<number>(0);
    cache.set('a', 1);
    expect(cache.get('a')).toBeUndefined();
  });
});

describe('LruMap', () => {
  it('drops the oldest key past the limit and refreshes on read', () => {
    const lru = new LruMap<string, number>(2);
    lru.set('a', 1);
    lru.set('b', 2);
    expect(lru.get('a')).toBe(1);
    lru.set('c', 3);
    expect(lru.has('b')).toBe(false);
    expect(lru.get('a')).toBe(1);
    expect(lru.size).toBe(2);
  });
});

describe('job LRU', () => {
  it('remembers and recalls jobs by id', () => {
    const jobs = [makeJob({ source: 'remotive', sourceId: '1' }), makeJob({ source: 'jobicy', sourceId: '2' })];
    rememberJobs(jobs);
    expect(recallJob('remotive:1')?.sourceId).toBe('1');
    expect(recallJob('jobicy:2')?.sourceId).toBe('2');
    expect(recallJob('nope:3')).toBeUndefined();
  });

  it('holds a large batch without unbounded growth', () => {
    rememberJobs(
      Array.from({ length: 6000 }, (_, i) => makeJob({ source: 'remotive', sourceId: String(i) })),
    );
    expect(jobLru.size).toBe(5000);
    expect(recallJob('remotive:0')).toBeUndefined();
    expect(recallJob('remotive:5999')).toBeDefined();
  });
});
