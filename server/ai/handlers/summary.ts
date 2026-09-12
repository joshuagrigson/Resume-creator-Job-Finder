/** POST /api/ai/summary — a professional summary plus two alternatives. */
import { z } from 'zod';
import type { AiSummaryResponse } from '../../../shared/types';
import { requestJson, type AiClient } from '../client';
import { upstreamError } from '../errors';
import { SUMMARY_OUTPUT_SCHEMA, summaryPrompt } from '../prompts';
import type { SummaryInput } from '../schemas';

const OutputSchema = z.object({
  summary: z.string(),
  alternatives: z.array(z.string()).default([]),
});

function clean(text: string): string {
  return text
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function summary(input: SummaryInput, client?: AiClient): Promise<AiSummaryResponse> {
  const { system, user } = summaryPrompt(input);
  const result = await requestJson(
    { system, user, maxTokens: 4000, effort: 'medium', jsonSchema: SUMMARY_OUTPUT_SCHEMA, client },
    OutputSchema,
  );

  const main = clean(result.summary);
  if (main === '') throw upstreamError('The AI provider returned an empty summary. Try again.');

  const seen = new Set<string>([main.toLowerCase()]);
  const alternatives: string[] = [];
  for (const item of result.alternatives) {
    const text = clean(item);
    if (text === '' || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    alternatives.push(text);
    if (alternatives.length === 3) break;
  }

  return { summary: main, alternatives };
}
