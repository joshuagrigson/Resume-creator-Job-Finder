// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui';
import { useResumeStore } from '@/stores/resumeStore';
import { useSettingsStore } from '@/stores/settingsStore';

// The live preview belongs to another module and re-measures the DOM; the editor tests only
// care about the form side, so it is stubbed out here.
vi.mock('@/components/resume-editor/PreviewFrame', () => ({
  PreviewFrame: () => <div data-testid="preview-stub" />,
  default: () => <div data-testid="preview-stub" />,
  PAGE_WIDTH_PX: { letter: 816, a4: 794 },
}));

const { default: ResumeBuilderPage } = await import('@/pages/ResumeBuilder');

function renderPage(initialPath = '/resume'): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ToastProvider>
        <ResumeBuilderPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

function wrap(children: ReactNode) {
  return (
    <MemoryRouter>
      <ToastProvider>{children}</ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useResumeStore.setState({ resumes: {}, activeResumeId: null });
  useSettingsStore.setState({ ai: null });
});

afterEach(() => {
  cleanup();
});

describe('ResumeBuilder page', () => {
  it('shows the welcome card when no resume exists', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Build your resume' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start from a sample/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start blank/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Import/ })).toBeTruthy();
  });

  it('creates a resume from the sample and shows the editor', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Start from a sample/ }));

    const state = useResumeStore.getState();
    expect(state.activeResumeId).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Sample — Marketing Operations/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeTruthy();
  });

  it('writes summary edits straight into the store', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Start blank/ }));
    const id = useResumeStore.getState().activeResumeId as string;

    const field = screen.getByLabelText('Summary') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'Operations leader who ships.' } });

    expect(useResumeStore.getState().resumes[id]?.summary).toBe('Operations leader who ships.');
  });

  it('hides a section with the eye toggle', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Start blank/ }));
    const id = useResumeStore.getState().activeResumeId as string;

    expect(useResumeStore.getState().resumes[id]?.style.hiddenSections).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Hide Skills from the resume' }));
    expect(useResumeStore.getState().resumes[id]?.style.hiddenSections).toContain('skills');

    fireEvent.click(screen.getByRole('button', { name: 'Show Skills on the resume' }));
    expect(useResumeStore.getState().resumes[id]?.style.hiddenSections).toEqual([]);
  });

  it('adds a custom section and appends its key to the section order', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Start blank/ }));
    const id = useResumeStore.getState().activeResumeId as string;

    fireEvent.click(screen.getByRole('button', { name: 'Add custom section' }));

    const resume = useResumeStore.getState().resumes[id];
    expect(resume?.customSections).toHaveLength(1);
    const key = `custom:${resume?.customSections[0]?.id}`;
    expect(resume?.style.sectionOrder.at(-1)).toBe(key);
  });
});

describe('ResumeSwitcher inside the page', () => {
  it('lists every resume and can duplicate the active one', async () => {
    const { ResumeSwitcher } = await import('@/components/resume-editor/ResumeSwitcher');
    const id = useResumeStore.getState().createResume({ name: 'Ops resume' });

    render(wrap(<ResumeSwitcher activeId={id} onSelect={() => undefined} />));

    fireEvent.click(screen.getByRole('button', { name: /Switch or manage resumes|Ops resume/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

    expect(Object.keys(useResumeStore.getState().resumes)).toHaveLength(2);
  });
});
