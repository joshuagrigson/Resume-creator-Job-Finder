/**
 * Job aggregation service.
 *
 * `searchJobs` fans out to every enabled board in parallel, normalizes and caches each
 * board's results, then does the real searching locally: dedupe → filter → rank → paginate.
 * A board that fails, times out, or is missing credentials shows up honestly in
 * `SourceReport[]` and never fails the request.
 *
 * Public contract (consumed by server/index.ts and server/routes/jobs.ts):
 *   searchJobs(query)      → JobSearchResponse
 *   getJob(id)             → Job | null   (from the LRU of recently seen jobs)
 *   listSourceConfig()     → per-source enabled/needsKey
 */
import type {
  Job,
  JobSearchQuery,
  JobSearchResponse,
  JobSource,
  SourceReport,
  SourceStatus,
} from '../../shared/types';
import { rememberJobs, recallJob, sourceCache } from './cache';
import { dedupeJobs } from './dedupe';
import { filterJobs, parseQueryTerms } from './filter';
import { HttpError, TimeoutError } from './http';
import { paginate, rankJobs } from './rank';
import { ALL_SOURCES } from './sources/index';
import type { FetchLike, JobSourceAdapter, SourceEnv } from './types';

export const PER_SOURCE_TIMEOUT_MS = 8_000;
export const OVERALL_BUDGET_MS = 12_000;

export interface SearchOptions {
  /** Injected for tests; defaults to the global fetch. */
  fetch?: FetchLike;
  env?: SourceEnv;
  now?: Date;
  /** Override the adapter set (tests inject stubs). */
  adapters?: readonly JobSourceAdapter[];
  /** Set to false to bypass the per-source TTL cache. */
  useCache?: boolean;
  perSourceTimeoutMs?: number;
  overallBudgetMs?: number;
}

interface SourceOutcome {
  report: SourceReport;
  jobs: Job[];
  fromCache: boolean;
  /** ISO timestamp of when this source's data was actually fetched. */
  dataFetchedAt?: string;
}

/** Our own deadline, distinguishable from a caller abort. */
class BudgetExceededError extends TimeoutError {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof HttpError) return `HTTP ${err.status} from ${err.target}`;
  if (err instanceof Error) return err.message.slice(0, 300);
  return 'Unknown error';
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
}

function resolveAdapters(
  query: JobSearchQuery,
  adapters: readonly JobSourceAdapter[],
): { selected: JobSourceAdapter[]; unknownSources: JobSource[] } {
  const requested = query.sources?.filter((source, index, list) => list.indexOf(source) === index);
  if (!requested || requested.length === 0) return { selected: [...adapters], unknownSources: [] };

  const selected: JobSourceAdapter[] = [];
  const unknownSources: JobSource[] = [];
  for (const source of requested) {
    const adapter = adapters.find((candidate) => candidate.source === source);
    if (adapter) selected.push(adapter);
    else unknownSources.push(source);
  }
  return { selected, unknownSources };
}

async function runSource(
  adapter: JobSourceAdapter,
  query: JobSearchQuery,
  options: Required<Pick<SearchOptions, 'fetch' | 'env' | 'now' | 'useCache' | 'perSourceTimeoutMs'>>,
  overallSignal: AbortSignal,
): Promise<SourceOutcome> {
  const startedAt = Date.now();

  const disabled = adapter.disabledReason(options.env);
  if (disabled) {
    return {
      report: { source: adapter.source, status: 'disabled', count: 0, ms: 0, error: disabled },
      jobs: [],
      fromCache: false,
    };
  }

  const key = `${adapter.source}|${adapter.cacheKey(query)}`;
  if (options.useCache) {
    const hit = sourceCache.get(key);
    if (hit) {
      return {
        report: { source: adapter.source, status: 'ok', count: hit.value.length, ms: Date.now() - startedAt },
        jobs: hit.value,
        fromCache: true,
        dataFetchedAt: hit.storedAtIso,
      };
    }
  }

  const controller = new AbortController();
  const onOverall = () => controller.abort(new BudgetExceededError('overall request budget exceeded'));
  if (overallSignal.aborted) onOverall();
  else overallSignal.addEventListener('abort', onOverall, { once: true });
  const timer = setTimeout(
    () => controller.abort(new BudgetExceededError(`no response within ${options.perSourceTimeoutMs}ms`)),
    options.perSourceTimeoutMs,
  );

  const fetchedAt = new Date().toISOString();
  try {
    const jobs = await adapter.fetchJobs(query, {
      fetch: options.fetch,
      signal: controller.signal,
      env: options.env,
      now: options.now,
      fetchedAt,
    });
    const safeJobs = Array.isArray(jobs) ? jobs : [];
    if (options.useCache) sourceCache.set(key, safeJobs);
    return {
      report: { source: adapter.source, status: 'ok', count: safeJobs.length, ms: Date.now() - startedAt },
      jobs: safeJobs,
      fromCache: false,
      dataFetchedAt: fetchedAt,
    };
  } catch (err) {
    const status: SourceStatus = isTimeout(err) || controller.signal.aborted ? 'timeout' : 'error';
    const message =
      status === 'timeout' && controller.signal.reason instanceof Error
        ? controller.signal.reason.message
        : errorMessage(err);
    return {
      report: { source: adapter.source, status, count: 0, ms: Date.now() - startedAt, error: message },
      jobs: [],
      fromCache: false,
    };
  } finally {
    clearTimeout(timer);
    overallSignal.removeEventListener('abort', onOverall);
  }
}

/**
 * Aggregate, filter, rank and paginate. Never rejects because a board misbehaved.
 */
export async function searchJobs(query: JobSearchQuery, options: SearchOptions = {}): Promise<JobSearchResponse> {
  const now = options.now ?? new Date();
  const runOptions = {
    fetch: options.fetch ?? globalThis.fetch,
    env: options.env ?? process.env,
    now,
    useCache: options.useCache ?? true,
    perSourceTimeoutMs: options.perSourceTimeoutMs ?? PER_SOURCE_TIMEOUT_MS,
  };
  const adapters = options.adapters ?? ALL_SOURCES;
  const { selected, unknownSources } = resolveAdapters(query, adapters);

  const budget = new AbortController();
  const budgetTimer = setTimeout(
    () => budget.abort(new BudgetExceededError('overall request budget exceeded')),
    options.overallBudgetMs ?? OVERALL_BUDGET_MS,
  );

  let outcomes: SourceOutcome[];
  try {
    const settled = await Promise.allSettled(
      selected.map((adapter) => runSource(adapter, query, runOptions, budget.signal)),
    );
    outcomes = settled.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      const adapter = selected[index];
      return {
        report: {
          source: adapter.source,
          status: 'error' as const,
          count: 0,
          ms: 0,
          error: errorMessage(result.reason),
        },
        jobs: [],
        fromCache: false,
      };
    });
  } finally {
    clearTimeout(budgetTimer);
  }

  const reports: SourceReport[] = [
    ...outcomes.map((outcome) => outcome.report),
    ...unknownSources.map<SourceReport>((source) => ({
      source,
      status: 'skipped',
      count: 0,
      ms: 0,
      error: 'Source is not available',
    })),
  ];

  const collected = outcomes.flatMap((outcome) => outcome.jobs);
  rememberJobs(collected);

  const terms = parseQueryTerms(query.q);
  const deduped = dedupeJobs(collected);
  const filtered = filterJobs(deduped, query, { now, terms });
  const ranked = rankJobs(filtered, terms, query.sort ?? 'relevance');
  const page = paginate(ranked, query.page ?? 1, query.pageSize ?? 25);

  const contributing = outcomes.filter((outcome) => outcome.report.status === 'ok');
  const cached = contributing.length > 0 && contributing.every((outcome) => outcome.fromCache);
  const fetchTimes = contributing
    .map((outcome) => outcome.dataFetchedAt)
    .filter((value): value is string => typeof value === 'string');
  // Report the oldest contributing fetch so the UI can be honest about staleness.
  const fetchedAt = fetchTimes.length > 0 ? fetchTimes.sort()[0] : now.toISOString();

  return {
    jobs: page.items,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    sources: reports,
    cached,
    fetchedAt: fetchedAt ?? now.toISOString(),
  };
}

/** Look a job up in the LRU populated by previous searches. */
export async function getJob(id: string): Promise<Job | null> {
  if (typeof id !== 'string' || id.length === 0) return null;
  return recallJob(id) ?? null;
}

/** Every configured board with whether it can run right now. */
export function listSourceConfig(
  env: SourceEnv = process.env,
): { source: JobSource; enabled: boolean; needsKey: boolean }[] {
  return ALL_SOURCES.map((adapter) => ({
    source: adapter.source,
    enabled: adapter.disabledReason(env) === null,
    needsKey: adapter.needsKey,
  }));
}

export { ALL_SOURCES, getSourceAdapter } from './sources/index';
export { clearJobCaches } from './cache';
export type { JobSourceAdapter, SourceContext, SourceEnv, FetchLike } from './types';
