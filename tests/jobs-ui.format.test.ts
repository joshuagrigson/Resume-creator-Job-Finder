import { describe, expect, it } from 'vitest';
import {
  abbreviateAmount,
  companyInitial,
  describeQuery,
  formatDuration,
  formatSalary,
  locationLabel,
  pageCount,
  rangeLabel,
  relativeTime,
  sourceLabel,
  sourceStatusMeta,
} from '@/components/jobs/format';

const NOW = Date.parse('2026-03-10T12:00:00.000Z');

describe('relativeTime', () => {
  it('formats minutes, hours, days, months and years', () => {
    expect(relativeTime('2026-03-10T11:59:40.000Z', NOW)).toBe('just now');
    expect(relativeTime('2026-03-10T11:30:00.000Z', NOW)).toBe('30m ago');
    expect(relativeTime('2026-03-10T04:00:00.000Z', NOW)).toBe('8h ago');
    expect(relativeTime('2026-03-07T12:00:00.000Z', NOW)).toBe('3d ago');
    expect(relativeTime('2025-12-10T12:00:00.000Z', NOW)).toBe('3mo ago');
    expect(relativeTime('2023-03-10T12:00:00.000Z', NOW)).toBe('3y ago');
  });

  it('never throws on junk input', () => {
    expect(relativeTime('', NOW)).toBe('');
    expect(relativeTime(undefined, NOW)).toBe('');
    expect(relativeTime('not a date', NOW)).toBe('');
    expect(relativeTime('2026-03-11T12:00:00.000Z', NOW)).toBe('just now');
  });
});

describe('formatSalary', () => {
  it('abbreviates thousands and appends the period', () => {
    expect(formatSalary({ min: 120000, max: 150000, currency: 'USD', period: 'year' })).toBe('$120k – $150k/yr');
    expect(formatSalary({ min: 45, currency: 'GBP', period: 'hour' })).toBe('From £45/hr');
    expect(formatSalary({ max: 8000, currency: 'EUR', period: 'month' })).toBe('€8,000/mo');
  });

  it('falls back to the source display string and to null', () => {
    expect(formatSalary({ display: 'Competitive' })).toBe('Competitive');
    expect(formatSalary({})).toBeNull();
    expect(formatSalary(undefined)).toBeNull();
  });

  it('uses the ISO code when no symbol is known', () => {
    expect(formatSalary({ min: 90000, max: 110000, currency: 'NOK', period: 'year' })).toBe('NOK 90k – NOK 110k/yr');
  });

  it('abbreviates amounts predictably', () => {
    expect(abbreviateAmount(120000)).toBe('120k');
    expect(abbreviateAmount(125500)).toBe('125.5k');
    expect(abbreviateAmount(9500)).toBe('9,500');
    expect(abbreviateAmount(42.5)).toBe('42.50');
  });
});

describe('list helpers', () => {
  it('describes the visible range', () => {
    expect(rangeLabel(1, 25, 342, 25)).toBe('1–25 of 342 jobs');
    expect(rangeLabel(3, 25, 342, 25)).toBe('51–75 of 342 jobs');
    expect(rangeLabel(1, 25, 4, 4)).toBe('4 jobs');
    expect(rangeLabel(1, 25, 1, 1)).toBe('1 job');
    expect(rangeLabel(1, 25, 0, 0)).toBe('0 jobs');
  });

  it('counts pages defensively', () => {
    expect(pageCount(342, 25)).toBe(14);
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(10, 0)).toBe(1);
  });

  it('formats source timings and statuses', () => {
    expect(formatDuration(312)).toBe('312ms');
    expect(formatDuration(1420)).toBe('1.4s');
    expect(sourceStatusMeta('ok').tone).toBe('success');
    expect(sourceStatusMeta('error').tone).toBe('danger');
    expect(sourceStatusMeta('timeout').tone).toBe('warning');
    expect(sourceStatusMeta('disabled').label).toBe('Needs API key');
    expect(sourceLabel('themuse')).toBe('The Muse');
  });
});

describe('job display helpers', () => {
  it('picks a logo fallback initial', () => {
    expect(companyInitial('Northwind Traders')).toBe('N');
    expect(companyInitial('  9to5 Labs')).toBe('9');
    expect(companyInitial('')).toBe('?');
  });

  it('always produces a location line', () => {
    expect(locationLabel({ location: 'Austin, TX', remote: false })).toBe('Austin, TX');
    expect(locationLabel({ location: '', remote: true })).toBe('Remote');
    expect(locationLabel({ location: '', remote: false })).toBe('Location not listed');
  });

  it('names a saved search from the query', () => {
    expect(describeQuery('marketing ops', 'Dallas, TX', false)).toBe('marketing ops in Dallas, TX');
    expect(describeQuery('react', '', true)).toBe('react · Remote');
    expect(describeQuery('', '', false)).toBe('All jobs');
  });
});
