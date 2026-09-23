/**
 * POST /api/ai/polish — the smart prompt under a field. Rewords what he typed; never adds a fact.
 *
 * The prompt forbids new facts, and this handler enforces the part that can be checked: a rewrite
 * that introduces a number (or a "[X]" placeholder) that is not in his text or his answers is
 * thrown away and his own words come back unchanged, with the model's questions still attached.
 */
import { z } from 'zod';
import type { AiPolishResponse } from '../../../shared/types';
import { requestJson, type AiClient } from '../client';
import { POLISH_OUTPUT_SCHEMA, polishPrompt } from '../prompts';
import type { PolishInput } from '../schemas';

const OutputSchema = z.object({
  polished: z.string(),
  why: z.string().default(''),
  questions: z.array(z.string()).default([]),
});

const NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
  ten: '10', eleven: '11', twelve: '12', fifteen: '15', twenty: '20', thirty: '30', forty: '40', fifty: '50',
  hundred: '100', thousand: '1000', dozen: '12', half: '50',
};

/** Number words that are usually not a count ("one of the", "half the time") — not held against a rewrite. */
const LOOSE_WORDS = new Set(['one', 'half']);

/** Every number in the text as bare digits: "1,200" → "1200", "5k" → "5", "five" → "5". */
export function numbersIn(text: string, options: { strictWords?: boolean } = {}): Set<string> {
  const found = new Set<string>();
  for (const match of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    found.add(match[0].replace(/,/g, '').replace(/\.0+$/, ''));
  }
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    const digit = NUMBER_WORDS[word];
    if (digit && !(options.strictWords && LOOSE_WORDS.has(word))) found.add(digit);
  }
  return found;
}

/** True when the rewrite states a number, or a placeholder, that he never gave. */
export function addsFacts(source: string, rewrite: string): boolean {
  if (/\[[^\]]*\]/.test(rewrite) && !/\[[^\]]*\]/.test(source)) return true;
  const known = numbersIn(source);
  for (const n of numbersIn(rewrite, { strictWords: true })) {
    if (!known.has(n)) return true;
  }
  return false;
}

function cleanLine(text: string): string {
  return text
    .replace(/^[-•*\s]+/, '')
    .replace(/^["“]+|["”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function polish(input: PolishInput, client?: AiClient): Promise<AiPolishResponse> {
  const { system, user } = polishPrompt(input);
  const result = await requestJson(
    { system, user, maxTokens: 2000, effort: 'low', jsonSchema: POLISH_OUTPUT_SCHEMA, client },
    OutputSchema,
  );

  const original = input.text.trim();
  const questions = result.questions
    .map((q) => q.trim())
    .filter((q, i, all) => q !== '' && all.indexOf(q) === i)
    .slice(0, 2);

  const facts = [original, ...(input.answers ?? []).map((a) => a.answer)].join('\n');
  const polished = input.kind === 'summary' ? result.polished.trim() : cleanLine(result.polished);

  if (polished === '' || addsFacts(facts, polished)) {
    return { polished: original, changed: false, why: '', questions };
  }
  if (polished === original) {
    return { polished: original, changed: false, why: '', questions };
  }
  return { polished, changed: true, why: result.why.trim(), questions };
}
