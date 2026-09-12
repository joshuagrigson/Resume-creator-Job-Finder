/**
 * /api/ai — optional AI endpoints.
 *
 *   GET  /status          → AiStatus (always answers, even when AI is off)
 *   POST /improve-bullet  → AiImproveBulletResponse
 *   POST /summary         → AiSummaryResponse
 *   POST /tailor          → AiTailorResponse
 *   POST /cover-letter    → AiCoverLetterResponse
 *   POST /parse-resume    → AiParseResumeResponse
 *
 * Every POST goes through: AI enabled? → per-IP rate limit → size caps + zod → handler.
 * Failures answer with the shared ApiError shape: 503 ai_disabled, 400 bad_request,
 * 429 rate_limited, 502 ai_upstream.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { ZodType } from 'zod';
import type { ApiError } from '../../shared/types';
import { getAiStatus, isAiEnabled } from '../ai/client';
import { AiError, aiDisabledError, mapUpstreamError, rateLimitedError } from '../ai/errors';
import { aiRateLimiter } from '../ai/ratelimit';
import { REQUEST_CAPS, validateRequest, type SizeCap } from '../ai/schemas';
import {
  CoverLetterRequestSchema,
  ImproveBulletRequestSchema,
  ParseResumeRequestSchema,
  SummaryRequestSchema,
  TailorRequestSchema,
} from '../ai/schemas';
import { improveBullet } from '../ai/handlers/improve-bullet';
import { summary } from '../ai/handlers/summary';
import { tailor } from '../ai/handlers/tailor';
import { coverLetter } from '../ai/handlers/cover-letter';
import { parseResume } from '../ai/handlers/parse-resume';

export const aiRouter = Router();

function clientKey(req: Request): string {
  const ip = typeof req.ip === 'string' && req.ip !== '' ? req.ip : req.socket.remoteAddress;
  return ip ?? 'unknown';
}

function sendAiError(res: Response, error: AiError): void {
  if (error.retryAfterSeconds !== undefined) res.setHeader('Retry-After', String(error.retryAfterSeconds));
  res.status(error.status).json(error.toBody());
}

/**
 * Wraps one endpoint: guards, validation, handler, error mapping. Express 5 propagates rejected
 * promises, but mapping here keeps the AI error bodies out of the generic handler in server/index.ts.
 */
function endpoint<Input, Output>(
  schema: ZodType<Input>,
  caps: readonly SizeCap[],
  handler: (input: Input) => Promise<Output>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      try {
        if (!isAiEnabled()) throw aiDisabledError();

        const limit = aiRateLimiter.check(clientKey(req));
        res.setHeader('X-RateLimit-Limit', String(limit.limit));
        res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
        if (!limit.allowed) throw rateLimitedError('local', limit.retryAfterSeconds);

        const input = validateRequest(schema, caps, req.body);
        const output = await handler(input);
        res.json(output);
      } catch (err) {
        const mapped = err instanceof AiError ? err : mapUpstreamError(err);
        if (mapped.status >= 500 && mapped.code === 'ai_upstream') {
          console.warn(`[ai] ${req.method} ${req.path} failed: ${mapped.message}`);
        }
        if (res.headersSent) return next(err);
        sendAiError(res, mapped);
      }
    })();
  };
}

aiRouter.get('/status', (_req: Request, res: Response) => {
  res.json(getAiStatus());
});

aiRouter.post('/improve-bullet', endpoint(ImproveBulletRequestSchema, REQUEST_CAPS.improveBullet, improveBullet));
aiRouter.post('/summary', endpoint(SummaryRequestSchema, REQUEST_CAPS.summary, summary));
aiRouter.post('/tailor', endpoint(TailorRequestSchema, REQUEST_CAPS.tailor, tailor));
aiRouter.post('/cover-letter', endpoint(CoverLetterRequestSchema, REQUEST_CAPS.coverLetter, coverLetter));
aiRouter.post('/parse-resume', endpoint(ParseResumeRequestSchema, REQUEST_CAPS.parseResume, parseResume));

/** Anything else under /api/ai is a 404 with the shared error shape. */
aiRouter.use((_req: Request, res: Response) => {
  const body: ApiError = { error: 'Not found', code: 'not_found' };
  res.status(404).json(body);
});
