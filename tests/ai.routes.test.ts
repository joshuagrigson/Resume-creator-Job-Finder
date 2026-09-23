import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type Anthropic from '@anthropic-ai/sdk';
import { RateLimitError } from '@anthropic-ai/sdk';
import express from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setAiClientFactory, type AiClient } from '../server/ai/client';
import { aiRateLimiter } from '../server/ai/ratelimit';
import { aiRouter } from '../server/routes/ai';

// The sandbox reserves 9000–9999 for builder-owned servers.
const PORT_CANDIDATES = [9611, 9612, 9613, 9614, 9615];

let server: http.Server;
let port = 0;

function cannedMessage(text: string): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [{ type: 'text', text, citations: null }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 5, output_tokens: 9 },
  } as unknown as Anthropic.Message;
}

function replyWith(text: string): AiClient {
  return { messages: { create: async () => cannedMessage(text) } };
}

function failWith(error: () => never): AiClient {
  return { messages: { create: async () => error() } };
}

interface Response<T> {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: T;
}

function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response<T>> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body), 'utf8');
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          ...(payload ? { 'content-type': 'application/json', 'content-length': String(payload.byteLength) } : {}),
          ...extraHeaders,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed: unknown = raw;
          try {
            parsed = raw === '' ? null : (JSON.parse(raw) as unknown);
          } catch {
            /* keep the raw string */
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: parsed as T });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function listen(app: express.Express): Promise<http.Server> {
  let lastError: unknown;
  for (const candidate of PORT_CANDIDATES) {
    try {
      return await new Promise<http.Server>((resolve, reject) => {
        const s = app.listen(candidate);
        s.once('listening', () => {
          port = (s.address() as AddressInfo).port;
          resolve(s);
        });
        s.once('error', reject);
      });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No free port in 9611–9615');
}

const resume = {
  contact: { fullName: 'Jordan Reyes', headline: 'Marketing Operations Manager' },
  summary: 'Marketing ops lead.',
  experience: [{ id: 'exp-1', company: 'Northgate', title: 'Manager', bullets: ['Rebuilt lead routing'] }],
};

const jobText =
  'Marketing Operations Manager wanted to own HubSpot workflows, lead routing and dialer reporting for a 40-seat call center.';

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/ai', aiRouter);
  server = await listen(app);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
  aiRateLimiter.reset();
});

afterEach(() => {
  setAiClientFactory(null);
});

describe('GET /api/ai/status', () => {
  it('reports the model when a key is configured', async () => {
    const res = await request<{ enabled: boolean; model?: string }>('GET', '/api/ai/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: true, model: 'claude-opus-5' });
  });

  it('reports why it is disabled without a key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await request<{ enabled: boolean; reason?: string }>('GET', '/api/ai/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false, reason: 'ANTHROPIC_API_KEY not set' });
  });
});

describe('disabled mode', () => {
  it('answers 503 ai_disabled on every POST', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    for (const path of ['/improve-bullet', '/summary', '/tailor', '/cover-letter', '/parse-resume', '/polish']) {
      const res = await request<{ code?: string }>('POST', `/api/ai${path}`, {});
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('ai_disabled');
    }
  });
});

describe('validation', () => {
  beforeEach(() => setAiClientFactory(() => replyWith('{"suggestions":["Rebuilt routing"]}')));

  it('rejects a missing bullet with 400 bad_request and details', async () => {
    const res = await request<{ code?: string; details?: { path: string[]; message: string }[] }>(
      'POST',
      '/api/ai/improve-bullet',
      {},
    );
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('bad_request');
    expect(res.body.details?.[0]?.path).toEqual(['bullet']);
  });

  it('rejects a bullet over the 1 KB cap', async () => {
    const res = await request<{ code?: string; details?: { path: string[] }[] }>('POST', '/api/ai/improve-bullet', {
      bullet: 'x'.repeat(1100),
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('bad_request');
    expect(res.body.details?.[0]?.path).toEqual(['bullet']);
  });

  it('rejects a job description over the 20 KB cap', async () => {
    const res = await request<{ code?: string; details?: { path: string[] }[] }>('POST', '/api/ai/tailor', {
      resume,
      jobText: 'x'.repeat(21 * 1024),
    });
    expect(res.status).toBe(400);
    expect(res.body.details?.[0]?.path).toEqual(['jobText']);
  });

  it('rejects a resume over the 200 KB cap', async () => {
    const fat = { ...resume, summary: 'y'.repeat(201 * 1024) };
    const res = await request<{ code?: string; details?: { path: string[] }[] }>('POST', '/api/ai/summary', {
      resume: fat,
    });
    expect(res.status).toBe(400);
    expect(res.body.details?.[0]?.path).toEqual(['resume']);
  });

  it('rejects resume text over the 40 KB cap', async () => {
    const res = await request<{ details?: { path: string[] }[] }>('POST', '/api/ai/parse-resume', {
      text: 'z'.repeat(41 * 1024),
    });
    expect(res.status).toBe(400);
    expect(res.body.details?.[0]?.path).toEqual(['text']);
  });
});

describe('rate limit key on Cloudflare', () => {
  afterEach(() => {
    delete process.env.LAUNCHPAD_RUNTIME;
  });

  it('keys each visitor by CF-Connecting-IP, not the shared edge connection', async () => {
    process.env.LAUNCHPAD_RUNTIME = 'cloudflare';
    setAiClientFactory(() => replyWith('{"suggestions":["Rebuilt routing"]}'));
    const body = { bullet: 'Rebuilt lead routing in HubSpot' };
    const a1 = await request('POST', '/api/ai/improve-bullet', body, { 'cf-connecting-ip': '203.0.113.1' });
    const a2 = await request('POST', '/api/ai/improve-bullet', body, { 'cf-connecting-ip': '203.0.113.1' });
    const b1 = await request('POST', '/api/ai/improve-bullet', body, { 'cf-connecting-ip': '203.0.113.2' });
    expect(a1.headers['x-ratelimit-remaining']).toBe('29');
    expect(a2.headers['x-ratelimit-remaining']).toBe('28');
    expect(b1.headers['x-ratelimit-remaining']).toBe('29');
  });

  it('ignores the header off Cloudflare, where anyone could send it', async () => {
    setAiClientFactory(() => replyWith('{"suggestions":["Rebuilt routing"]}'));
    const body = { bullet: 'Rebuilt lead routing in HubSpot' };
    await request('POST', '/api/ai/improve-bullet', body, { 'cf-connecting-ip': '203.0.113.1' });
    const second = await request('POST', '/api/ai/improve-bullet', body, { 'cf-connecting-ip': '203.0.113.9' });
    expect(second.headers['x-ratelimit-remaining']).toBe('28');
  });
});

describe('successful responses', () => {
  it('improve-bullet returns AiImproveBulletResponse', async () => {
    setAiClientFactory(() => replyWith('{"suggestions":["Rebuilt HubSpot routing, cutting speed-to-lead [X]%"]}'));
    const res = await request<{ suggestions: string[] }>('POST', '/api/ai/improve-bullet', {
      bullet: 'Rebuilt lead routing in HubSpot',
    });
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual(['Rebuilt HubSpot routing, cutting speed-to-lead [X]%']);
    expect(res.headers['x-ratelimit-limit']).toBe('30');
  });

  it('summary returns AiSummaryResponse', async () => {
    setAiClientFactory(() => replyWith('{"summary":"Ops lead.","alternatives":["Ops manager."]}'));
    const res = await request<{ summary: string; alternatives: string[] }>('POST', '/api/ai/summary', { resume });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ summary: 'Ops lead.', alternatives: ['Ops manager.'] });
  });

  it('tailor returns AiTailorResponse with resume-anchored suggestions', async () => {
    setAiClientFactory(() =>
      replyWith(
        JSON.stringify({
          suggestions: [
            { type: 'bullet', experienceId: 'exp-1', bulletIndex: 0, original: 'Rebuilt lead routing', suggested: 'Rebuilt lead routing for a 40-seat call center', reason: 'Matches scope.' },
          ],
          keywordsToAdd: ['dialer reporting'],
          note: 'Close match.',
        }),
      ),
    );
    const res = await request<{ suggestions: { experienceId?: string; bulletIndex?: number }[]; keywordsToAdd: string[] }>(
      'POST',
      '/api/ai/tailor',
      { resume, jobText },
    );
    expect(res.status).toBe(200);
    expect(res.body.suggestions[0]).toMatchObject({ experienceId: 'exp-1', bulletIndex: 0 });
    expect(res.body.keywordsToAdd).toEqual(['dialer reporting']);
  });

  it('cover-letter returns AiCoverLetterResponse', async () => {
    setAiClientFactory(() => replyWith('Dear Hiring Team,\n\nI run marketing operations.\n\nSincerely,\nJordan Reyes'));
    const res = await request<{ letter: string }>('POST', '/api/ai/cover-letter', { resume, jobText, company: 'Acme' });
    expect(res.status).toBe(200);
    expect(res.body.letter.endsWith('Jordan Reyes')).toBe(true);
  });

  it('parse-resume returns AiParseResumeResponse with server-generated ids', async () => {
    setAiClientFactory(() =>
      replyWith(
        '```json\n{"contact":{"fullName":"Jordan Reyes"},"summary":"Ops lead.","experience":[{"company":"Northgate","title":"Manager","startDate":"March 2021","endDate":"Present","bullets":["Rebuilt routing"]}],}\n```',
      ),
    );
    const res = await request<{ resume: { experience: { id: string; startDate: string }[]; projects: unknown[] } }>(
      'POST',
      '/api/ai/parse-resume',
      { text: 'Jordan Reyes\nMarketing Operations Manager\nNorthgate Resorts, March 2021 – Present' },
    );
    expect(res.status).toBe(200);
    expect(res.body.resume.experience[0]?.startDate).toBe('2021-03');
    expect(res.body.resume.experience[0]?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(res.body.resume.projects).toEqual([]);
  });
});

describe('error mapping', () => {
  it('passes an upstream 429 through with a Retry-After header', async () => {
    setAiClientFactory(() =>
      failWith(() => {
        throw new RateLimitError(
          429,
          { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } },
          'Rate limited',
          new Headers({ 'retry-after': '17' }),
        );
      }),
    );
    const res = await request<{ code?: string; details?: { source?: string } }>('POST', '/api/ai/improve-bullet', {
      bullet: 'Rebuilt lead routing in HubSpot',
    });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('rate_limited');
    expect(res.body.details?.source).toBe('upstream');
    expect(res.headers['retry-after']).toBe('17');
  });

  it('maps a transport failure to 502 ai_upstream', async () => {
    setAiClientFactory(() =>
      failWith(() => {
        throw new Error('socket hang up');
      }),
    );
    const res = await request<{ code?: string; error?: string }>('POST', '/api/ai/summary', { resume });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('ai_upstream');
    expect(res.body.error).not.toContain('socket hang up');
  });
});

describe('per-IP rate limit', () => {
  it('answers 429 rate_limited after 30 requests in the window', async () => {
    setAiClientFactory(() => replyWith('{"suggestions":["Rebuilt routing"]}'));

    for (let i = 0; i < 30; i += 1) {
      // Deliberately invalid bodies: the limiter runs before validation, so these still count.
      const res = await request<{ code?: string }>('POST', '/api/ai/improve-bullet', {});
      expect(res.status).toBe(400);
    }

    const blocked = await request<{ code?: string; details?: { source?: string } }>('POST', '/api/ai/improve-bullet', {
      bullet: 'Rebuilt lead routing in HubSpot',
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('rate_limited');
    expect(blocked.body.details?.source).toBe('local');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});

describe('unknown routes', () => {
  it('answers 404 with the shared error shape', async () => {
    const res = await request<{ code?: string }>('POST', '/api/ai/nope', {});
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('not_found');
  });
});
