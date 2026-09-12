import { describe, expect, it } from 'vitest';
import {
  buildJob,
  detectRemote,
  employmentTypeFromTags,
  mapEmploymentType,
  normalizeAll,
  normalizeSalary,
  normalizeTags,
  parseSalaryText,
  pickArray,
  toIsoDate,
} from '../server/jobs/normalize';
import { FETCHED_AT } from './jobs.helpers';

describe('toIsoDate', () => {
  it('accepts epoch seconds and epoch milliseconds', () => {
    expect(toIsoDate(1789084835, FETCHED_AT)).toBe('2026-09-11T00:00:35.000Z');
    expect(toIsoDate(1789084835000, FETCHED_AT)).toBe('2026-09-11T00:00:35.000Z');
    expect(toIsoDate('1789084835', FETCHED_AT)).toBe('2026-09-11T00:00:35.000Z');
  });

  it('treats a zone-less timestamp as UTC', () => {
    expect(toIsoDate('2026-09-08T21:47:54', FETCHED_AT)).toBe('2026-09-08T21:47:54.000Z');
  });

  it('accepts date-only and offset timestamps', () => {
    expect(toIsoDate('2026-09-04', FETCHED_AT)).toBe('2026-09-04T00:00:00.000Z');
    expect(toIsoDate('2026-09-11T00:00:35+00:00', FETCHED_AT)).toBe('2026-09-11T00:00:35.000Z');
  });

  it('falls back for junk, absurd, and missing values', () => {
    expect(toIsoDate('not a date', FETCHED_AT)).toBe(FETCHED_AT);
    expect(toIsoDate(undefined, FETCHED_AT)).toBe(FETCHED_AT);
    expect(toIsoDate(0, FETCHED_AT)).toBe(FETCHED_AT);
    expect(toIsoDate('1200-01-01', FETCHED_AT)).toBe(FETCHED_AT);
    expect(toIsoDate({ nope: true }, FETCHED_AT)).toBe(FETCHED_AT);
  });
});

describe('normalizeTags', () => {
  it('lowercases, trims, de-duplicates and caps', () => {
    expect(normalizeTags(['React', ' react ', 'TypeScript', 'react'])).toEqual(['react', 'typescript']);
    expect(normalizeTags('React, Node.js; AWS')).toEqual(['react', 'node.js', 'aws']);
    expect(normalizeTags([{ name: 'Sales' }, { name: 'CRM' }])).toEqual(['sales', 'crm']);
    expect(normalizeTags(Array.from({ length: 60 }, (_, i) => `t${i}`))).toHaveLength(25);
  });

  it('is total for junk input', () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(42)).toEqual([]);
    expect(normalizeTags([null, {}, 7])).toEqual(['7']);
  });
});

describe('detectRemote', () => {
  it('detects remote from location text, tags and explicit flags', () => {
    expect(detectRemote('Remote — US', [])).toBe(true);
    expect(detectRemote('Worldwide', [])).toBe(true);
    expect(detectRemote('Austin, TX', ['remote'])).toBe(true);
    expect(detectRemote('Austin, TX', [], true)).toBe(true);
    expect(detectRemote('Austin, TX', ['react'])).toBe(false);
    expect(detectRemote('', [])).toBe(false);
  });
});

describe('employment type mapping', () => {
  it('maps dedicated fields, defaulting unknown values to "other"', () => {
    expect(mapEmploymentType('full_time')).toBe('full_time');
    expect(mapEmploymentType('Part-time')).toBe('part_time');
    expect(mapEmploymentType(['Contract'])).toBe('contract');
    expect(mapEmploymentType('Internship')).toBe('internship');
    expect(mapEmploymentType('Seasonal')).toBe('temporary');
    expect(mapEmploymentType('Festanstellung')).toBe('full_time');
    expect(mapEmploymentType('Wizard')).toBe('other');
    expect(mapEmploymentType(undefined)).toBeUndefined();
  });

  it('does not invent a type from unrelated tags', () => {
    expect(employmentTypeFromTags(['exec', 'design', 'senior manager'])).toBeUndefined();
    expect(employmentTypeFromTags(['Full Time', 'Entry'])).toBe('full_time');
    expect(employmentTypeFromTags([])).toBeUndefined();
  });
});

describe('salary normalization', () => {
  it('drops zeros and keeps positive ranges', () => {
    expect(normalizeSalary({ min: 0, max: 0 })).toBeUndefined();
    expect(normalizeSalary({ min: 155000, max: 195000, currency: 'usd', period: 'annual' })).toEqual({
      min: 155000,
      max: 195000,
      currency: 'USD',
      period: 'year',
    });
  });

  it('swaps an inverted range', () => {
    expect(normalizeSalary({ min: 90000, max: 60000 })).toMatchObject({ min: 60000, max: 90000 });
  });

  it('infers the period from the magnitude when the source does not say', () => {
    expect(normalizeSalary({ min: 120000 })?.period).toBe('year');
    expect(normalizeSalary({ min: 6500 })?.period).toBe('year');
    expect(normalizeSalary({ min: 45 })?.period).toBe('hour');
  });

  it('parses numbers out of a display string', () => {
    expect(normalizeSalary({ display: 'OTE $25k - $35k' })).toEqual({
      min: 25000,
      max: 35000,
      currency: 'USD',
      period: 'year',
      display: 'OTE $25k - $35k',
    });
    expect(parseSalaryText('€60.000 – €80.000 per year')).toMatchObject({
      min: 60000,
      max: 80000,
      currency: 'EUR',
      period: 'year',
    });
    expect(parseSalaryText('$45 per hour')).toMatchObject({ min: 45, currency: 'USD', period: 'hour' });
  });

  it('keeps an unparseable display string rather than dropping the salary', () => {
    expect(normalizeSalary({ display: 'Competitive' })).toEqual({ display: 'Competitive' });
  });
});

describe('buildJob', () => {
  const base = {
    source: 'remotive' as const,
    sourceId: '123',
    title: '  Senior React Engineer  ',
    company: 'Acme Inc',
    url: 'https://example.com/jobs/123',
    fetchedAt: FETCHED_AT,
  };

  it('produces a well-formed Job', () => {
    const job = buildJob({
      ...base,
      location: 'Remote — US',
      tags: ['React', 'TypeScript', 'react'],
      descriptionHtml: '<p>Ship <b>features</b>.</p><script>bad()</script>',
      postedAt: '2026-09-08T21:47:54',
      category: 'Software Development',
      employmentType: 'full_time',
      salary: { min: 150000, max: 180000, currency: 'USD', period: 'year' },
      companyLogo: 'https://cdn.example.com/logo.png',
    });

    expect(job).not.toBeNull();
    expect(job?.id).toBe('remotive:123');
    expect(job?.title).toBe('Senior React Engineer');
    expect(job?.remote).toBe(true);
    expect(job?.tags).toEqual(['react', 'typescript']);
    expect(job?.descriptionHtml).not.toContain('script');
    expect(job?.descriptionText).toBe('Ship features.');
    expect(job?.postedAt).toBe('2026-09-08T21:47:54.000Z');
    expect(job?.employmentType).toBe('full_time');
    expect(job?.salary).toEqual({ min: 150000, max: 180000, currency: 'USD', period: 'year' });
  });

  it('returns null when a required field is missing or the url is unusable', () => {
    expect(buildJob({ ...base, title: '' })).toBeNull();
    expect(buildJob({ ...base, company: null })).toBeNull();
    expect(buildJob({ ...base, url: 'javascript:alert(1)' })).toBeNull();
    expect(buildJob({ ...base, url: '/relative/path' })).toBeNull();
    expect(buildJob({ ...base, sourceId: '' })).toBeNull();
  });

  it('falls back to fetchedAt when the posted date is unusable', () => {
    expect(buildJob({ ...base, postedAt: 'yesterday' })?.postedAt).toBe(FETCHED_AT);
  });

  it('uses plain text when the source has no HTML description', () => {
    const job = buildJob({ ...base, descriptionText: 'Plain summary only.' });
    expect(job?.descriptionHtml).toBe('');
    expect(job?.descriptionText).toBe('Plain summary only.');
  });
});

describe('normalizeAll / pickArray', () => {
  it('skips items that throw or duplicate an id', () => {
    const jobs = normalizeAll([1, 2, 2, 3], (n) => {
      if (n === 3) throw new Error('boom');
      return buildJob({
        source: 'jobicy',
        sourceId: String(n),
        title: `Job ${n}`,
        company: 'Acme',
        url: `https://example.com/${n}`,
        fetchedAt: FETCHED_AT,
      });
    });
    expect(jobs.map((job) => job.id)).toEqual(['jobicy:1', 'jobicy:2']);
  });

  it('finds the item array in any envelope shape', () => {
    expect(pickArray({ jobs: [{ a: 1 }] }, 'jobs', 'data')).toEqual([{ a: 1 }]);
    expect(pickArray({ data: [{ a: 1 }] }, 'jobs', 'data')).toEqual([{ a: 1 }]);
    expect(pickArray([{ a: 1 }], 'jobs')).toEqual([{ a: 1 }]);
    expect(pickArray(null, 'jobs')).toEqual([]);
    expect(pickArray({ jobs: 'nope' }, 'jobs')).toEqual([]);
  });
});
