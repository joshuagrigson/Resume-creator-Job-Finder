/**
 * POST /api/ai/tailor — targeted edits for one posting.
 *
 * Suggestions are only useful if the client can apply them, so every bullet suggestion is checked
 * against the resume that was sent: an unknown experienceId or an out-of-range bulletIndex means
 * the model drifted, and the suggestion is dropped rather than shown.
 */
import { z } from 'zod';
import type { AiTailorResponse, AiTailorSuggestion } from '../../../shared/types';
import { requestJson, type AiClient } from '../client';
import { upstreamError } from '../errors';
import { TAILOR_OUTPUT_SCHEMA, tailorPrompt } from '../prompts';
import type { ResumeInput, TailorInput } from '../schemas';

const OutputSchema = z.object({
  suggestions: z
    .array(
      z.object({
        type: z.enum(['summary', 'bullet', 'skill', 'headline']),
        experienceId: z.string().default(''),
        bulletIndex: z.number().int().default(-1),
        original: z.string().default(''),
        suggested: z.string().default(''),
        reason: z.string().default(''),
      }),
    )
    .default([]),
  keywordsToAdd: z.array(z.string()).default([]),
  note: z.string().default(''),
});

type RawSuggestion = z.infer<typeof OutputSchema>['suggestions'][number];

function bulletCounts(resume: ResumeInput): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of resume.experience) {
    if (item.id.trim() === '') continue;
    counts.set(item.id, item.bullets.length);
  }
  return counts;
}

/** Keeps only suggestions that point at real resume content. Exported for tests. */
export function reconcileSuggestions(raw: readonly RawSuggestion[], resume: ResumeInput): AiTailorSuggestion[] {
  const counts = bulletCounts(resume);
  const out: AiTailorSuggestion[] = [];

  for (const item of raw) {
    const suggested = item.suggested.trim();
    if (suggested === '') continue;

    const base: AiTailorSuggestion = {
      type: item.type,
      suggested,
      reason: item.reason.trim(),
    };
    const original = item.original.trim();
    if (original !== '') base.original = original;

    if (item.type === 'bullet') {
      const experienceId = item.experienceId.trim();
      const count = counts.get(experienceId);
      if (count === undefined) continue;
      if (!Number.isInteger(item.bulletIndex) || item.bulletIndex < 0 || item.bulletIndex >= count) continue;
      base.experienceId = experienceId;
      base.bulletIndex = item.bulletIndex;
    }

    out.push(base);
    if (out.length === 8) break;
  }

  return out;
}

function normalizeKeywords(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const text = item.trim();
    if (text === '' || text.length > 60) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length === 20) break;
  }
  return out;
}

export async function tailor(input: TailorInput, client?: AiClient): Promise<AiTailorResponse> {
  const { system, user } = tailorPrompt(input);
  const result = await requestJson(
    { system, user, maxTokens: 8000, effort: 'high', jsonSchema: TAILOR_OUTPUT_SCHEMA, client },
    OutputSchema,
  );

  const suggestions = reconcileSuggestions(result.suggestions, input.resume);
  const keywordsToAdd = normalizeKeywords(result.keywordsToAdd);
  const note = result.note.replace(/\s+/g, ' ').trim();

  if (suggestions.length === 0 && keywordsToAdd.length === 0) {
    throw upstreamError('The AI provider returned no usable suggestions. Try again.');
  }

  return { suggestions, keywordsToAdd, note };
}
