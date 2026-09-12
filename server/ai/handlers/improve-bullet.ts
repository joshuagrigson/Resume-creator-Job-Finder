/** POST /api/ai/improve-bullet — three honest rewrites of one resume bullet. */
import { z } from 'zod';
import type { AiImproveBulletResponse } from '../../../shared/types';
import { requestJson, type AiClient } from '../client';
import { upstreamError } from '../errors';
import { IMPROVE_BULLET_OUTPUT_SCHEMA, improveBulletPrompt } from '../prompts';
import type { ImproveBulletInput } from '../schemas';

const OutputSchema = z.object({ suggestions: z.array(z.string()) });

/** Trims, drops empties and near-duplicates, and keeps at most four suggestions. */
export function normalizeSuggestions(raw: readonly string[], original: string): string[] {
  const seen = new Set<string>([original.trim().toLowerCase()]);
  const out: string[] = [];
  for (const item of raw) {
    const text = item.replace(/^[-•*\s]+/, '').trim();
    if (text === '') continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length === 4) break;
  }
  return out;
}

export async function improveBullet(
  input: ImproveBulletInput,
  client?: AiClient,
): Promise<AiImproveBulletResponse> {
  const { system, user } = improveBulletPrompt(input);
  const result = await requestJson(
    { system, user, maxTokens: 4000, effort: 'medium', jsonSchema: IMPROVE_BULLET_OUTPUT_SCHEMA, client },
    OutputSchema,
  );

  const suggestions = normalizeSuggestions(result.suggestions, input.bullet);
  if (suggestions.length === 0) {
    throw upstreamError('The AI provider returned no usable rewrites. Try again.');
  }
  return { suggestions };
}
