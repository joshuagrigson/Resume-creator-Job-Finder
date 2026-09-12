import { describe, expect, it } from 'vitest';
import { filterJobs, matchesLocation, matchesTerms, parseQueryTerms } from '../server/jobs/filter';
import { makeJob, NOW } from './jobs.helpers';

describe('parseQueryTerms', () => {
  it('splits on whitespace and keeps quoted phrases together', () => {
    expect(parseQueryTerms('senior "product manager" saas')).toEqual(['senior', 'product manager', 'saas']);
    expect(parseQueryTerms("'customer success' lead")).toEqual(['customer success', 'lead']);
  });

  it('lowercases, de-duplicates and drops trailing punctuation', () => {
    expect(parseQueryTerms('React, react REACT!')).toEqual(['react']);
  });

  it('keeps technology tokens intact', () => {
    expect(parseQueryTerms('c++ c# .net node.js')).toEqual(['c++', 'c#', '.net', 'node.js']);
  });

  it('returns nothing for an empty query', () => {
    expect(parseQueryTerms('')).toEqual([]);
    expect(parseQueryTerms(undefined)).toEqual([]);
    expect(parseQueryTerms('   ')).toEqual([]);
  });
});

describe('matchesTerms', () => {
  const job = makeJob({
    title: 'Senior Product Manager',
    company: 'Northwind',
    tags: ['saas', 'b2b'],
    descriptionText: 'Own the roadmap for our analytics platform.',
  });

  it('requires every term, matched across title, company, tags and description', () => {
    expect(matchesTerms(job, ['senior', 'saas', 'roadmap', 'northwind'])).toBe(true);
    expect(matchesTerms(job, ['senior', 'kubernetes'])).toBe(false);
  });

  it('honours quoted phrases as a unit', () => {
    expect(matchesTerms(job, parseQueryTerms('"product manager"'))).toBe(true);
    expect(matchesTerms(job, parseQueryTerms('"manager product"'))).toBe(false);
  });

  it('is case-insensitive and matches everything on an empty query', () => {
    expect(matchesTerms(job, ['SENIOR'.toLowerCase()])).toBe(true);
    expect(matchesTerms(job, [])).toBe(true);
  });
});

describe('matchesLocation', () => {
  const austin = makeJob({ location: 'Austin, TX', remote: false });
  const remoteUs = makeJob({ location: 'Remote — United States', remote: true });
  const worldwide = makeJob({ location: 'Worldwide', remote: true });

  it('matches everything when empty', () => {
    expect(matchesLocation(austin, '')).toBe(true);
    expect(matchesLocation(austin, undefined)).toBe(true);
  });

  it('does a case-insensitive substring match on the job location', () => {
    expect(matchesLocation(austin, 'austin')).toBe(true);
    expect(matchesLocation(austin, 'TX')).toBe(true);
    expect(matchesLocation(austin, 'Berlin')).toBe(false);
  });

  it('treats "remote" as a request for remote roles', () => {
    expect(matchesLocation(remoteUs, 'remote')).toBe(true);
    expect(matchesLocation(worldwide, 'remote')).toBe(true);
    expect(matchesLocation(austin, 'remote')).toBe(false);
  });

  it('narrows "remote <where>" to matching or worldwide remote roles', () => {
    expect(matchesLocation(remoteUs, 'remote united states')).toBe(true);
    expect(matchesLocation(worldwide, 'remote united states')).toBe(true);
    expect(matchesLocation(makeJob({ location: 'Remote — EU', remote: true }), 'remote united states')).toBe(false);
  });

  it('ORs comma-separated parts', () => {
    expect(matchesLocation(austin, 'berlin, austin')).toBe(true);
    expect(matchesLocation(remoteUs, 'berlin, remote')).toBe(true);
    expect(matchesLocation(austin, 'berlin, london')).toBe(false);
  });
});

describe('filterJobs', () => {
  const jobs = [
    makeJob({
      sourceId: '1',
      title: 'React Engineer',
      remote: true,
      employmentType: 'full_time',
      postedAt: '2026-09-10T00:00:00.000Z',
    }),
    makeJob({
      sourceId: '2',
      title: 'React Engineer',
      company: 'Globex',
      location: 'Austin, TX',
      remote: false,
      employmentType: 'contract',
      postedAt: '2026-09-09T00:00:00.000Z',
    }),
    makeJob({
      sourceId: '3',
      title: 'Data Analyst',
      company: 'Initech',
      remote: true,
      employmentType: 'full_time',
      postedAt: '2026-01-01T00:00:00.000Z',
      tags: ['sql'],
      descriptionText: 'Dashboards and reporting.',
    }),
  ];

  it('applies remoteOnly', () => {
    const result = filterJobs(jobs, { q: '', remoteOnly: true }, { now: NOW });
    expect(result.map((job) => job.sourceId)).toEqual(['1', '3']);
  });

  it('applies employmentType', () => {
    const result = filterJobs(jobs, { q: '', employmentType: 'contract' }, { now: NOW });
    expect(result.map((job) => job.sourceId)).toEqual(['2']);
  });

  it('applies postedWithinDays', () => {
    const result = filterJobs(jobs, { q: '', postedWithinDays: 7 }, { now: NOW });
    expect(result.map((job) => job.sourceId)).toEqual(['1', '2']);
  });

  it('applies keywords and location together', () => {
    const result = filterJobs(jobs, { q: 'react', location: 'austin' }, { now: NOW });
    expect(result.map((job) => job.sourceId)).toEqual(['2']);
  });

  it('returns everything for an unconstrained query', () => {
    expect(filterJobs(jobs, { q: '' }, { now: NOW })).toHaveLength(3);
  });

  it('returns nothing when a required term is absent', () => {
    expect(filterJobs(jobs, { q: 'react kubernetes' }, { now: NOW })).toHaveLength(0);
  });
});
