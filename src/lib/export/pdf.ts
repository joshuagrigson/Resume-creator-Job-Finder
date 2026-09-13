/**
 * PDF export — via the browser's own print-to-PDF, which is the only way to get real, selectable,
 * ATS-readable text without shipping a PDF engine.
 *
 * Approach: a hidden same-origin iframe. We copy every `<link rel=stylesheet>` and `<style>` from
 * the host page into it (same-origin, so this is allowed — `document.styleSheets` rules could not
 * be read across origins), mount the preview at true paper size with React, wait for fonts and a
 * layout frame, set the iframe document's title so "Save as PDF" suggests "<Name> Resume.pdf",
 * and print *that* window. The app around it is never involved, so nothing of the UI can leak
 * onto the page and the user's scroll position is untouched.
 */

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { PageSize, Resume } from '@shared/types';
import { ResumePreview } from '@/components/resume-preview/ResumePreview';
import { resumeFileName } from './file';

const PAGE_CSS_SIZE: Record<PageSize, { css: string; width: string; height: string }> = {
  letter: { css: 'letter', width: '8.5in', height: '11in' },
  a4: { css: 'A4', width: '210mm', height: '297mm' },
};

export interface ExportPdfOptions {
  /** How long to wait for stylesheets and fonts before printing anyway. */
  readyTimeoutMs?: number;
  /** Safety net for browsers that never fire `afterprint`. */
  cleanupTimeoutMs?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolves once `predicate()` is true, or after `timeoutMs`. */
async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await delay(16);
  }
}

/**
 * Copies the host page's stylesheets into the iframe. Returns promises that settle when the
 * linked sheets have loaded, so we do not print an unstyled page.
 */
function copyStyles(target: Document, timeoutMs: number): Promise<void>[] {
  const pending: Promise<void>[] = [];
  const nodes = document.querySelectorAll('link[rel="stylesheet"], style');

  nodes.forEach((node) => {
    const clone = target.importNode(node, true) as HTMLElement;
    target.head.appendChild(clone);
    if (node.tagName !== 'LINK') return;
    pending.push(
      new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        clone.addEventListener('load', done, { once: true });
        clone.addEventListener('error', done, { once: true });
        setTimeout(done, timeoutMs);
      }),
    );
  });

  return pending;
}

function printOverrides(pageSize: PageSize): string {
  const page = PAGE_CSS_SIZE[pageSize];
  return [
    `@page { size: ${page.css}; margin: 0; }`,
    'html, body { margin: 0; padding: 0; background: #ffffff; }',
    'body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    /* The sheet prints at true size: no scale wrapper, no shadow, no forced page height. */
    '.rp-preview { position: static !important; overflow: visible !important; width: auto !important;',
    '  height: auto !important; max-width: none !important; margin: 0 !important; }',
    '.rp-sheet { position: static !important; transform: none !important; box-shadow: none !important;',
    '  margin: 0 !important; }',
    '.no-print { display: none !important; }',
  ].join('\n');
}

/**
 * Opens the browser's print dialog for this resume. Resolves once the dialog has been requested;
 * the hidden iframe removes itself after printing.
 */
export async function exportPdf(resume: Resume, options: ExportPdfOptions = {}): Promise<void> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('PDF export is only available in a browser.');
  }

  const readyTimeoutMs = options.readyTimeoutMs ?? 3000;
  const cleanupTimeoutMs = options.cleanupTimeoutMs ?? 60_000;
  const pageSize: PageSize = resume.style?.pageSize === 'a4' ? 'a4' : 'letter';
  const page = PAGE_CSS_SIZE[pageSize];

  const iframe = document.createElement('iframe');
  iframe.title = 'Resume print document';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  // Off-screen rather than zero-sized: the iframe still needs a real layout viewport,
  // otherwise the printed page can come out blank or reflowed.
  iframe.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${page.width}`,
    `height:${page.height}`,
    'border:0',
    'opacity:0',
    'pointer-events:none',
  ].join(';');

  document.body.appendChild(iframe);

  let root: Root | null = null;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      root?.unmount();
    } catch {
      /* the iframe is going away regardless */
    }
    iframe.remove();
  };

  try {
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) throw new Error('Could not open a print document.');

    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    doc.close();

    const printDoc = iframe.contentDocument ?? doc;
    const printWin = iframe.contentWindow ?? win;

    const stylesReady = copyStyles(printDoc, readyTimeoutMs);

    const overrides = printDoc.createElement('style');
    overrides.textContent = printOverrides(pageSize);
    printDoc.head.appendChild(overrides);

    printDoc.title = resumeFileName(resume, '');

    const container = printDoc.createElement('div');
    container.className = 'rp-print-root';
    printDoc.body.appendChild(container);

    root = createRoot(container);
    root.render(createElement(ResumePreview, { resume, scale: 1, pageRule: false }));

    // React 19 renders concurrently — wait for the sheet to actually exist.
    await waitFor(() => container.querySelector('.rp-sheet') !== null, readyTimeoutMs);
    await Promise.all(stylesReady);

    const fonts = (printDoc as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      await Promise.race([fonts.ready, delay(readyTimeoutMs)]);
    }

    // One more frame so the final layout is committed before the print snapshot.
    await new Promise<void>((resolve) => {
      const raf = printWin.requestAnimationFrame?.bind(printWin) ?? window.requestAnimationFrame.bind(window);
      raf(() => raf(() => resolve()));
    });

    printWin.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, cleanupTimeoutMs);

    printWin.focus();
    printWin.print();
  } catch (error) {
    cleanup();
    throw error instanceof Error ? error : new Error('PDF export failed.');
  }
}
