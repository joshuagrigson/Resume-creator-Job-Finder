// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { HealthResponse } from '@shared/types';
import { ToastProvider } from '@/components/ui';
import SettingsPage from '@/pages/Settings';
import { useResumeStore } from '@/stores/resumeStore';
import { useJobStore } from '@/stores/jobStore';
import { useSettingsStore } from '@/stores/settingsStore';

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <ToastProvider>
        <SettingsPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const HEALTH: HealthResponse = {
  ok: true,
  version: '0.1.0',
  uptimeSeconds: 120,
  ai: { enabled: false, reason: 'ANTHROPIC_API_KEY not set' },
  sources: [
    { source: 'remotive', enabled: true, needsKey: false },
    { source: 'adzuna', enabled: false, needsKey: true },
    { source: 'usajobs', enabled: false, needsKey: true },
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline in tests'))),
  );
  useResumeStore.setState({ resumes: {}, activeResumeId: null });
  useJobStore.setState({ tracked: {}, savedSearches: [], results: null, jobsById: {}, loading: false, error: null });
  useSettingsStore.setState({ health: HEALTH, ai: HEALTH.ai, healthError: null, theme: 'system' });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Settings — clear all data', () => {
  it('keeps the delete button disabled until DELETE is typed exactly', async () => {
    useResumeStore.getState().createResume({ fromSample: true });
    expect(Object.keys(useResumeStore.getState().resumes)).toHaveLength(1);

    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: /clear all data/i }));

    const dialog = await screen.findByRole('dialog');
    const confirm = dialogButton(dialog, /delete everything/i);
    expect(confirm.hasAttribute('disabled')).toBe(true);

    const input = screen.getByLabelText(/type delete to confirm/i);

    fireEvent.change(input, { target: { value: 'delete' } });
    expect(dialogButton(dialog, /delete everything/i).hasAttribute('disabled')).toBe(true);

    fireEvent.click(dialogButton(dialog, /delete everything/i));
    expect(Object.keys(useResumeStore.getState().resumes)).toHaveLength(1);

    fireEvent.change(input, { target: { value: 'DELETE' } });
    expect(dialogButton(dialog, /delete everything/i).hasAttribute('disabled')).toBe(false);

    fireEvent.click(dialogButton(dialog, /delete everything/i));

    await waitFor(() => {
      expect(Object.keys(useResumeStore.getState().resumes)).toHaveLength(0);
    });
    expect(useResumeStore.getState().activeResumeId).toBeNull();
  });
});

describe('Settings — server status', () => {
  it('explains how to turn AI on without ever asking for a key', () => {
    renderSettings();

    expect(screen.getByText(/AI features are off/i)).toBeTruthy();
    expect(screen.getAllByText(/ANTHROPIC_API_KEY/).length).toBeGreaterThan(0);
    expect(screen.getByText(/never ask you to paste one/i)).toBeTruthy();
    expect(screen.queryByLabelText(/api key/i)).toBeNull();
  });

  it('lists job sources with their enable hints', () => {
    renderSettings();

    expect(screen.getByText('Remotive')).toBeTruthy();
    expect(screen.getByText('Adzuna')).toBeTruthy();
    expect(screen.getByText(/ADZUNA_APP_ID and ADZUNA_APP_KEY/)).toBeTruthy();
    expect(screen.getByText(/USAJOBS_API_KEY and USAJOBS_USER_AGENT/)).toBeTruthy();
    expect(screen.getAllByText(/needs a key/i).length).toBeGreaterThanOrEqual(2);
  });

  it('shows the server version in About', () => {
    renderSettings();
    expect(screen.getByText('0.1.0')).toBeTruthy();
  });
});

/** Small helper: find a button by name inside a container. */
function dialogButton(container: HTMLElement, name: RegExp): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll('button'));
  const match = buttons.find((b) => name.test(b.textContent ?? ''));
  if (!match) throw new Error(`No button matching ${name} inside the dialog`);
  return match as HTMLButtonElement;
}
