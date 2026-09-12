import type Anthropic from '@anthropic-ai/sdk';
import { APIError, RateLimitError } from '@anthropic-ai/sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AiError } from '../server/ai/errors';
import { setAiClientFactory, type AiClient } from '../server/ai/client';
import { ResumeInputSchema } from '../server/ai/schemas';
import { improveBullet } from '../server/ai/handlers/improve-bullet';
import { summary } from '../server/ai/handlers/summary';
import { tailor } from '../server/ai/handlers/tailor';
import { coverLetter } from '../server/ai/handlers/cover-letter';
import { normalizeMonth, parseResume } from '../server/ai/handlers/parse-resume';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cannedMessage(text: string, stopReason: Anthropic.Message['stop_reason'] = 'end_turn'): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [{ type: 'text', text, citations: null }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 12, output_tokens: 34 },
  } as unknown as Anthropic.Message;
}

interface StubClient extends AiClient {
  calls: Anthropic.MessageCreateParamsNonStreaming[];
}

function stub(reply: string | (() => never | Promise<Anthropic.Message>)): StubClient {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  return {
    calls,
    messages: {
      async create(params) {
        calls.push(params);
        if (typeof reply === 'string') return cannedMessage(reply);
        return reply();
      },
    },
  };
}

const resume = ResumeInputSchema.parse({
  contact: { fullName: 'Jordan Reyes', headline: 'Marketing Operations Manager', location: 'Texarkana, TX' },
  summary: 'Marketing ops lead focused on lead routing and dialer performance.',
  experience: [
    {
      id: 'exp-1',
      company: 'Northgate Resorts',
      title: 'Marketing Operations Manager',
      startDate: '2021-03',
      current: true,
      bullets: ['Rebuilt lead routing in HubSpot', 'Cut speed-to-lead from 14 minutes to 3'],
    },
    { id: 'exp-2', company: 'Bluewave', title: 'Campaign Analyst', startDate: '2018-01', endDate: '2021-02', bullets: ['Ran A/B tests'] },
  ],
  skillGroups: [{ id: 'sk-1', name: 'Tools', skills: ['HubSpot', 'Salesforce', 'Twilio'] }],
});

const jobText =
  'We are hiring a Marketing Operations Manager to own HubSpot workflows, lead routing, and dialer reporting for a 40-seat call center.';

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
});

afterEach(() => {
  setAiClientFactory(null);
});

describe('improveBullet', () => {
  it('returns trimmed, deduped suggestions and asks for structured JSON', async () => {
    const client = stub(
      '```json\n{"suggestions":["Rebuilt HubSpot lead routing, cutting speed-to-lead [X]%","- Rebuilt HubSpot lead routing, cutting speed-to-lead [X]%","Owned routing rules across 6 campaigns","  "]}\n```',
    );

    const result = await improveBullet(
      { bullet: 'Rebuilt lead routing in HubSpot', role: 'Marketing Ops Manager', tone: 'impact' },
      client,
    );

    expect(result.suggestions).toEqual([
      'Rebuilt HubSpot lead routing, cutting speed-to-lead [X]%',
      'Owned routing rules across 6 campaigns',
    ]);

    const params = client.calls[0]!;
    expect(params.model).toBe('claude-opus-5');
    expect(params.max_tokens).toBe(4000);
    expect(params.output_config?.effort).toBe('medium');
    expect(params.output_config?.format?.type).toBe('json_schema');
    expect(String(params.system)).toMatch(/Never invent experience/);
    expect(String(params.system)).toMatch(/30 words or fewer/);
    expect(params.messages[0]?.content).toContain('Rebuilt lead routing in HubSpot');
  });

  it('honours the ANTHROPIC_MODEL override', async () => {
    process.env.ANTHROPIC_MODEL = 'claude-opus-4-8';
    const client = stub('{"suggestions":["Led routing migration for 6 campaigns"]}');
    await improveBullet({ bullet: 'Did routing work' }, client);
    expect(client.calls[0]!.model).toBe('claude-opus-4-8');
    delete process.env.ANTHROPIC_MODEL;
  });

  it('maps a rate limit from the provider to a 429 AiError with a retry hint', async () => {
    const client = stub(() => {
      throw new RateLimitError(
        429,
        { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } },
        'Rate limited',
        new Headers({ 'retry-after': '42' }),
      );
    });

    const error = await improveBullet({ bullet: 'Did routing work' }, client).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiError);
    const aiError = error as AiError;
    expect(aiError.status).toBe(429);
    expect(aiError.code).toBe('rate_limited');
    expect(aiError.retryAfterSeconds).toBe(42);
    expect(aiError.details).toEqual({ source: 'upstream', retryAfterSeconds: 42 });
  });

  it('maps any other provider error to 502 ai_upstream without leaking details', async () => {
    const client = stub(() => {
      throw new APIError(
        500,
        { type: 'error', error: { type: 'api_error', message: 'boom' } },
        'Internal',
        new Headers(),
      );
    });

    const error = (await improveBullet({ bullet: 'Did routing work' }, client).catch((e: unknown) => e)) as AiError;
    expect(error).toBeInstanceOf(AiError);
    expect(error.status).toBe(502);
    expect(error.code).toBe('ai_upstream');
    expect(JSON.stringify(error.details)).not.toContain('test-key-not-real');
  });

  it('maps unparseable output to 502 ai_upstream', async () => {
    const client = stub('I am not going to answer that.');
    const error = (await improveBullet({ bullet: 'Did routing work' }, client).catch((e: unknown) => e)) as AiError;
    expect(error.status).toBe(502);
    expect(error.code).toBe('ai_upstream');
  });

  it('maps a refusal stop reason to 502 ai_upstream', async () => {
    const client = stub(async () => cannedMessage('', 'refusal'));
    const error = (await improveBullet({ bullet: 'Did routing work' }, client).catch((e: unknown) => e)) as AiError;
    expect(error.status).toBe(502);
    expect(error.code).toBe('ai_upstream');
  });
});

describe('summary', () => {
  it('returns a summary plus deduped alternatives', async () => {
    const client = stub(
      '{"summary":"Marketing operations manager who rebuilt   lead routing.","alternatives":["Ops lead for dialer reporting.","Ops lead for dialer reporting.",""]}',
    );

    const result = await summary({ resume, jobText }, client);
    expect(result.summary).toBe('Marketing operations manager who rebuilt lead routing.');
    expect(result.alternatives).toEqual(['Ops lead for dialer reporting.']);

    const user = String(client.calls[0]!.messages[0]?.content);
    expect(user).toContain('Northgate Resorts');
    expect(user).toContain('JOB POSTING');
  });
});

describe('tailor', () => {
  it('keeps only suggestions that point at real resume content', async () => {
    const client = stub(
      JSON.stringify({
        suggestions: [
          {
            type: 'bullet',
            experienceId: 'exp-1',
            bulletIndex: 1,
            original: 'Cut speed-to-lead from 14 minutes to 3',
            suggested: 'Cut speed-to-lead from 14 minutes to 3 across 40 call-center seats',
            reason: 'Mirrors the posting’s call-center scope.',
          },
          { type: 'bullet', experienceId: 'exp-does-not-exist', bulletIndex: 0, original: '', suggested: 'Invented work', reason: 'x' },
          { type: 'bullet', experienceId: 'exp-2', bulletIndex: 9, original: '', suggested: 'Out of range', reason: 'x' },
          { type: 'headline', experienceId: '', bulletIndex: -1, original: '', suggested: 'Marketing Operations Manager — Call Center', reason: 'Matches title.' },
          { type: 'skill', experienceId: '', bulletIndex: -1, original: '', suggested: '', reason: 'empty' },
        ],
        keywordsToAdd: ['HubSpot', 'hubspot', 'dialer reporting', ''],
        note: 'Resume  already covers   most requirements.',
      }),
    );

    const result = await tailor({ resume, jobText, jobTitle: 'Marketing Operations Manager', company: 'Acme' }, client);

    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions[0]).toMatchObject({ type: 'bullet', experienceId: 'exp-1', bulletIndex: 1 });
    expect(result.suggestions[1]).toMatchObject({ type: 'headline' });
    expect(result.suggestions[1]?.experienceId).toBeUndefined();
    expect(result.keywordsToAdd).toEqual(['HubSpot', 'dialer reporting']);
    expect(result.note).toBe('Resume already covers most requirements.');

    const params = client.calls[0]!;
    expect(params.max_tokens).toBe(8000);
    expect(params.output_config?.effort).toBe('high');
    expect(String(params.messages[0]?.content)).toContain('experienceId: exp-1');
    expect(String(params.messages[0]?.content)).toContain('bulletIndex 1:');
  });

  it('fails with 502 when nothing usable survives', async () => {
    const client = stub('{"suggestions":[{"type":"bullet","experienceId":"nope","bulletIndex":0,"original":"","suggested":"x","reason":"y"}],"keywordsToAdd":[],"note":""}');
    const error = (await tailor({ resume, jobText }, client).catch((e: unknown) => e)) as AiError;
    expect(error.status).toBe(502);
    expect(error.code).toBe('ai_upstream');
  });
});

describe('coverLetter', () => {
  it('returns tidy prose and signs it with the candidate name', async () => {
    const client = stub('Dear Hiring Team,\n\n\n\nI lead marketing operations.\n\nSincerely,');
    const result = await coverLetter({ resume, jobText, company: 'Acme' }, client);

    expect(result.letter).toContain('Dear Hiring Team,');
    expect(result.letter).not.toContain('\n\n\n');
    expect(result.letter.endsWith('Jordan Reyes')).toBe(true);

    const params = client.calls[0]!;
    expect(params.output_config?.format).toBeUndefined();
    expect(params.output_config?.effort).toBe('medium');
    expect(String(params.system)).toMatch(/3–4 short paragraphs/);
  });

  it('does not double-sign a letter that already ends with the name', async () => {
    const client = stub('Dear Hiring Team,\n\nI lead marketing operations.\n\nSincerely,\nJordan Reyes');
    const result = await coverLetter({ resume, jobText }, client);
    expect(result.letter.match(/Jordan Reyes/g)).toHaveLength(1);
  });
});

describe('parseResume', () => {
  it('normalizes dates, generates ids and never returns null arrays', async () => {
    const client = stub(
      JSON.stringify({
        contact: { fullName: '  Jordan Reyes ', email: 'jordan@example.com', headline: null },
        summary: 'Marketing   ops lead.',
        experience: [
          {
            company: 'Northgate Resorts',
            title: 'Marketing Operations Manager',
            startDate: 'March 2021',
            endDate: 'Present',
            current: false,
            bullets: ['• Rebuilt lead routing', '', null],
          },
          { company: 'Bluewave', title: 'Analyst', startDate: '2018', endDate: '02/2021', bullets: null },
        ],
        education: [{ school: 'UT', degree: 'BS', field: 'Marketing', startDate: '2014-08-15', endDate: '2018-05' }],
        skillGroups: [{ name: null, skills: ['HubSpot', ' Twilio '] }, { name: 'Empty', skills: [] }],
        projects: null,
        certifications: [{ name: 'HubSpot Marketing', issuer: 'HubSpot', date: 'Jan 2022', url: '' }],
        customSections: [{ title: 'Awards', items: [{ heading: 'President’s Club', subheading: '', date: '2022', bullets: [] }] }],
      }),
    );

    const { resume: parsed } = await parseResume({ text: 'x'.repeat(200) }, client);

    expect(parsed.contact.fullName).toBe('Jordan Reyes');
    expect(parsed.contact.headline).toBe('');
    expect(parsed.summary).toBe('Marketing ops lead.');

    expect(parsed.experience).toHaveLength(2);
    expect(parsed.experience[0]).toMatchObject({ startDate: '2021-03', endDate: '', current: true });
    expect(parsed.experience[0]?.bullets).toEqual(['Rebuilt lead routing']);
    expect(parsed.experience[1]).toMatchObject({ startDate: '2018-01', endDate: '2021-02', current: false });
    expect(parsed.experience[1]?.bullets).toEqual([]);
    for (const item of parsed.experience) expect(item.id).toMatch(UUID_RE);

    expect(parsed.education[0]).toMatchObject({ startDate: '2014-08', endDate: '2018-05' });
    expect(parsed.skillGroups).toHaveLength(1);
    expect(parsed.skillGroups[0]).toMatchObject({ name: 'Skills', skills: ['HubSpot', 'Twilio'] });
    expect(parsed.projects).toEqual([]);
    expect(parsed.certifications[0]?.date).toBe('2022-01');
    expect(parsed.customSections[0]?.items[0]?.date).toBe('2022-01');
    expect(parsed.customSections[0]?.id).toMatch(UUID_RE);

    const params = client.calls[0]!;
    expect(params.max_tokens).toBe(8000);
    expect(params.output_config?.effort).toBe('high');
    expect(String(params.system)).toMatch(/extractor, not an editor/);
  });
});

describe('normalizeMonth', () => {
  it.each([
    ['2021-03', '2021-03'],
    ['2021-3', '2021-03'],
    ['2021/03/15', '2021-03'],
    ['03/2021', '2021-03'],
    ['3-2021', '2021-03'],
    ['03/15/2021', '2021-03'],
    ['2021', '2021-01'],
    ['March 2021', '2021-03'],
    ['Sept. 2021', '2021-09'],
    ['Present', ''],
    ['', ''],
    ['sometime last year', ''],
    ['1492-01', ''],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeMonth(input)).toBe(expected);
  });
});
