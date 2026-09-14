// @vitest-environment jsdom
/**
 * Whole-app smoke: mount the real <App/> at every route, with the real stores and the
 * real router, and assert each page renders its actual content.
 *
 * The per-module tests all mount components in isolation. This is the one that would
 * catch a page that only works when its neighbours are mocked out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';
import { useResumeStore } from '@/stores/resumeStore';
import { useJobStore } from '@/stores/jobStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { HealthResponse, Job, JobSearchResponse } from '@shared/types';

const HEALTH: HealthResponse = {
  ok: true,
  version: '0.1.0',
  uptimeSeconds: 12,
  ai: { enabled: false, reason: 'ANTHROPIC_API_KEY not set' },
  sources: [
    { source: 'remotive', enabled: true, needsKey: false },
    { source: 'jobicy', enabled: true, needsKey: false },
    { source: 'adzuna', enabled: false, needsKey: true },
  ],
};

const JOB: Job = {
  id: 'jobicy:152035',
  source: 'jobicy',
  sourceId: '152035',
  title: 'Marketing Operations Manager',
  company: 'Cordance',
  location: 'Remote — USA',
  remote: true,
  tags: ['hubspot', 'crm'],
  descriptionHtml: '<p>Own the lifecycle stack.</p>',
  descriptionText: 'Own the lifecycle stack. Requirements: HubSpot, lead scoring, Salesforce.',
  url: 'https://jobicy.com/jobs/152035',
  postedAt: '2026-09-11T00:00:00.000Z',
  fetchedAt: '2026-09-13T00:00:00.000Z',
  salary: { min: 130000, max: 160000, currency: 'USD', period: 'year' },
};

const SEARCH: JobSearchResponse = {
  jobs: [JOB],
  total: 1,
  page: 1,
  pageSize: 25,
  sources: [{ source: 'jobicy', status: 'ok', count: 1, ms: 42 }],
  cached: false,
  fetchedAt: '2026-09-13T00:00:00.000Z',
};

function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/api/health') ? HEALTH : url.includes('/api/jobs/search') ? SEARCH : JOB;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', stubFetch());
  // jsdom has no layout engine; the preview pane measures itself with one.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  useResumeStore.setState({ resumes: {}, activeResumeId: null });
  useJobStore.setState({ tracked: {}, savedSearches: [], results: null, jobsById: {}, selectedJobId: null });
  useSettingsStore.setState({ health: null, ai: null, healthError: null });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mountAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('every route renders real content', () => {
  it('dashboard offers a way in when there is no resume yet', async () => {
    mountAt('/');
    expect(await screen.findByRole('main')).toBeTruthy();
    // The first-run path has to offer at least one way to create a resume.
    const buttons = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    const links = screen.getAllByRole('link').map((a) => a.textContent ?? '');
    expect([...buttons, ...links].join(' ')).toMatch(/sample|blank|import|resume/i);
  });

  it('resume builder renders the editor and the live sheet once a resume exists', async () => {
    useResumeStore.getState().createResume({ fromSample: true });
    mountAt('/resume');
    // The sample resume's real content must reach the page.
    expect(await screen.findAllByText(/Jordan Rivera/i)).not.toHaveLength(0);
    expect(screen.getAllByText(/Marketing Operations Manager/i).length).toBeGreaterThan(0);
  });

  it('job finder renders results from the API', async () => {
    useResumeStore.getState().createResume({ fromSample: true });
    mountAt('/jobs');
    await waitFor(() => {
      expect(screen.getAllByText(/Cordance/i).length).toBeGreaterThan(0);
    });
  });

  it('tracker renders its columns', async () => {
    useJobStore.getState().trackJob(JOB, 'applied');
    mountAt('/tracker');
    expect(await screen.findByRole('main')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText(/Marketing Operations Manager/i).length).toBeGreaterThan(0);
    });
  });

  it('tailor page renders without a job selected', async () => {
    useResumeStore.getState().createResume({ fromSample: true });
    mountAt('/tailor');
    expect(await screen.findByRole('main')).toBeTruthy();
    expect(document.body.textContent ?? '').toMatch(/job|tailor/i);
  });

  it('settings renders the data and AI panels', async () => {
    mountAt('/settings');
    expect(await screen.findByRole('main')).toBeTruthy();
    await waitFor(() => {
      expect(document.body.textContent ?? '').toMatch(/ANTHROPIC_API_KEY|AI/i);
    });
  });

  it('an unknown route renders the 404 rather than a blank page', async () => {
    mountAt('/definitely-not-a-route');
    expect(await screen.findByRole('main')).toBeTruthy();
    expect(document.body.textContent ?? '').toMatch(/not found|404|go home|dashboard/i);
  });

  it('no route logs a React error or warning', async () => {
    const errors: unknown[] = [];
    const spyError = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args));
    const spyWarn = vi.spyOn(console, 'warn').mockImplementation((...args) => errors.push(args));
    useResumeStore.getState().createResume({ fromSample: true });
    for (const path of ['/', '/resume', '/jobs', '/tracker', '/tailor', '/settings']) {
      mountAt(path);
      await screen.findAllByRole('main');
      cleanup();
    }
    spyError.mockRestore();
    spyWarn.mockRestore();
    expect(errors).toEqual([]);
  });
});
