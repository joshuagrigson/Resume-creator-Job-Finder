// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui';
import { createSampleResume } from '@/lib/resume/defaults';

const exportPdf = vi.fn(() => Promise.resolve());
const exportDocx = vi.fn(() => Promise.resolve());
const exportJson = vi.fn();

vi.mock('@/lib/export', () => ({
  exportPdf: (...args: unknown[]) => exportPdf(...(args as [])),
  exportDocx: (...args: unknown[]) => exportDocx(...(args as [])),
  exportJson: (...args: unknown[]) => exportJson(...(args as [])),
  resumeFileName: () => 'Test Resume.pdf',
}));

const { BulletListEditor } = await import('@/components/resume-editor/BulletListEditor');
const { TagInput } = await import('@/components/resume-editor/TagInput');
const { ExportMenu } = await import('@/components/resume-editor/ExportMenu');

function wrap(children: ReactNode) {
  return <ToastProvider>{children}</ToastProvider>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function BulletHarness({ initial }: { initial: string[] }) {
  const [bullets, setBullets] = useState(initial);
  return (
    <>
      <BulletListEditor legend="Achievements" bullets={bullets} onChange={setBullets} />
      <output data-testid="count">{bullets.length}</output>
    </>
  );
}

describe('BulletListEditor', () => {
  it('adds a bullet when Enter is pressed', () => {
    render(wrap(<BulletHarness initial={['Led a team of 12.']} />));

    const first = screen.getByLabelText('Achievements — bullet 1');
    fireEvent.keyDown(first, { key: 'Enter' });

    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(screen.getByLabelText('Achievements — bullet 2')).toBeTruthy();
  });

  it('removes an empty bullet on Backspace', () => {
    render(wrap(<BulletHarness initial={['Led a team of 12.', '']} />));

    fireEvent.keyDown(screen.getByLabelText('Achievements — bullet 2'), { key: 'Backspace' });

    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('reorders bullets with the move buttons', () => {
    render(wrap(<BulletHarness initial={['First', 'Second']} />));

    fireEvent.click(screen.getByRole('button', { name: 'Move bullet 2 up' }));

    const first = screen.getByLabelText('Achievements — bullet 1') as HTMLTextAreaElement;
    expect(first.value).toBe('Second');
  });
});

function TagHarness() {
  const [tags, setTags] = useState<string[]>([]);
  return (
    <>
      <TagInput label="Skills" value={tags} onChange={setTags} />
      <output data-testid="tags">{tags.join('|')}</output>
    </>
  );
}

describe('TagInput', () => {
  it('commits a value on Enter and splits a pasted list', () => {
    render(wrap(<TagHarness />));
    const input = screen.getByLabelText('Skills') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'HubSpot' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('tags').textContent).toBe('HubSpot');

    fireEvent.paste(input, { clipboardData: { getData: () => 'Twilio, Convoso' } });
    expect(screen.getByTestId('tags').textContent).toBe('HubSpot|Twilio|Convoso');
  });
});

describe('ExportMenu', () => {
  it('offers PDF, Word and JSON', () => {
    const resume = createSampleResume();
    render(wrap(<ExportMenu resume={resume} />));

    fireEvent.click(screen.getByRole('button', { name: /Export/ }));

    expect(screen.getByRole('menuitem', { name: 'PDF' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Word (.docx)' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'JSON' })).toBeTruthy();
  });

  it('calls the JSON exporter when picked', () => {
    const resume = createSampleResume();
    render(wrap(<ExportMenu resume={resume} />));

    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'JSON' }));

    expect(exportJson).toHaveBeenCalledTimes(1);
  });
});
