import { describe, expect, it } from 'vitest';
import { paginate, rankJobs, scoreRelevance } from '../server/jobs/rank';
import { parseQueryTerms } from '../server/jobs/filter';
import { makeJob } from './jobs.helpers';

describe('scoreRelevance', () => {
  it('weights title over tags over company over description', () => {
    const inTitle = makeJob({ title: 'React Engineer', tags: [], descriptionText: '' });
    const inTags = makeJob({ title: 'Engineer', tags: ['react'], descriptionText: '' });
    const inCompany = makeJob({ title: 'Engineer', company: 'React Labs', tags: [], descriptionText: '' });
    const inDescription = makeJob({ title: 'Engineer', tags: [], descriptionText: 'We use react daily.' });

    expect(scoreRelevance(inTitle, ['react'])).toBe(5);
    expect(scoreRelevance(inTags, ['react'])).toBe(3);
    expect(scoreRelevance(inCompany, ['react'])).toBe(2);
    expect(scoreRelevance(inDescription, ['react'])).toBe(1);
  });

  it('adds up across fields and terms', () => {
    const job = makeJob({
      title: 'Senior React Engineer',
      company: 'Acme',
      tags: ['react', 'typescript'],
      descriptionText: 'React and TypeScript every day.',
    });
    // react: 5 + 3 + 1 = 9, typescript: 3 + 1 = 4
    expect(scoreRelevance(job, parseQueryTerms('react typescript'))).toBe(13);
  });

  it('scores zero for an empty query', () => {
    expect(scoreRelevance(makeJob(), [])).toBe(0);
  });
});

describe('rankJobs', () => {
  const a = makeJob({ sourceId: 'a', title: 'React Engineer', postedAt: '2026-09-01T00:00:00.000Z', tags: [] });
  const b = makeJob({
    sourceId: 'b',
    title: 'Engineer',
    tags: ['react'],
    postedAt: '2026-09-05T00:00:00.000Z',
  });
  const c = makeJob({
    sourceId: 'c',
    title: 'Engineer',
    tags: [],
    descriptionText: 'react',
    postedAt: '2026-09-09T00:00:00.000Z',
  });

  it('sorts by relevance first', () => {
    expect(rankJobs([c, b, a], ['react'], 'relevance').map((job) => job.sourceId)).toEqual(['a', 'b', 'c']);
  });

  it('breaks relevance ties by recency', () => {
    const older = makeJob({ sourceId: 'old', title: 'React Engineer', postedAt: '2026-08-01T00:00:00.000Z' });
    const newer = makeJob({ sourceId: 'new', title: 'React Engineer', postedAt: '2026-09-10T00:00:00.000Z' });
    expect(rankJobs([older, newer], ['react']).map((job) => job.sourceId)).toEqual(['new', 'old']);
  });

  it('sorts purely by date when asked', () => {
    expect(rankJobs([a, b, c], ['react'], 'date').map((job) => job.sourceId)).toEqual(['c', 'b', 'a']);
  });

  it('is deterministic for identical scores and timestamps', () => {
    const one = makeJob({ source: 'jobicy', sourceId: '1' });
    const two = makeJob({ source: 'remotive', sourceId: '2' });
    expect(rankJobs([two, one], []).map((job) => job.id)).toEqual(rankJobs([one, two], []).map((job) => job.id));
  });

  it('does not mutate its input', () => {
    const input = [c, b, a];
    const copy = [...input];
    rankJobs(input, ['react']);
    expect(input).toEqual(copy);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 57 }, (_, i) => i);

  it('slices after ranking and reports the full total', () => {
    const page = paginate(items, 2, 25);
    expect(page.items).toHaveLength(25);
    expect(page.items[0]).toBe(25);
    expect(page.total).toBe(57);
    expect(page.page).toBe(2);
  });

  it('returns an empty page past the end without lying about the total', () => {
    const page = paginate(items, 99, 25);
    expect(page.items).toEqual([]);
    expect(page.total).toBe(57);
  });

  it('clamps nonsense page sizes into range', () => {
    expect(paginate(items, 1, 5000).pageSize).toBe(100);
    expect(paginate(items, 0, 0).page).toBe(1);
    expect(paginate(items, -3, -1).pageSize).toBe(25);
  });
});
