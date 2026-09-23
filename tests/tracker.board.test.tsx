// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Job, TrackedJob } from '@shared/types';
import { ToastProvider } from '@/components/ui';
import TrackerPage from '@/pages/Tracker';
import { followUpDateFrom, useJobStore } from '@/stores/jobStore';
import { useResumeStore } from '@/stores/resumeStore';
import { createSampleResume } from '@/lib/resume/defaults';
import { daysSince, followUpLabel, groupByStatus, isFollowUpOverdue, matchesFilter } from '@/components/tracker';

function makeJob(partial: Partial<Job> & { id: string; title: string; company: string }): Job {
  return {
    source: 'remotive',
    sourceId: partial.id.split(':')[1] ?? partial.id,
    location: 'Remote — US',
    remote: true,
    tags: ['react', 'typescript'],
    descriptionHtml: '<p>We need a senior engineer with React and TypeScript.</p>',
    descriptionText: 'We need a senior engineer with React and TypeScript.',
    url: 'https://example.com/job',
    postedAt: '2026-09-01T00:00:00.000Z',
    fetchedAt: '2026-09-02T00:00:00.000Z',
    ...partial,
  };
}

function entry(job: Job, patch: Partial<TrackedJob> = {}): TrackedJob {
  return {
    job,
    status: 'saved',
    notes: '',
    savedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...patch,
  };
}

const react = makeJob({ id: 'remotive:1', title: 'Senior React Engineer', company: 'Northwind' });
const ops = makeJob({ id: 'remotive:2', title: 'Marketing Operations Manager', company: 'Acme' });
const dialer = makeJob({ id: 'remotive:3', title: 'Call Center Supervisor', company: 'Ocean Canyon' });
const legacy = makeJob({ id: 'remotive:4', title: 'Junior Analyst', company: 'Old Corp' });

function seed(): void {
  useJobStore.setState({
    tracked: {
      [react.id]: entry(react, { status: 'saved', updatedAt: '2026-09-05T00:00:00.000Z' }),
      [ops.id]: entry(ops, { status: 'applied', appliedAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z' }),
      [dialer.id]: entry(dialer, { status: 'interviewing', updatedAt: '2026-09-03T00:00:00.000Z', followUpOn: '2020-01-01' }),
      [legacy.id]: entry(legacy, { status: 'archived', updatedAt: '2026-09-02T00:00:00.000Z' }),
    },
  });
  const resume = createSampleResume();
  useResumeStore.setState({ resumes: { [resume.id]: resume }, activeResumeId: resume.id });
}

function renderTracker() {
  return render(
    <MemoryRouter initialEntries={['/tracker']}>
      <ToastProvider>
        <TrackerPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in tests'))));
  seed();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useJobStore.setState({ tracked: {} });
  useResumeStore.setState({ resumes: {}, activeResumeId: null });
});

describe('tracker helpers', () => {
  it('groups entries by status', () => {
    const groups = groupByStatus([entry(react), entry(ops, { status: 'applied' })]);
    expect(groups.saved).toHaveLength(1);
    expect(groups.applied).toHaveLength(1);
    expect(groups.offer).toHaveLength(0);
  });

  it('flags overdue follow-ups and labels upcoming ones', () => {
    const now = new Date('2026-09-13T12:00:00.000Z');
    expect(isFollowUpOverdue('2026-09-10', now)).toBe(true);
    expect(isFollowUpOverdue('2026-09-20', now)).toBe(false);
    expect(followUpLabel('2026-09-11', now)).toBe('Follow-up 2 days overdue');
    expect(followUpLabel('2026-09-13', now)).toBe('Follow up today');
    expect(followUpLabel('2026-09-14', now)).toBe('Follow up in 1 day');
    expect(followUpLabel(undefined, now)).toBeNull();
  });

  it('counts whole days since a timestamp', () => {
    const now = new Date('2026-09-13T00:00:00.000Z');
    expect(daysSince('2026-09-10T00:00:00.000Z', now)).toBe(3);
    expect(daysSince(undefined, now)).toBeNull();
  });

  it('filters across title, company and notes', () => {
    const e = entry(react, { notes: 'Recruiter is Dana' });
    expect(matchesFilter(e, 'northwind')).toBe(true);
    expect(matchesFilter(e, 'dana')).toBe(true);
    expect(matchesFilter(e, 'senior dana')).toBe(true);
    expect(matchesFilter(e, 'kubernetes')).toBe(false);
  });
});

describe('Tracker board', () => {
  it('renders one column per status with live counts', () => {
    renderTracker();
    const saved = screen.getByRole('region', { name: /^Saved — 1 application$/ });
    expect(within(saved).getByText('Senior React Engineer')).toBeTruthy();

    expect(screen.getByRole('region', { name: /^Applied — 1 application$/ })).toBeTruthy();
    expect(screen.getByRole('region', { name: /^Interviewing — 1 application$/ })).toBeTruthy();
    expect(screen.getByRole('region', { name: /^Offer — 0 applications$/ })).toBeTruthy();
    expect(screen.getByRole('region', { name: /^Rejected — 0 applications$/ })).toBeTruthy();
  });

  it('shows a drop hint in empty columns', () => {
    renderTracker();
    const offer = screen.getByRole('region', { name: /^Offer/ });
    expect(within(offer).getByText('Nothing here yet')).toBeTruthy();
  });

  it('collapses the archived column by default', () => {
    renderTracker();
    const archived = screen.getByRole('region', { name: /^Archived — 1 application$/ });
    const toggle = within(archived).getByRole('button', { name: /Archived/ });
    const panel = document.getElementById('tr-col-archived') as HTMLElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBe(true);

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(within(archived).getByText('Junior Analyst')).toBeTruthy();
  });

  it('moves an application with the status select fallback', () => {
    renderTracker();
    const select = screen.getByLabelText('Status for Senior React Engineer') as HTMLSelectElement;
    expect(select.value).toBe('saved');

    fireEvent.change(select, { target: { value: 'interviewing' } });

    expect(useJobStore.getState().tracked[react.id].status).toBe('interviewing');
    expect(screen.getByRole('region', { name: /^Saved — 0 applications$/ })).toBeTruthy();
    expect(screen.getByRole('region', { name: /^Interviewing — 2 applications$/ })).toBeTruthy();
  });

  it('stamps appliedAt when a card moves to applied', () => {
    renderTracker();
    fireEvent.change(screen.getByLabelText('Status for Senior React Engineer'), { target: { value: 'applied' } });
    expect(useJobStore.getState().tracked[react.id].appliedAt).toBeTruthy();
    // A 7-day follow-up is set for him; he can still change or clear it in the detail panel.
    const entry = useJobStore.getState().tracked[react.id];
    expect(entry.followUpOn).toBe(followUpDateFrom(entry.appliedAt!));
    expect(followUpDateFrom('2026-09-23T15:00:00')).toBe('2026-09-30');
  });

  it('flags an overdue follow-up on the card', () => {
    renderTracker();
    const interviewing = screen.getByRole('region', { name: /^Interviewing/ });
    expect(within(interviewing).getByText(/overdue/i)).toBeTruthy();
  });

  it('shows match scores when a resume exists', () => {
    renderTracker();
    // MatchTone renders "<score>% · <label>" for every card.
    expect(screen.getAllByText(/%\s·\s(Excellent|Strong|Good|Fair|Low)/).length).toBeGreaterThan(0);
  });

  it('filters the board with the search box', () => {
    renderTracker();
    fireEvent.change(screen.getByLabelText('Search tracked applications'), { target: { value: 'acme' } });
    expect(screen.getByText('Marketing Operations Manager')).toBeTruthy();
    expect(screen.queryByText('Senior React Engineer')).toBeNull();
    expect(screen.getByText('1 of 4 shown')).toBeTruthy();
  });

  it('switches to the sortable list view', () => {
    renderTracker();
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: /Role/ })).toBeTruthy();
    expect(within(table).getAllByRole('row')).toHaveLength(5); // header + 4 entries
  });

  it('shows an empty state with nothing tracked', () => {
    useJobStore.setState({ tracked: {} });
    renderTracker();
    expect(screen.getByText('No applications tracked yet')).toBeTruthy();
  });
});
