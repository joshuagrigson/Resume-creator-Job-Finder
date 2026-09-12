/**
 * Live smoke test for the job aggregation pipeline.
 *
 *   npx tsx scripts/smoke.ts
 *   npm run smoke
 *
 * Hits the real boards for a few queries and prints per-source status, counts and timings
 * plus a handful of sample titles. A failing board is reported, not fatal: the process
 * exits non-zero only when the pipeline itself crashes.
 */
import 'dotenv/config';
import { clearJobCaches, getJob, listSourceConfig, searchJobs } from '../server/jobs/index';
import type { JobSearchQuery, SourceReport } from '../shared/types';

const QUERIES: JobSearchQuery[] = [
  { q: 'react typescript', remoteOnly: true, pageSize: 10, sort: 'relevance' },
  { q: 'marketing operations', pageSize: 10, sort: 'relevance' },
  { q: '', location: 'remote', postedWithinDays: 14, pageSize: 10, sort: 'date' },
];

const STATUS_WIDTH = 8;
const SOURCE_WIDTH = 10;

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function describe(query: JobSearchQuery): string {
  const bits = [
    query.q ? `q="${query.q}"` : 'q=(any)',
    query.location ? `location="${query.location}"` : undefined,
    query.remoteOnly ? 'remoteOnly' : undefined,
    query.postedWithinDays ? `postedWithinDays=${query.postedWithinDays}` : undefined,
    `sort=${query.sort ?? 'relevance'}`,
  ].filter(Boolean);
  return bits.join('  ');
}

function printReports(reports: readonly SourceReport[]): void {
  for (const report of reports) {
    const line = `    ${pad(report.source, SOURCE_WIDTH)} ${pad(report.status, STATUS_WIDTH)} ${pad(
      `${report.count} jobs`,
      10,
    )} ${pad(`${report.ms}ms`, 8)}`;
    console.log(report.error ? `${line} ${report.error}` : line);
  }
}

async function main(): Promise<void> {
  console.log('Launchpad job search — live smoke test');
  console.log(`node ${process.version}  ${new Date().toISOString()}`);
  console.log('');

  console.log('Configured sources:');
  for (const config of listSourceConfig()) {
    const state = config.enabled ? 'enabled' : `disabled${config.needsKey ? ' (needs key)' : ''}`;
    console.log(`    ${pad(config.source, SOURCE_WIDTH)} ${state}`);
  }
  console.log('');

  // Start from a clean cache so the first query measures real upstream latency.
  clearJobCaches();

  let totalOk = 0;
  let totalFailed = 0;

  for (const query of QUERIES) {
    console.log(`--- ${describe(query)}`);
    const startedAt = Date.now();
    const response = await searchJobs(query);
    const elapsed = Date.now() - startedAt;

    printReports(response.sources);
    totalOk += response.sources.filter((report) => report.status === 'ok').length;
    totalFailed += response.sources.filter((report) => report.status === 'error' || report.status === 'timeout').length;

    console.log(
      `    => ${response.total} matches, page ${response.page}/${Math.max(
        1,
        Math.ceil(response.total / response.pageSize),
      )}, cached=${response.cached}, ${elapsed}ms total`,
    );
    for (const job of response.jobs.slice(0, 3)) {
      const salary = job.salary?.display
        ? ` · ${job.salary.display}`
        : job.salary?.min
          ? ` · ${job.salary.min}${job.salary.max ? `–${job.salary.max}` : '+'} ${job.salary.currency ?? ''}`.trimEnd()
          : '';
      console.log(`       • ${job.title} — ${job.company} [${job.source}] ${job.location || 'n/a'}${salary}`);
    }
    if (response.jobs.length === 0) console.log('       (no matches for this query)');
    console.log('');
  }

  // Second run of the first query should be served entirely from the TTL cache.
  const first = QUERIES[0];
  if (first) {
    const startedAt = Date.now();
    const cachedRun = await searchJobs(first);
    console.log(`--- cache check: repeat of ${describe(first)}`);
    console.log(`    cached=${cachedRun.cached}  ${cachedRun.total} matches in ${Date.now() - startedAt}ms`);
    const sample = cachedRun.jobs[0];
    if (sample) {
      const looked = await getJob(sample.id);
      console.log(`    getJob("${sample.id}") → ${looked ? `"${looked.title}"` : 'not found'}`);
    }
    console.log('');
  }

  console.log(`Done. ${totalOk} source responses ok, ${totalFailed} failed across ${QUERIES.length} queries.`);
}

main().catch((err: unknown) => {
  console.error('[smoke] pipeline crashed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
