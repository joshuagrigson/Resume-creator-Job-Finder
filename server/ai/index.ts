/**
 * server/ai — optional AI features backed by the Anthropic API.
 *
 * Everything here is inert without ANTHROPIC_API_KEY: getAiStatus() reports `enabled: false`
 * and the routes answer 503 `ai_disabled`. The rest of the app stays fully usable.
 *
 * Contract used by server/index.ts: getAiStatus() is synchronous and cheap.
 */
export { getAiStatus, isAiEnabled, resolveModel, createAiClient, setAiClientFactory, getAiClient, DEFAULT_MODEL } from './client';
export type { AiClient, AiClientFactory } from './client';

export { AiError, mapUpstreamError, aiDisabledError, badRequestError, rateLimitedError, upstreamError } from './errors';
export type { AiErrorCode } from './errors';

export { AI_RATE_LIMIT, aiRateLimiter, createRateLimiter } from './ratelimit';
export type { RateLimiter, RateLimitResult, RateLimitOptions } from './ratelimit';

export { JsonParseError, parseJsonAs, parseJsonLoose, repairJson, stripCodeFences } from './json';

export {
  SIZE_CAPS,
  REQUEST_CAPS,
  ResumeInputSchema,
  ImproveBulletRequestSchema,
  SummaryRequestSchema,
  TailorRequestSchema,
  CoverLetterRequestSchema,
  ParseResumeRequestSchema,
  enforceSizeCaps,
  validateRequest,
} from './schemas';
export type {
  ResumeInput,
  ImproveBulletInput,
  SummaryInput,
  TailorInput,
  CoverLetterInput,
  ParseResumeInput,
} from './schemas';

export { improveBullet } from './handlers/improve-bullet';
export { summary } from './handlers/summary';
export { tailor } from './handlers/tailor';
export { coverLetter } from './handlers/cover-letter';
export { parseResume, normalizeMonth } from './handlers/parse-resume';
