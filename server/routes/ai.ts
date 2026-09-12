/**
 * PLACEHOLDER — owned by the AI module.
 */
import { Router } from 'express';
import { getAiStatus } from '../ai/index';
import type { ApiError } from '../../shared/types';

export const aiRouter = Router();

aiRouter.get('/status', (_req, res) => {
  res.json(getAiStatus());
});

aiRouter.use((_req, res) => {
  const body: ApiError = { error: 'AI features are not configured', code: 'ai_disabled' };
  res.status(503).json(body);
});
