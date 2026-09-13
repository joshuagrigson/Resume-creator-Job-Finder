// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import type { Job, TrackedJob } from '@shared/types';
import { BestMatchesCard, FollowUpsCard, PipelineCard, daysUntil, formatDueLabel, formatRelativeTime } from '@/components/dashboard';
import { createSampleResume } from '@/lib/resume/defaults';
import { useJobStore } from '@/stores/jobStore';

function renderIn(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function makeJob(partial: Partial<Job> & { id: string; title: string }): Job {
  return {
    source: 'remotive',
    sourceId: partial.id.split(':')[1] ?? '1',
    company: 'Acme',
    location: 'Remote',
    remote: true,
    tags: [],
    descriptionHtml: '',
    descriptionText: '',
    url: 'https://example.com/job',
    postedAt: '2026-09-01T00:00:00.000Z',
    fetchedAt: '2026-09-02T00:00:00.000Z',
    ...partial,
  };
}

function makeTracked(partial: Partial<TrackedJob> & { job: Job }): TrackedJob {
  return {
    status: 'applied',
    notes: '',
    savedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

function ymd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline in tests'))),
  );
  useJobStore.setState({ results: null, jobsById: {}, loading: false, error: null, tracked: {}, savedSearches: [] });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('dashboard date helpers', () => {
  it('formats relative timestamps', () => {
    const now = new Date('2026-09-13T12:00:00.000Z');
    expect(formatRelativeTime('2026-09-13T11:59:50.000Z', now)).toBe('just now');
    expect(formatRelativeTime('2026-09-13T11:30:00.000Z', now)).toBe('30 min ago');
    expect(formatRelativeTime('2026-09-13T09:00:00.000Z', now)).toBe('3 hours ago');
    expect(formatRelativeTime('2026-09-12T12:00:00.000Z', now)).toBe('yesterday');
    expect(formatRelativeTime('2026-09-05T12:00:00.000Z', now)).toBe('8 days ago');
    expect(formatRelativeTime(undefined, now)).toBe('never');
  });

  it('counts whole days to a YYYY-MM-DD date', () => {
    const today = new Date(2026, 8, 13, 15, 30);
    expect(daysUntil('2026-09-13', today)).toBe(0);
    expect(daysUntil('2026-09-16', today)).toBe(3);
    expect(daysUntil('2026-09-11', today)).toBe(-2);
    expect(daysUntil('not-a-date', today)).toBeNull();
    expect(daysUntil(undefined, today)).toBeNull();
  });

  it('labels due dates in plain words', () => {
    expect(formatDueLabel(-3)).toBe('Overdue by 3 days');
    expect(formatDueLabel(-1)).toBe('Overdue by 1 day');
    expect(formatDueLabel(0)).toBe('Due today');
    expect(formatDueLabel(1)).toBe('Tomorrow');
    expect(formatDueLabel(5)).toBe('In 5 days');
  });
});

describe('PipelineCard', () => {
  it('counts tracked jobs per status', () => {
    const tracked = [
      makeTracked({ job: makeJob({ id: 'remotive:1', title: 'Ops Manager' }), status: 'applied' }),
      makeTracked({ job: makeJob({ id: 'remotive:2', title: 'Ops Lead' }), status: 'applied' }),
      makeTracked({ job: makeJob({ id: 'remotive:3', title: 'Analyst' }), status: 'interviewing' }),
    ];
    renderIn(<PipelineCard tracked={tracked} />);

    const appliedRow = screen.getByText('Applied').closest('a') as HTMLElement;
    expect(appliedRow.textContent).toContain('2');

    const interviewRow = screen.getByText('Interviewing').closest('a') as HTMLElement;
    expect(interviewRow.textContent).toContain('1');

    expect(screen.getByText('3 active · 3 total')).toBeTruthy();
  });

  it('shows an empty state with no tracked jobs', () => {
    renderIn(<PipelineCard tracked={[]} />);
    expect(screen.getByText(/no applications tracked/i)).toBeTruthy();
  });
});

describe('FollowUpsCard', () => {
  it('lists overdue and upcoming follow-ups and hides far-future ones', () => {
    const tracked = [
      makeTracked({ job: makeJob({ id: 'remotive:1', title: 'Overdue role' }), followUpOn: ymd(-2) }),
      makeTracked({ job: makeJob({ id: 'remotive:2', title: 'Soon role' }), followUpOn: ymd(3) }),
      makeTracked({ job: makeJob({ id: 'remotive:3', title: 'Far role' }), followUpOn: ymd(40) }),
      makeTracked({ job: makeJob({ id: 'remotive:4', title: 'No date role' }) }),
    ];
    renderIn(<FollowUpsCard tracked={tracked} />);

    expect(screen.getByText('Overdue role')).toBeTruthy();
    expect(screen.getByText('Soon role')).toBeTruthy();
    expect(screen.queryByText('Far role')).toBeNull();
    expect(screen.queryByText('No date role')).toBeNull();

    expect(screen.getByText('Overdue by 2 days')).toBeTruthy();
    expect(screen.getByText('In 3 days')).toBeTruthy();
  });

  it('shows an empty state when nothing is due', () => {
    renderIn(<FollowUpsCard tracked={[]} />);
    expect(screen.getByText(/nothing due this week/i)).toBeTruthy();
  });
});

describe('BestMatchesCard', () => {
  it('nudges toward the resume builder when there is no resume', () => {
    renderIn(<BestMatchesCard />);
    expect(screen.getByText(/build a resume to see matches/i)).toBeTruthy();
  });

  it('ranks the last search results against the active resume', () => {
    const jobs = [
      makeJob({
        id: 'remotive:100',
        title: 'Warehouse Associate',
        company: 'Shipyard',
        descriptionText: 'Forklift certification required. Pallet jack experience.',
      }),
      makeJob({
        id: 'remotive:101',
        title: 'Marketing Operations Manager',
        company: 'Northwind',
        descriptionText:
          'Required: HubSpot, Salesforce, Twilio, lead scoring, dashboards, call center automation and reporting.',
        tags: ['hubspot', 'salesforce'],
      }),
    ];
    useJobStore.setState({
      results: { jobs, total: jobs.length, page: 1, pageSize: 25, sources: [], cached: false, fetchedAt: '2026-09-12T00:00:00.000Z' },
    });

    renderIn(<BestMatchesCard resume={createSampleResume()} />);

    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/jobs/'));
    expect(links).toHaveLength(2);
    expect(links[0]?.textContent).toContain('Marketing Operations Manager');
    expect(links[1]?.textContent).toContain('Warehouse Associate');
  });
});
