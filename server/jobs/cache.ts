/**
 * In-memory caches.
 *
 *  - `sourceCache`: per-source normalized results with a 15 minute TTL, keyed by the
 *    source plus only the parts of the query that source actually sends upstream.
 *    Boards like Arbeitnow (~2 MB) and Remote OK (~600 KB) are fetched once and filtered
 *    locally for every subsequent search.
 *  - `jobLru`: the most recent ~5000 normalized jobs by id, so `getJob(id)` works for
 *    detail panels and deep links without re-querying a board.
 *
 * Process-local by design — this is a single-process app with no external store.
 */
import type { Job } from '../../shared/types';

export const DEFAULT_TTL_MS = 15 * 60 * 1000;
export const JOB_LRU_LIMIT = 5000;

function ttlFromEnv(): number {
  const raw = Number(process.env.JOBS_CACHE_TTL_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_TTL_MS;
}

export interface CacheHit<V> {
  value: V;
  /** Epoch ms when the entry was stored. */
  storedAt: number;
  /** ISO timestamp of when the entry was stored. */
  storedAtIso: string;
}

interface Entry<V> {
  value: V;
  storedAt: number;
  storedAtIso: string;
  expiresAt: number;
}

/** Tiny TTL map with a hard entry cap (oldest-first eviction). */
export class TtlCache<V> {
  private readonly entries = new Map<string, Entry<V>>();

  constructor(
    private readonly ttlMs: number = ttlFromEnv(),
    private readonly maxEntries: number = 200,
  ) {}

  get(key: string, now = Date.now()): CacheHit<V> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    // Refresh recency so hot keys survive eviction.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { value: entry.value, storedAt: entry.storedAt, storedAtIso: entry.storedAtIso };
  }

  set(key: string, value: V, now = Date.now()): void {
    if (this.ttlMs <= 0) return;
    this.entries.delete(key);
    this.entries.set(key, {
      value,
      storedAt: now,
      storedAtIso: new Date(now).toISOString(),
      expiresAt: now + this.ttlMs,
    });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Insertion-ordered LRU backed by `Map`. */
export class LruMap<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly limit: number) {}

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.limit <= 0) return;
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.limit) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.map.delete(oldest.value);
    }
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

/** Normalized results per `${source}|${adapter.cacheKey(query)}`. */
export const sourceCache = new TtlCache<Job[]>();

/** Recently seen jobs, addressable by `Job.id`. */
export const jobLru = new LruMap<string, Job>(JOB_LRU_LIMIT);

export function rememberJobs(jobs: readonly Job[]): void {
  for (const job of jobs) jobLru.set(job.id, job);
}

export function recallJob(id: string): Job | undefined {
  return jobLru.get(id);
}

/** Test helper — drops every cached entry. */
export function clearJobCaches(): void {
  sourceCache.clear();
  jobLru.clear();
}
