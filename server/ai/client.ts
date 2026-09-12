/**
 * Anthropic client factory + the two request helpers every handler uses.
 *
 * The factory is injectable so tests can hand in canned messages instead of hitting the network:
 *
 *   setAiClientFactory(() => ({ messages: { create: async () => cannedMessage } }));
 *   // ...
 *   setAiClientFactory(null); // back to the real SDK client
 */
import Anthropic from '@anthropic-ai/sdk';
import type { ZodType } from 'zod';
import type { AiStatus } from '../../shared/types';
import { aiDisabledError, mapUpstreamError, upstreamError } from './errors';
import { JsonParseError, parseJsonAs } from './json';

/** Minimal surface the handlers need — trivially satisfied by a stub in tests. */
export interface AiClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

export type AiClientFactory = () => AiClient;

export const DEFAULT_MODEL = 'claude-opus-5';
/** Per-request budget; a tailor pass with a long resume is the slowest call. */
const REQUEST_TIMEOUT_MS = 120_000;

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

function env(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveModel(): string {
  return env('ANTHROPIC_MODEL') || DEFAULT_MODEL;
}

export function isAiEnabled(): boolean {
  return env('ANTHROPIC_API_KEY') !== '';
}

/** Synchronous and cheap — safe to call from /api/health on every request. */
export function getAiStatus(): AiStatus {
  if (!isAiEnabled()) return { enabled: false, reason: 'ANTHROPIC_API_KEY not set' };
  return { enabled: true, model: resolveModel() };
}

/** Default factory: a real SDK client built from the environment. */
export function createAiClient(): AiClient {
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) throw aiDisabledError();
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: REQUEST_TIMEOUT_MS });
  return {
    messages: {
      create: (params) => client.messages.create(params),
    },
  };
}

let factory: AiClientFactory | null = null;
let cached: AiClient | null = null;

/** Overrides (or, with `null`, restores) the client used by every handler. */
export function setAiClientFactory(next: AiClientFactory | null): void {
  factory = next;
  cached = null;
}

export function getAiClient(): AiClient {
  if (!cached) cached = (factory ?? createAiClient)();
  return cached;
}

export function collectText(message: Anthropic.Message): string {
  if (message.stop_reason === 'refusal') {
    throw upstreamError('The AI provider declined to answer this request.');
  }
  const parts: string[] = [];
  for (const block of message.content ?? []) {
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
  }
  return parts.join('').trim();
}

export interface ModelRequest {
  system: string;
  user: string;
  maxTokens: number;
  effort: Effort;
  /** JSON schema for structured output; omit for prose answers. */
  jsonSchema?: Record<string, unknown>;
  client?: AiClient;
}

async function send(request: ModelRequest): Promise<Anthropic.Message> {
  const client = request.client ?? getAiClient();
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: resolveModel(),
    max_tokens: request.maxTokens,
    system: request.system,
    messages: [{ role: 'user', content: request.user }],
    output_config: request.jsonSchema
      ? { effort: request.effort, format: { type: 'json_schema', schema: request.jsonSchema } }
      : { effort: request.effort },
  };
  return client.messages.create(params);
}

/** Runs a prose request and returns the trimmed text. */
export async function requestText(request: Omit<ModelRequest, 'jsonSchema'>): Promise<string> {
  let message: Anthropic.Message;
  try {
    message = await send(request);
  } catch (err) {
    throw mapUpstreamError(err);
  }
  const text = collectText(message);
  if (text === '') throw upstreamError('The AI provider returned an empty response.');
  return text;
}

/** Runs a structured request and validates the JSON against `schema`. */
export async function requestJson<T>(
  request: ModelRequest & { jsonSchema: Record<string, unknown> },
  schema: ZodType<T>,
): Promise<T> {
  let message: Anthropic.Message;
  try {
    message = await send(request);
  } catch (err) {
    throw mapUpstreamError(err);
  }

  const text = collectText(message);
  try {
    return parseJsonAs(text, schema);
  } catch (err) {
    if (err instanceof JsonParseError) {
      throw upstreamError('The AI provider returned an unusable response. Try again.');
    }
    throw mapUpstreamError(err);
  }
}
