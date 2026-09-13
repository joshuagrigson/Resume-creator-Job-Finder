/**
 * Resume export — PDF (browser print), DOCX (`docx` package) and JSON (our own schema).
 *
 *   import { exportPdf, exportDocx, exportJson, resumeFileName } from '@/lib/export';
 *
 * All three read the same document model (`resumeSections`), so the section order, hidden
 * sections and custom sections are identical across every format and the on-screen preview.
 */

export { exportPdf, type ExportPdfOptions } from './pdf';
export { exportDocx, resumeDocxBlob, buildResumeDocument } from './docx';
export { exportJson, resumeJsonBlob, buildResumeJson, type ResumeJsonExport } from './json';
export { resumeFileName, downloadBlob } from './file';

export {
  resumeSections,
  sectionItems,
  contactEntries,
  contactLine,
  DEFAULT_SECTION_TITLES,
  type ResumeSection,
  type SectionKind,
  type ContactEntry,
} from './format';

export { normalizeHex, hexForDocx, readableOnPaper, tint, shade, DEFAULT_ACCENT } from './color';
