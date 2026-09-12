import { describe, expect, it } from 'vitest';
import { dedupeJobs, dedupeKey, normalizeKeyPart } from '../server/jobs/dedupe';
import { makeJob } from './jobs.helpers';

describe('normalizeKeyPart', () => {
  it('ignores case, punctuation, accents and legal suffixes', () => {
    expect(normalizeKeyPart('Acme, Inc.')).toBe(normalizeKeyPart('ACME'));
    expect(normalizeKeyPart('Café GmbH')).toBe(normalizeKeyPart('cafe'));
    expect(normalizeKeyPart('Senior  Engineer')).toBe('senior engineer');
  });

  it('ignores German gender decorations in titles', () => {
    expect(normalizeKeyPart('Steuerberater (m/w/d)')).toBe(normalizeKeyPart('Steuerberater'));
  });

  it('keeps technology punctuation that carries meaning', () => {
    expect(normalizeKeyPart('C++ Developer')).toBe('c++ developer');
    expect(normalizeKeyPart('Node.js Engineer')).toBe('node.js engineer');
  });
});

describe('dedupeJobs', () => {
  it('keeps the newest posting for the same title + company', () => {
    const older = makeJob({
      source: 'remotive',
      sourceId: 'a',
      postedAt: '2026-09-01T00:00:00.000Z',
      descriptionText: 'Old copy',
    });
    const newer = makeJob({
      source: 'jobicy',
      sourceId: 'b',
      postedAt: '2026-09-09T00:00:00.000Z',
      descriptionText: 'New copy',
    });

    const result = dedupeJobs([older, newer]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('jobicy:b');
  });

  it('prefers the longer description when the timestamps tie', () => {
    const short = makeJob({ source: 'remotive', sourceId: 'a', descriptionText: 'Short' });
    const long = makeJob({ source: 'jobicy', sourceId: 'b', descriptionText: 'A much longer description here.' });

    expect(dedupeJobs([short, long])[0]?.id).toBe('jobicy:b');
    expect(dedupeJobs([long, short])[0]?.id).toBe('jobicy:b');
  });

  it('merges tags from both copies', () => {
    const a = makeJob({ source: 'remotive', sourceId: 'a', tags: ['react', 'remote'] });
    const b = makeJob({
      source: 'jobicy',
      sourceId: 'b',
      tags: ['typescript', 'react'],
      postedAt: '2026-09-09T00:00:00.000Z',
    });

    const merged = dedupeJobs([a, b])[0];
    expect(merged?.tags).toEqual(['typescript', 'react', 'remote']);
  });

  it('backfills fields the winner is missing', () => {
    const rich = makeJob({
      source: 'remotive',
      sourceId: 'a',
      companyLogo: 'https://cdn.test/logo.png',
      employmentType: 'full_time',
      category: 'Engineering',
      salary: { min: 100000, currency: 'USD', period: 'year' },
      descriptionText: 'A longer, richer description of the role.',
      descriptionHtml: '<p>A longer, richer description of the role.</p>',
    });
    const sparse = makeJob({
      source: 'jobicy',
      sourceId: 'b',
      postedAt: '2026-09-09T00:00:00.000Z',
      descriptionText: 'Short',
      descriptionHtml: '<p>Short</p>',
    });

    const merged = dedupeJobs([rich, sparse])[0];
    expect(merged?.id).toBe('jobicy:b');
    expect(merged?.companyLogo).toBe('https://cdn.test/logo.png');
    expect(merged?.employmentType).toBe('full_time');
    expect(merged?.category).toBe('Engineering');
    expect(merged?.salary).toEqual({ min: 100000, currency: 'USD', period: 'year' });
    expect(merged?.descriptionText).toBe('A longer, richer description of the role.');
  });

  it('leaves genuinely different postings alone and preserves first-seen order', () => {
    const jobs = [
      makeJob({ source: 'remotive', sourceId: '1', title: 'Frontend Engineer' }),
      makeJob({ source: 'remotive', sourceId: '2', title: 'Backend Engineer' }),
      makeJob({ source: 'remotive', sourceId: '3', title: 'Frontend Engineer', company: 'Globex' }),
    ];
    expect(dedupeJobs(jobs).map((job) => job.id)).toEqual(['remotive:1', 'remotive:2', 'remotive:3']);
  });

  it('handles an empty list', () => {
    expect(dedupeJobs([])).toEqual([]);
  });

  it('exposes the key it groups by', () => {
    expect(dedupeKey({ title: 'Frontend Engineer', company: 'Acme Inc.' })).toBe('frontend engineer|acme');
  });
});
