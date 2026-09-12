/**
 * PLACEHOLDER — the job-aggregation module (server/jobs/**) replaces this file.
 * Contract (do not change signatures without updating server/index.ts and server/routes/jobs.ts):
 */
import type { Job, JobSearchQuery, JobSearchResponse, JobSource } from '../../shared/types';

export async function searchJobs(query: JobSearchQuery): Promise<JobSearchResponse> {
  return {
    jobs: [],
    total: 0,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 25,
    sources: [],
    cached: false,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getJob(_id: string): Promise<Job | null> {
  return null;
}

export function listSourceConfig(): { source: JobSource; enabled: boolean; needsKey: boolean }[] {
  return [];
}
