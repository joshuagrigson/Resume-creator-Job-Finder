/**
 * PLACEHOLDER — owned by the job-aggregation module. Parses query params and delegates to server/jobs.
 */
import { Router } from 'express';
import { getJob, searchJobs } from '../jobs/index';
import type { ApiError, JobSearchQuery } from '../../shared/types';

export const jobsRouter = Router();

jobsRouter.get('/search', async (req, res, next) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const query: JobSearchQuery = {
      q: q.q ?? '',
      location: q.location,
      remoteOnly: q.remoteOnly === 'true',
      page: q.page ? Number(q.page) : 1,
      pageSize: q.pageSize ? Number(q.pageSize) : 25,
    };
    res.json(await searchJobs(query));
  } catch (e) {
    next(e);
  }
});

jobsRouter.get('/:id', async (req, res, next) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) {
      const body: ApiError = { error: 'Job not found', code: 'not_found' };
      return res.status(404).json(body);
    }
    res.json(job);
  } catch (e) {
    next(e);
  }
});
