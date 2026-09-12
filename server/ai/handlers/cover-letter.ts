/** POST /api/ai/cover-letter — 3–4 short paragraphs, signed with the candidate's name. */
import type { AiCoverLetterResponse } from '../../../shared/types';
import { requestText, type AiClient } from '../client';
import { upstreamError } from '../errors';
import { coverLetterPrompt } from '../prompts';
import type { CoverLetterInput } from '../schemas';

function tidy(letter: string): string {
  return letter
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^```[\w-]*\n?|```$/g, '')
    .trim();
}

/**
 * Guarantees the letter is signed. The prompt asks for it; this makes it true even when the
 * model forgets, so the client never has to patch the text.
 */
export function ensureSignature(letter: string, fullName: string): string {
  const name = fullName.trim();
  if (name === '') return letter;
  const tail = letter.slice(-200).toLowerCase();
  if (tail.includes(name.toLowerCase())) return letter;
  const closing = /\b(sincerely|regards|best|thank you)\b[,\s]*$/i.test(letter.trim());
  return `${letter.trimEnd()}${closing ? '\n' : '\n\nSincerely,\n'}${name}`;
}

export async function coverLetter(input: CoverLetterInput, client?: AiClient): Promise<AiCoverLetterResponse> {
  const { system, user } = coverLetterPrompt(input);
  const text = await requestText({ system, user, maxTokens: 4000, effort: 'medium', client });

  const letter = ensureSignature(tidy(text), input.resume.contact.fullName);
  if (letter.trim().length < 40) {
    throw upstreamError('The AI provider returned an unusably short letter. Try again.');
  }
  return { letter };
}
