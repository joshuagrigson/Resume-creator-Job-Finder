/**
 * File naming + the browser download primitive shared by the DOCX and JSON exports.
 */

import type { Resume } from '@shared/types';

/**
 * Reserved on Windows and/or awkward on macOS and Linux. Hyphens, apostrophes and accented
 * letters survive — plenty of people have them in their name.
 */
const RESERVED_FILENAME_CHARS = '\\/:*?"<>|';

function sanitizeBase(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f || RESERVED_FILENAME_CHARS.includes(char) ? ' ' : char;
  }
  return out
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+/, '')
    .replace(/[.\s]+$/, '')
    .slice(0, 90)
    .trim();
}

/**
 * `"Jordan Rivera Resume.pdf"`.
 *
 * Uses the person's name, falls back to the resume's internal label, then to `"Resume"`.
 * A base that already ends in "resume" is not doubled up. `ext` may be given with or without a
 * leading dot; pass `''` for a bare title — that is what `exportPdf` sets as the print document
 * title, so the browser suggests "Jordan Rivera Resume.pdf" in its Save-as-PDF dialog.
 */
export function resumeFileName(resume: Resume, ext = ''): string {
  const fromContact = sanitizeBase(resume?.contact?.fullName ?? '');
  const fromLabel = sanitizeBase(resume?.name ?? '');
  const base = fromContact || fromLabel || 'Resume';

  const title = /resume$/i.test(base) ? base : `${base} Resume`;
  const suffix = ext ? (ext.startsWith('.') ? ext : `.${ext}`) : '';
  return `${title}${suffix}`;
}

/** Triggers a browser download for a Blob. Throws outside a DOM. */
export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    throw new Error('Downloads are only available in a browser.');
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the transfer before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
