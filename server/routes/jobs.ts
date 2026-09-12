/**
 * GET /api/jobs/search — validated query → aggregated, ranked, paginated results.
 * GET /api/jobs/:id    — one job out of the server-side cache (used by detail/deep links).
 */
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { getJob, searchJobs } from '../jobs/index';
import type { ApiError, JobSearchQuery } from '../../shared/types';

export const jobsRouter = Router();

/** Express 5 propagates rejected promises, but only when we hand them to `next`. */
function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

const JOB_SOURCE_VALUES = [
  'remotive',
  'remoteok',
  'arbeitnow',
  'themuse',
  'jobicy',
  'himalayas',
  'adzuna',
  'usajobs',
] as const;

const EMPLOYMENT_TYPE_VALUES = ['full_time', 'part_time', 'contract', 'internship', 'temporary', 'other'] as const;

const BooleanParam = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0', 'yes', 'no', ''])])
  .transform((value) => value === true || value === 'true' || value === '1' || value === 'yes');

const SearchQuerySchema = z.object({
  q: z.string().max(200, 'q must be 200 characters or fewer').optional().default(''),
  location: z.string().max(120, 'location must be 120 characters or fewer').optional(),
  remoteOnly: BooleanParam.optional().default(false),
  sources: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined;
      const names = value
        .split(',')
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean);
      if (names.length === 0) return undefined;
      const allowed = new Set<string>(JOB_SOURCE_VALUES);
      const invalid = names.filter((name) => !allowed.has(name));
      if (invalid.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: `Unknown source(s): ${invalid.join(', ')}. Valid sources: ${JOB_SOURCE_VALUES.join(', ')}`,
          path: ['sources'],
        });
        return z.NEVER;
      }
      return names as unknown as JobSearchQuery['sources'];
    }),
  postedWithinDays: z.coerce.number().int().min(1).max(365).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPE_VALUES).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  sort: z.enum(['relevance', 'date']).optional().default('relevance'),
});

function badRequest(res: Response, message: string, details?: unknown): void {
  const body: ApiError = { error: message, code: 'bad_request' };
  if (details !== undefined) body.details = details;
  res.status(400).json(body);
}

jobsRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    const parsed = SearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'query',
        message: issue.message,
      }));
      badRequest(res, issues[0]?.message ?? 'Invalid search query', issues);
      return;
    }

    const data = parsed.data;
    const query: JobSearchQuery = {
      q: data.q.trim(),
      remoteOnly: data.remoteOnly,
      page: data.page,
      pageSize: data.pageSize,
      sort: data.sort,
    };
    const location = data.location?.trim();
    if (location) query.location = location;
    if (data.sources && data.sources.length > 0) query.sources = data.sources;
    if (data.postedWithinDays !== undefined) query.postedWithinDays = data.postedWithinDays;
    if (data.employmentType !== undefined) query.employmentType = data.employmentType;

    const response = await searchJobs(query);
    // Search results are cheap to re-fetch and change often; let the browser reuse briefly.
    res.setHeader('Cache-Control', 'private, max-age=30');
    res.json(response);
  }),
);

jobsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!id || id.length > 300) {
      badRequest(res, 'A job id is required');
      return;
    }

    const job = await getJob(id);
    if (!job) {
      const body: ApiError = { error: 'Job not found', code: 'not_found' };
      res.status(404).json(body);
      return;
    }
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json(job);
  }),
);
