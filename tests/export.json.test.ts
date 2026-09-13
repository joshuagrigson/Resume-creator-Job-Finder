// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RESUME_SCHEMA_VERSION } from '@shared/types';
import { createSampleResume } from '@/lib/resume/defaults';
import { buildResumeJson, exportJson, resumeJsonBlob, resumeJsonText } from '@/lib/export/json';
import { downloadBlob, resumeFileName } from '@/lib/export/file';

afterEach(() => {
  vi.restoreAllMocks();
});

/** jsdom has no object URL support, so stub it and record what the download would have been. */
function stubDownloads() {
  const created: Blob[] = [];
  const createObjectURL = vi.fn((blob: Blob) => {
    created.push(blob);
    return `blob:mock/${created.length}`;
  });
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });

  const clicks: HTMLAnchorElement[] = [];
  const clickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function mockClick(this: HTMLAnchorElement) {
      clicks.push(this);
    });

  return { created, clicks, createObjectURL, revokeObjectURL, clickSpy };
}

describe('buildResumeJson', () => {
  it('wraps the resume with the schema version and an export timestamp', () => {
    const resume = createSampleResume();
    const payload = buildResumeJson(resume, new Date('2026-09-13T12:00:00.000Z'));

    expect(payload.schemaVersion).toBe(RESUME_SCHEMA_VERSION);
    expect(payload.exportedAt).toBe('2026-09-13T12:00:00.000Z');
    expect(payload.resume).toBe(resume);
  });

  it('serialises to valid, re-readable JSON', () => {
    const resume = createSampleResume();
    const text = resumeJsonText(resume);
    const parsed = JSON.parse(text);

    expect(parsed.schemaVersion).toBe(RESUME_SCHEMA_VERSION);
    expect(parsed.resume.contact.fullName).toBe('Jordan Rivera');
    expect(parsed.resume.experience).toHaveLength(2);
    expect(parsed.resume.style.sectionOrder).toEqual(resume.style.sectionOrder);
    expect(typeof parsed.exportedAt).toBe('string');
    expect(text.endsWith('\n')).toBe(true);
    expect(resumeJsonBlob(resume).size).toBe(new TextEncoder().encode(text).byteLength);
  });
});

describe('exportJson', () => {
  it('downloads "<Name> Resume.json"', () => {
    const { created, clicks, revokeObjectURL } = stubDownloads();
    const resume = createSampleResume();

    exportJson(resume);

    expect(clicks).toHaveLength(1);
    expect(clicks[0]?.download).toBe('Jordan Rivera Resume.json');
    expect(clicks[0]?.href).toContain('blob:mock/');
    expect(created[0]?.type).toBe('application/json');
    expect(created[0]?.size).toBe(new TextEncoder().encode(resumeJsonText(resume)).byteLength);

    // The anchor is a means to an end and must not linger in the document.
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});

describe('downloadBlob', () => {
  it('names the file exactly as asked', () => {
    const { clicks } = stubDownloads();
    downloadBlob(new Blob(['x'], { type: 'text/plain' }), 'Ana-María Resume.docx');
    expect(clicks[0]?.download).toBe('Ana-María Resume.docx');
  });

  it('matches resumeFileName output for each format', () => {
    const resume = createSampleResume();
    expect(resumeFileName(resume, 'json')).toBe('Jordan Rivera Resume.json');
    expect(resumeFileName(resume, 'docx')).toBe('Jordan Rivera Resume.docx');
    expect(resumeFileName(resume, '')).toBe('Jordan Rivera Resume');
  });
});
