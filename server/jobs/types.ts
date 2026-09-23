/**
 * Adapter contract shared by every job board integration.
 *
 * Adapters are pure-ish: everything they touch from the outside world (fetch, env, clock)
 * arrives through `SourceContext`, which is what lets the tests run the whole search
 * pipeline without a network.
 */
import type { Job, JobSearchQuery, JobSource } from '../../shared/types';

/** Injectable `fetch`. Tests pass a stub; production passes `globalThis.fetch`. */
export type FetchLike = typeof globalThis.fetch;

/** Read-only view of the process environment (injectable for tests). */
export type SourceEnv = Readonly<Record<string, string | undefined>>;

export interface SourceContext {
  /** Fetch implementation to use for every outbound request. */
  readonly fetch: FetchLike;
  /** Aborted when the per-source timeout or the overall request budget expires. */
  readonly signal: AbortSignal;
  readonly env: SourceEnv;
  readonly now: Date;
  /** ISO timestamp stamped onto every job produced during this fetch. */
  readonly fetchedAt: string;
}

export interface JobSourceAdapter {
  readonly source: JobSource;
  /** True when the board requires credentials we may not have. */
  readonly needsKey: boolean;
  /**
   * True when the board takes a place plus a radius (Adzuna, USAJOBS). Boards without it
   * that still filter by place get the biggest nearby city instead of the ZIP's own town.
   */
  readonly searchesByRadius?: boolean;
  /** Human-readable reason the source cannot run, or `null` when it is usable. */
  disabledReason(env: SourceEnv): string | null;
  /**
   * Stable key for the parts of the query this source actually sends upstream.
   * Sources that ignore the query entirely return a constant so one fetch serves everyone.
   */
  cacheKey(query: JobSearchQuery): string;
  /** Fetch + normalize. Must never throw for a single malformed item. */
  fetchJobs(query: JobSearchQuery, ctx: SourceContext): Promise<Job[]>;
}
