// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui';
import TailorPage from '@/pages/Tailor';
import { useResumeStore } from '@/stores/resumeStore';
import { useJobStore } from '@/stores/jobStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createSampleResume } from '@/lib/resume/defaults';
import { jobTextOf, resumeSkillSet, sanitizeJobHtml, withSkillsAdded } from '@/components/tailor';

const JD = [
  'Platform Engineer at Northwind.',
  'Requirements:',
  'Strong hands-on experience with Kubernetes and Docker in production.',
  'You must have Terraform experience and solid Python skills.',
  'Nice to have:',
  'GraphQL exposure is a plus.',
].join('\n');

let resumeId = '';

function renderTailor() {
  return render(
    <MemoryRouter initialEntries={['/tailor']}>
      <ToastProvider>
        <TailorPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function pasteDescription(text = JD) {
  fireEvent.click(screen.getByRole('tab', { name: /Paste/ }));
  fireEvent.change(screen.getByLabelText('Paste a job description'), { target: { value: text } });
  fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Platform Engineer' } });
  fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Northwind' } });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in tests'))));
  const resume = createSampleResume();
  resumeId = resume.id;
  useResumeStore.setState({ resumes: { [resume.id]: resume }, activeResumeId: resume.id });
  useJobStore.setState({ tracked: {}, results: null, jobsById: {} });
  useSettingsStore.setState({ ai: { enabled: false, reason: 'ANTHROPIC_API_KEY not set' } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useResumeStore.setState({ resumes: {}, activeResumeId: null });
  useJobStore.setState({ tracked: {}, results: null, jobsById: {} });
  useSettingsStore.setState({ ai: null });
});

describe('tailor helpers', () => {
  it('strips scripts and forces safe links', () => {
    const html = sanitizeJobHtml('<p>Hi<script>alert(1)</script><a href="https://x.test">apply</a><img src="x"></p>');
    expect(html).not.toContain('script');
    expect(html).not.toContain('<img');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it('prefers plain description text, falling back to sanitized HTML', () => {
    expect(jobTextOf({ descriptionText: 'plain', descriptionHtml: '<p>html</p>' })).toBe('plain');
    expect(jobTextOf({ descriptionText: '', descriptionHtml: '<p>Two words</p>' })).toBe('Two words');
    expect(jobTextOf(null)).toBe('');
  });

  it('adds skills to the first group without duplicating', () => {
    const resume = createSampleResume();
    const next = withSkillsAdded(resume, ['Kubernetes', 'HubSpot', '  ']);
    expect(next.skillGroups[0].skills).toContain('Kubernetes');
    expect(next.skillGroups[0].skills.filter((s) => s.toLowerCase() === 'hubspot')).toHaveLength(0);
    expect(withSkillsAdded(next, ['Kubernetes'])).toBe(next);
    expect(resumeSkillSet(next).has('kubernetes')).toBe(true);
  });

  it('creates a skill group when the resume has none', () => {
    const resume = { ...createSampleResume(), skillGroups: [] };
    const next = withSkillsAdded(resume, ['Docker']);
    expect(next.skillGroups).toHaveLength(1);
    expect(next.skillGroups[0].skills).toEqual(['Docker']);
  });
});

describe('Tailor page — keyword gap', () => {
  it('asks for a job before showing the tools', () => {
    renderTailor();
    expect(screen.getByText('Choose a job to tailor against')).toBeTruthy();
  });

  it('lists missing required skills for a pasted description', () => {
    renderTailor();
    pasteDescription();

    expect(screen.getByRole('tab', { name: /Keyword gap/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add Kubernetes to skills' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add Docker to skills' })).toBeTruthy();
    // Python is already on the sample resume, so it lands in "matched".
    const required = screen.getByText('Required').closest('.ui-card') as HTMLElement;
    expect(within(required).getByText('Python')).toBeTruthy();
  });

  it('adds a missing skill to the active resume in one click', () => {
    renderTailor();
    pasteDescription();

    fireEvent.click(screen.getByRole('button', { name: 'Add Kubernetes to skills' }));

    const resume = useResumeStore.getState().resumes[resumeId];
    expect(resume.skillGroups[0].skills).toContain('Kubernetes');
    expect(screen.getByText('Added "Kubernetes" to your skills')).toBeTruthy();
    // The chip flips over to "matched", so the add button is gone.
    expect(screen.queryByRole('button', { name: 'Add Kubernetes to skills' })).toBeNull();
  });

  it('adds every missing skill at once', () => {
    renderTailor();
    pasteDescription();

    const bulk = screen.getByRole('button', { name: /^Add all \d+ missing$/ });
    fireEvent.click(bulk);

    const skills = useResumeStore.getState().resumes[resumeId].skillGroups[0].skills;
    expect(skills).toContain('Kubernetes');
    expect(skills).toContain('Docker');
  });

  it('reports the match score for the pasted description', () => {
    renderTailor();
    pasteDescription();
    expect(screen.getByText(/%\s·\s(Excellent|Strong|Good|Fair|Low)/)).toBeTruthy();
  });

  it('prompts to create a resume when there is none', () => {
    useResumeStore.setState({ resumes: {}, activeResumeId: null });
    renderTailor();
    expect(screen.getByText('You need a resume first')).toBeTruthy();
  });
});
