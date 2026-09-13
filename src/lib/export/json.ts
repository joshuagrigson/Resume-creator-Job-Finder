/**
 * JSON export — the portable, loss-free format. `normalizeImportedResume()` reads this shape
 * straight back in, and the `schemaVersion` field lets a future migration recognise it.
 */

import type { Resume } from '@shared/types';
import { RESUME_SCHEMA_VERSION } from '@shared/types';
import { downloadBlob, resumeFileName } from './file';

export interface ResumeJsonExport {
  schemaVersion: number;
  /** ISO timestamp of the export. */
  exportedAt: string;
  resume: Resume;
}

/** The exact object written to disk — exposed so tests and the Settings backup can reuse it. */
export function buildResumeJson(resume: Resume, now: Date = new Date()): ResumeJsonExport {
  return {
    schemaVersion: RESUME_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    resume,
  };
}

export function resumeJsonBlob(resume: Resume): Blob {
  const text = `${JSON.stringify(buildResumeJson(resume), null, 2)}\n`;
  return new Blob([text], { type: 'application/json' });
}

/** Downloads `"<Name> Resume.json"`. */
export function exportJson(resume: Resume): void {
  downloadBlob(resumeJsonBlob(resume), resumeFileName(resume, 'json'));
}
