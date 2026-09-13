// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { ToastProvider } from '@/components/ui';
import DashboardPage from '@/pages/Dashboard';
import { useResumeStore } from '@/stores/resumeStore';
import { useJobStore } from '@/stores/jobStore';
import { useSettingsStore } from '@/stores/settingsStore';

function renderPage(ui: ReactElement = <DashboardPage />) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ToastProvider>{ui}</ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // No server in tests: every /api call fails fast instead of hanging.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline in tests'))),
  );
  useResumeStore.setState({ resumes: {}, activeResumeId: null });
  useJobStore.setState({ tracked: {}, savedSearches: [], results: null, jobsById: {}, loading: false, error: null });
  useSettingsStore.setState({ health: null, ai: null, healthError: null });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Dashboard', () => {
  it('shows the first-run welcome with three ways to start when no resume exists', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: /build the resume first/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /start from sample/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /start blank/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /import a resume/i })).toBeTruthy();

    // The welcome screen has no resume card.
    expect(screen.queryByText(/^Active resume$/)).toBeNull();
  });

  it('offers a quick job search even before a resume exists', () => {
    renderPage();

    expect(screen.getByLabelText(/keywords/i)).toBeTruthy();
    expect(screen.getByLabelText(/location/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /search jobs/i })).toBeTruthy();
  });

  it('shows the active resume card with an ATS score once a sample resume exists', () => {
    useResumeStore.getState().createResume({ fromSample: true });

    renderPage();

    expect(screen.queryByRole('button', { name: /start from sample/i })).toBeNull();

    expect(screen.getByText('Active resume')).toBeTruthy();
    expect(screen.getByText('Jordan Rivera')).toBeTruthy();
    expect(screen.getByText('Marketing Operations Manager')).toBeTruthy();

    // ScoreRing exposes the score through its accessible name.
    const ring = screen.getByRole('img', { name: /ATS score: \d+ out of 100/i });
    expect(ring).toBeTruthy();

    // Pipeline is empty but present, and links into the tracker.
    const pipeline = screen.getByText('Pipeline').closest('.ui-card') as HTMLElement;
    expect(within(pipeline).getByText(/no applications tracked/i)).toBeTruthy();
  });

  it('greets the person by first name and links to the editor', () => {
    useResumeStore.getState().createResume({ fromSample: true });

    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: /jordan/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /open editor/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /fix these in the editor/i })).toBeTruthy();
  });
});
