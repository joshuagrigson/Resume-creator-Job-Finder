/**
 * Robust JSON extraction for model output.
 *
 * Even with a JSON schema attached to the request, output can arrive wrapped in ``` fences,
 * with a sentence in front of it, with trailing commas, or truncated by `max_tokens`.
 * `parseJsonLoose` does a best-effort repair; everything here is pure and synchronous.
 */
import type { ZodType } from 'zod';

export class JsonParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JsonParseError';
  }
}

/** Removes a surrounding ``` fence (closed or not) while keeping the payload intact. */
export function stripCodeFences(text: string): string {
  const fenced = /```[\w-]*[ \t]*\r?\n?([\s\S]*?)```/.exec(text);
  if (fenced && fenced[1] && /[{[]/.test(fenced[1])) return fenced[1];
  return text.replace(/^\s*```[\w-]*[ \t]*\r?\n?/, '').replace(/```\s*$/, '');
}

function trimTrailingSeparator(out: string[]): void {
  let i = out.length - 1;
  while (i >= 0 && /\s/.test(out[i] as string)) i--;
  if (i >= 0 && out[i] === ',') out.length = i;
}

function endsWithDanglingKey(out: string[]): boolean {
  let i = out.length - 1;
  while (i >= 0 && /\s/.test(out[i] as string)) i--;
  return i >= 0 && out[i] === ':';
}

/**
 * Rewrites a JSON-ish string into something `JSON.parse` accepts: drops prose before the first
 * `{`/`[` and after the matching close, strips `//` and block comments, removes trailing commas,
 * closes an unterminated string, and appends missing brackets when the output was cut off.
 */
export function repairJson(source: string): string {
  const out: string[] = [];
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let started = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i] as string;

    if (inString) {
      out.push(ch);
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }

    if (ch === '"') {
      if (!started) continue;
      inString = true;
      out.push(ch);
      continue;
    }

    if (ch === '{' || ch === '[') {
      started = true;
      stack.push(ch === '{' ? '}' : ']');
      out.push(ch);
      continue;
    }

    if (ch === '}' || ch === ']') {
      if (!started) continue;
      trimTrailingSeparator(out);
      if (endsWithDanglingKey(out)) out.push('null');
      const expected = stack.pop();
      if (expected === undefined) break;
      out.push(expected);
      if (stack.length === 0) return out.join('');
      continue;
    }

    if (!started) continue;
    out.push(ch);
  }

  if (inString) out.push('"');
  trimTrailingSeparator(out);
  if (endsWithDanglingKey(out)) out.push('null');
  while (stack.length > 0) out.push(stack.pop() as string);
  return out.join('');
}

/** Parses model output into a value, repairing common formatting damage first. */
export function parseJsonLoose(raw: unknown): unknown {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new JsonParseError('The model returned no JSON content.');
  }

  const direct = raw.trim();
  try {
    return JSON.parse(direct) as unknown;
  } catch {
    // fall through to repair
  }

  const unfenced = stripCodeFences(direct).trim();
  if (unfenced !== direct) {
    try {
      return JSON.parse(unfenced) as unknown;
    } catch {
      // fall through to repair
    }
  }

  const repaired = repairJson(unfenced);
  if (repaired !== '') {
    try {
      return JSON.parse(repaired) as unknown;
    } catch {
      // fall through to the error below
    }
  }

  throw new JsonParseError('The model response could not be parsed as JSON.');
}

/** Parses model output and validates it against a zod schema. */
export function parseJsonAs<T>(raw: unknown, schema: ZodType<T>): T {
  const value = parseJsonLoose(raw);
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new JsonParseError('The model response did not match the expected shape.');
  }
  return result.data;
}
