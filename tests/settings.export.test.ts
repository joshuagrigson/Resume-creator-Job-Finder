import { describe, expect, it } from 'vitest';
import { buildExportBundle, exportFileName } from '@/components/settings/DataPanel';
import { createBlankResume, createSampleResume } from '@/lib/resume/defaults';
import { normalizeImportedResume } from '@/lib/resume/validate';

describe('settings export bundle', () => {
  it('wraps every resume with the schema version and an export timestamp', () => {
    const resumes = [createSampleResume(), createBlankResume('Second')];
    const bundle = buildExportBundle(resumes, new Date('2026-09-13T10:00:00.000Z'));

    expect(bundle.app).toBe('launchpad');
    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.exportedAt).toBe('2026-09-13T10:00:00.000Z');
    expect(bundle.resumes).toHaveLength(2);
  });

  it('round-trips back through normalizeImportedResume', () => {
    const original = createSampleResume();
    const text = JSON.stringify(buildExportBundle([original]));

    const result = normalizeImportedResume(text);
    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.resume.contact.fullName).toBe(original.contact.fullName);
    expect(result.resume.experience).toHaveLength(original.experience.length);
    // A fresh id keeps an import from overwriting the resume it came from.
    expect(result.resume.id).not.toBe(original.id);
  });

  it('warns and takes the first resume when a bundle holds several', () => {
    const text = JSON.stringify(buildExportBundle([createSampleResume(), createBlankResume('Second')]));
    const result = normalizeImportedResume(text);

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.warnings.join(' ')).toMatch(/2 resumes/);
  });

  it('names the download with the export date', () => {
    expect(exportFileName(new Date(2026, 8, 3))).toBe('Launchpad resumes 2026-09-03.json');
  });
});
