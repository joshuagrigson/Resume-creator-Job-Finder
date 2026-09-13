// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AiTailorResponse, Resume } from '@shared/types';
import { ToastProvider } from '@/components/ui';
import { AiTailorPanel, CoverLetterPanel, aiErrorCopy } from '@/components/tailor';
import { ApiClientError, api } from '@/lib/api';
import { useResumeStore } from '@/stores/resumeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createSampleResume } from '@/lib/resume/defaults';

const JD =
  'Marketing Operations Manager at Northwind. You will own HubSpot, Salesforce and Twilio automations for a 20-rep call center.';

let resume: Resume;

function seedResume(): Resume {
  const next = createSampleResume();
  useResumeStore.setState({ resumes: { [next.id]: next }, activeResumeId: next.id });
  return next;
}

function renderTailorPanel(current: Resume = resume) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <AiTailorPanel resume={current} jobText={JD} jobTitle="Marketing Operations Manager" company="Northwind" jobId="remotive:9" />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function renderCoverLetter(current: Resume = resume) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <CoverLetterPanel resume={current} jobText={JD} jobTitle="Marketing Operations Manager" company="Northwind" />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in tests'))));
  resume = seedResume();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useResumeStore.setState({ resumes: {}, activeResumeId: null });
  useSettingsStore.setState({ ai: null });
});

describe('aiErrorCopy', () => {
  it('explains a disabled server and does not offer a retry', () => {
    const copy = aiErrorCopy(new ApiClientError('AI disabled', 503, 'ai_disabled'));
    expect(copy.description).toContain('ANTHROPIC_API_KEY');
    expect(copy.retryable).toBe(false);
  });

  it('asks the user to wait when rate limited', () => {
    const copy = aiErrorCopy(new ApiClientError('slow down', 429, 'rate_limited'));
    expect(copy.title).toBe('Too many requests');
    expect(copy.retryable).toBe(true);
  });

  it('falls back to the server message for anything else', () => {
    const copy = aiErrorCopy(new ApiClientError('upstream exploded', 502, 'ai_upstream'));
    expect(copy.description).toBe('upstream exploded');
    expect(copy.retryable).toBe(true);
  });
});

describe('AI panels with AI switched off', () => {
  beforeEach(() => {
    useSettingsStore.setState({ ai: { enabled: false, reason: 'ANTHROPIC_API_KEY not set' } });
  });

  it('explains how to switch tailoring on', () => {
    renderTailorPanel();
    expect(screen.getByText('Tailoring suggestions need the AI server')).toBeTruthy();
    expect(screen.getAllByText(/ANTHROPIC_API_KEY/).length).toBeGreaterThan(0);
    expect(screen.getByText(/works without it/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Generate suggestions/ })).toBeNull();
  });

  it('explains the same for cover letters', () => {
    renderCoverLetter();
    expect(screen.getByText('Cover letters need the AI server')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Generate' })).toBeNull();
  });

  it('points at Settings', () => {
    renderCoverLetter();
    expect(screen.getByRole('link', { name: /Settings/ }).getAttribute('href')).toBe('/settings');
  });
});

describe('AI tailor panel with AI enabled', () => {
  beforeEach(() => {
    useSettingsStore.setState({ ai: { enabled: true, model: 'claude-opus-5' } });
  });

  const response: AiTailorResponse = {
    note: 'Lean harder on call-center automation.',
    keywordsToAdd: ['Marketo'],
    suggestions: [
      {
        type: 'summary',
        original: 'old summary',
        suggested: 'Marketing operations leader who books more tours per dial.',
        reason: 'Mirrors the posting.',
      },
      {
        type: 'skill',
        suggested: 'Marketo',
        reason: 'Named twice in the posting.',
      },
    ],
  };

  it('generates, then accepts a summary suggestion into the resume', async () => {
    const spy = vi.spyOn(api.ai, 'tailor').mockResolvedValue(response);
    renderTailorPanel();

    fireEvent.click(screen.getByRole('button', { name: /Generate suggestions/ }));
    expect(await screen.findByText(/usually 10–30 s/)).toBeTruthy();

    expect(await screen.findByText('Marketing operations leader who books more tours per dial.')).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[0]);
    await waitFor(() =>
      expect(useResumeStore.getState().resumes[resume.id].summary).toBe('Marketing operations leader who books more tours per dial.'),
    );
  });

  it('accepts a skill suggestion into the first skill group', async () => {
    vi.spyOn(api.ai, 'tailor').mockResolvedValue(response);
    renderTailorPanel();
    fireEvent.click(screen.getByRole('button', { name: /Generate suggestions/ }));
    await screen.findAllByText('Marketo');

    const accepts = await screen.findAllByRole('button', { name: 'Accept' });
    fireEvent.click(accepts[1]);

    await waitFor(() => expect(useResumeStore.getState().resumes[resume.id].skillGroups[0].skills).toContain('Marketo'));
  });

  it('skips a suggestion without touching the resume', async () => {
    vi.spyOn(api.ai, 'tailor').mockResolvedValue(response);
    renderTailorPanel();
    fireEvent.click(screen.getByRole('button', { name: /Generate suggestions/ }));
    await screen.findAllByRole('button', { name: 'Skip' });

    fireEvent.click(screen.getAllByRole('button', { name: 'Skip' })[0]);
    expect(screen.getByText('Skipped')).toBeTruthy();
    expect(useResumeStore.getState().resumes[resume.id].summary).toBe(resume.summary);
  });

  it('writes into a tailored duplicate when asked to', async () => {
    vi.spyOn(api.ai, 'tailor').mockResolvedValue(response);
    renderTailorPanel();
    fireEvent.click(screen.getByRole('button', { name: /Generate suggestions/ }));
    await screen.findAllByRole('button', { name: 'Accept' });

    fireEvent.click(screen.getByRole('switch', { name: /Create a tailored copy first/ }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[0]);

    await waitFor(() => expect(Object.keys(useResumeStore.getState().resumes)).toHaveLength(2));
    const resumes = Object.values(useResumeStore.getState().resumes);
    const copy = resumes.find((r) => r.id !== resume.id)!;
    expect(copy.name).toBe(`${resume.name} — Northwind`);
    expect(copy.tailoredForJobId).toBe('remotive:9');
    expect(copy.summary).toBe('Marketing operations leader who books more tours per dial.');
    // The original is untouched.
    expect(useResumeStore.getState().resumes[resume.id].summary).toBe(resume.summary);
  });

  it('surfaces a retryable error', async () => {
    vi.spyOn(api.ai, 'tailor').mockRejectedValue(new ApiClientError('slow down', 429, 'rate_limited'));
    renderTailorPanel();
    fireEvent.click(screen.getByRole('button', { name: /Generate suggestions/ }));

    expect((await screen.findAllByText('Too many requests')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('Cover letter panel with AI enabled', () => {
  beforeEach(() => {
    useSettingsStore.setState({ ai: { enabled: true, model: 'claude-opus-5' } });
  });

  it('generates an editable letter with copy and download', async () => {
    vi.spyOn(api.ai, 'coverLetter').mockResolvedValue({ letter: 'Dear hiring team,\n\nI book tours for a living.' });
    renderCoverLetter();

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    const textarea = (await screen.findByLabelText('Your cover letter')) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Dear hiring team');

    fireEvent.change(textarea, { target: { value: 'My own words.' } });
    expect((screen.getByLabelText('Your cover letter') as HTMLTextAreaElement).value).toBe('My own words.');

    expect(screen.getByRole('button', { name: /Copy/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Download .txt/ })).toBeTruthy();
  });

  it('passes the chosen tone and length through', async () => {
    const spy = vi.spyOn(api.ai, 'coverLetter').mockResolvedValue({ letter: 'Letter.' });
    renderCoverLetter();

    fireEvent.change(screen.getByLabelText('Tone'), { target: { value: 'direct' } });
    fireEvent.change(screen.getByLabelText('Length'), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0][0]).toMatchObject({ tone: 'direct', lengthWords: 400, company: 'Northwind' });
  });
});
