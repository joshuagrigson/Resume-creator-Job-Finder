// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Job, TrackedJob } from '@shared/types';
import { ToastProvider } from '@/components/ui';
import TrackerPage from '@/pages/Tracker';
import { useJobStore } from '@/stores/jobStore';
import { useResumeStore } from '@/stores/resumeStore';
import { createSampleResume } from '@/lib/resume/defaults';

const job: Job = {
  id: 'remotive:77',
  source: 'remotive',
  sourceId: '77',
  title: 'Revenue Operations Lead',
  company: 'Fathom',
  location: 'Austin, TX',
  remote: false,
  tags: ['salesforce', 'hubspot'],
  descriptionHtml: '<p>Own the revenue stack.</p>',
  descriptionText: 'Own the revenue stack.',
  url: 'https://example.com/revops',
  postedAt: '2026-09-01T00:00:00.000Z',
  fetchedAt: '2026-09-02T00:00:00.000Z',
};

const tracked: TrackedJob = {
  job,
  status: 'applied',
  notes: '',
  savedAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-04T00:00:00.000Z',
  appliedAt: '2026-09-03T00:00:00.000Z',
};

let resumeId = '';

function renderTracker() {
  return render(
    <MemoryRouter initialEntries={['/tracker']}>
      <ToastProvider>
        <TrackerPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function openDetail() {
  fireEvent.click(screen.getByRole('button', { name: /^Revenue Operations Lead/ }));
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in tests'))));
  useJobStore.setState({ tracked: { [job.id]: { ...tracked } } });
  const resume = createSampleResume();
  resumeId = resume.id;
  useResumeStore.setState({ resumes: { [resume.id]: resume }, activeResumeId: resume.id });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useJobStore.setState({ tracked: {} });
  useResumeStore.setState({ resumes: {}, activeResumeId: null });
});

describe('TrackedDetail', () => {
  it('opens from the card and shows the application', () => {
    renderTracker();
    openDetail();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Revenue Operations Lead');
    expect(dialog.textContent).toContain('Fathom');
    expect(dialog.textContent).toContain('Austin, TX');
  });

  it('autosaves notes into the store after the debounce', async () => {
    renderTracker();
    openDetail();
    const notes = screen.getByLabelText('Notes');
    fireEvent.change(notes, { target: { value: 'Recruiter call Thursday 2pm.' } });

    await waitFor(() => expect(useJobStore.getState().tracked[job.id].notes).toBe('Recruiter call Thursday 2pm.'), {
      timeout: 3000,
    });
    expect(await screen.findByText('Notes saved')).toBeTruthy();
  });

  it('stores a follow-up date', () => {
    renderTracker();
    openDetail();
    fireEvent.change(screen.getByLabelText('Follow up on'), { target: { value: '2026-12-01' } });
    expect(useJobStore.getState().tracked[job.id].followUpOn).toBe('2026-12-01');
  });

  it('links the resume used', () => {
    renderTracker();
    openDetail();
    fireEvent.change(screen.getByLabelText('Resume used'), { target: { value: resumeId } });
    expect(useJobStore.getState().tracked[job.id].resumeId).toBe(resumeId);
  });

  it('changes status from the drawer', () => {
    renderTracker();
    openDetail();
    // The card select is labelled "Status for …"; the drawer's own control is just "Status".
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'offer' } });
    expect(useJobStore.getState().tracked[job.id].status).toBe('offer');
  });

  it('links out to the posting and the tailor page', () => {
    renderTracker();
    openDetail();
    const posting = screen.getByRole('link', { name: /View posting/ });
    expect(posting.getAttribute('href')).toBe(job.url);
    expect(posting.getAttribute('rel')).toBe('noopener noreferrer');
    expect(posting.getAttribute('target')).toBe('_blank');

    const tailor = screen.getByRole('link', { name: /Tailor resume/ });
    expect(tailor.getAttribute('href')).toBe('/tailor/remotive%3A77');
  });

  it('removes the application after confirmation', () => {
    renderTracker();
    openDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText('Remove this application?')).toBeTruthy();

    const buttons = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(Object.keys(useJobStore.getState().tracked)).toHaveLength(0);
  });
});
