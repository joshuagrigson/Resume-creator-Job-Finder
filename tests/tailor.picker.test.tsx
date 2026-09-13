// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Job, TrackedJob } from '@shared/types';
import { ToastProvider } from '@/components/ui';
import TailorPage from '@/pages/Tailor';
import { api } from '@/lib/api';
import { ApiClientError } from '@/lib/api';
import { useJobStore } from '@/stores/jobStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createSampleResume } from '@/lib/resume/defaults';

const job: Job = {
  id: 'remotive:501',
  source: 'remotive',
  sourceId: '501',
  title: 'Lifecycle Marketing Manager',
  company: 'Brightwave',
  location: 'Remote — US',
  remote: true,
  tags: ['hubspot', 'lifecycle'],
  descriptionHtml:
    '<p>Own lifecycle campaigns.</p><script>alert(1)</script><p>Requirements: HubSpot, Salesforce, SQL.</p><a href="https://brightwave.test/apply">Apply</a>',
  descriptionText: 'Own lifecycle campaigns. Requirements: HubSpot, Salesforce, SQL and Kubernetes.',
  url: 'https://brightwave.test/jobs/501',
  postedAt: '2026-09-01T00:00:00.000Z',
  fetchedAt: '2026-09-02T00:00:00.000Z',
};

function trackedEntry(status: TrackedJob['status'] = 'saved'): TrackedJob {
  return {
    job,
    status,
    notes: '',
    savedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/tailor" element={<TailorPage />} />
          <Route path="/tailor/:jobId" element={<TailorPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in tests'))));
  const resume = createSampleResume();
  useResumeStore.setState({ resumes: { [resume.id]: resume }, activeResumeId: resume.id });
  useJobStore.setState({ tracked: {}, results: null, jobsById: {} });
  useSettingsStore.setState({ ai: { enabled: false, reason: 'ANTHROPIC_API_KEY not set' } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useResumeStore.setState({ resumes: {}, activeResumeId: null });
  useJobStore.setState({ tracked: {}, results: null, jobsById: {} });
  useSettingsStore.setState({ ai: null });
});

describe('Tailor route preselect', () => {
  it('uses the tracked snapshot when the job is already saved', async () => {
    useJobStore.setState({ tracked: { [job.id]: trackedEntry() } });
    renderAt(`/tailor/${encodeURIComponent(job.id)}`);

    expect(await screen.findByText(/Lifecycle Marketing Manager · Brightwave/)).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Keyword gap/ })).toBeTruthy();
  });

  it('falls back to the last search results', async () => {
    useJobStore.setState({ jobsById: { [job.id]: job } });
    renderAt(`/tailor/${encodeURIComponent(job.id)}`);
    expect(await screen.findByText(/Lifecycle Marketing Manager · Brightwave/)).toBeTruthy();
  });

  it('fetches the posting from the server when it is not local', async () => {
    const spy = vi.spyOn(api, 'getJob').mockResolvedValue(job);
    renderAt(`/tailor/${encodeURIComponent(job.id)}`);

    await waitFor(() => expect(spy).toHaveBeenCalledWith(job.id));
    expect(await screen.findByText(/Lifecycle Marketing Manager · Brightwave/)).toBeTruthy();
  });

  it('explains when the posting has expired out of the cache', async () => {
    vi.spyOn(api, 'getJob').mockRejectedValue(new ApiClientError('Not found', 404, 'not_found'));
    renderAt(`/tailor/${encodeURIComponent(job.id)}`);

    expect(await screen.findByText(/no longer in the server cache/)).toBeTruthy();
  });

  it('sanitizes the description preview and hardens its links', async () => {
    useJobStore.setState({ tracked: { [job.id]: trackedEntry() } });
    const { container } = renderAt(`/tailor/${encodeURIComponent(job.id)}`);

    fireEvent.click(await screen.findByRole('button', { name: /Job description/ }));

    const preview = container.querySelector('.tl-jd-html') as HTMLElement;
    expect(preview.innerHTML).not.toContain('script');
    expect(preview.textContent).toContain('Own lifecycle campaigns.');
    const link = preview.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('offers to track a job that is only in the search results', async () => {
    useJobStore.setState({ jobsById: { [job.id]: job } });
    renderAt(`/tailor/${encodeURIComponent(job.id)}`);

    const track = await screen.findByRole('button', { name: 'Track this job' });
    fireEvent.click(track);

    await waitFor(() => expect(useJobStore.getState().tracked[job.id]?.status).toBe('saved'));
  });

  it('switches the active resume from the sticky bar', async () => {
    useJobStore.setState({ tracked: { [job.id]: trackedEntry() } });
    const second = createSampleResume();
    second.name = 'Second resume';
    useResumeStore.setState((s) => ({ resumes: { ...s.resumes, [second.id]: second } }));

    renderAt(`/tailor/${encodeURIComponent(job.id)}`);
    fireEvent.change(await screen.findByLabelText('Resume to tailor'), { target: { value: second.id } });
    expect(useResumeStore.getState().activeResumeId).toBe(second.id);
  });

  it('shows the ATS report against the posting', async () => {
    useJobStore.setState({ tracked: { [job.id]: trackedEntry() } });
    renderAt(`/tailor/${encodeURIComponent(job.id)}`);

    fireEvent.click(await screen.findByRole('tab', { name: /ATS vs this job/ }));
    expect(await screen.findByText(/Keyword coverage vs this job/)).toBeTruthy();
    expect(screen.getByText('Categories')).toBeTruthy();
  });
});
