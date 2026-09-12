/**
 * PLACEHOLDER — the AI module (server/ai/**) replaces this file.
 * Contract: getAiStatus() is synchronous and cheap (used by /api/health).
 */
import type { AiStatus } from '../../shared/types';

export function getAiStatus(): AiStatus {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { enabled: false, reason: 'ANTHROPIC_API_KEY not set' };
  return { enabled: true, model: process.env.ANTHROPIC_MODEL || 'claude-opus-5' };
}
