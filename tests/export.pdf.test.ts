// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSampleResume } from '@/lib/resume/defaults';
import { exportPdf } from '@/lib/export/pdf';

afterEach(() => {
  document.body.innerHTML = '';
  document.head.querySelectorAll('style[data-test], link[data-test]').forEach((node) => node.remove());
  vi.restoreAllMocks();
});

/**
 * `exportPdf` appends the iframe synchronously before its first `await`, so the test can grab it
 * and stub `print()` (jsdom has no printer) before the export gets that far.
 */
function startExport(resume = createSampleResume()) {
  const promise = exportPdf(resume, { readyTimeoutMs: 300, cleanupTimeoutMs: 200 });
  const iframe = document.querySelector('iframe') as HTMLIFrameElement;
  const win = iframe.contentWindow as Window;
  const print = vi.fn();
  const focus = vi.fn();
  Object.defineProperty(win, 'print', { value: print, configurable: true });
  Object.defineProperty(win, 'focus', { value: focus, configurable: true });
  return { promise, iframe, win, print, focus };
}

describe('exportPdf', () => {
  it('mounts the resume at true size in a hidden same-origin iframe and prints it', async () => {
    const marker = document.createElement('style');
    marker.dataset.test = 'true';
    marker.textContent = '.rp-sheet { color: rebeccapurple; }';
    document.head.appendChild(marker);

    const { promise, iframe, print, focus } = startExport();
    await promise;

    const doc = iframe.contentDocument!;

    // The print document is titled so "Save as PDF" suggests the right file name.
    expect(doc.title).toBe('Jordan Rivera Resume');

    // The sheet is mounted, unscaled.
    const sheet = doc.querySelector('.rp-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    expect(sheet.textContent).toContain('Jordan Rivera');
    expect(doc.querySelector('.rp-preview')?.getAttribute('style')).toContain('--rp-scale: 1');

    // Host styles were copied across, plus our print overrides.
    const styles = Array.from(doc.head.querySelectorAll('style')).map((node) => node.textContent ?? '');
    expect(styles.some((css) => css.includes('rebeccapurple'))).toBe(true);
    expect(styles.some((css) => css.includes('@page') && css.includes('margin: 0'))).toBe(true);

    // Hidden off-screen rather than zero-sized, so the print layout is real.
    expect(iframe.getAttribute('aria-hidden')).toBe('true');
    expect(iframe.style.position).toBe('fixed');
    expect(iframe.style.width).toBe('8.5in');

    expect(focus).toHaveBeenCalled();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('uses the A4 @page rule when the resume is A4', async () => {
    const resume = createSampleResume();
    resume.style = { ...resume.style, pageSize: 'a4' };

    const { promise, iframe } = startExport(resume);
    await promise;

    const css = Array.from(iframe.contentDocument!.head.querySelectorAll('style'))
      .map((node) => node.textContent ?? '')
      .join('\n');
    expect(css).toContain('size: A4');
    expect(iframe.style.width).toBe('210mm');
  });

  it('removes the iframe as soon as the browser reports afterprint', async () => {
    const { promise, iframe, win } = startExport();
    await promise;

    expect(document.body.contains(iframe)).toBe(true);
    win.dispatchEvent(new Event('afterprint'));
    expect(document.body.contains(iframe)).toBe(false);
  });

  it('cleans up on a timeout when afterprint never fires', async () => {
    const { promise, iframe } = startExport();
    await promise;

    expect(document.body.contains(iframe)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(document.body.contains(iframe)).toBe(false);
  });

  it('leaves no iframe behind when something goes wrong', async () => {
    const resume = createSampleResume();
    const promise = exportPdf(resume, { readyTimeoutMs: 50, cleanupTimeoutMs: 100 });
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    Object.defineProperty(iframe.contentWindow as Window, 'print', {
      value: () => {
        throw new Error('printer on fire');
      },
      configurable: true,
    });
    Object.defineProperty(iframe.contentWindow as Window, 'focus', { value: () => {}, configurable: true });

    await expect(promise).rejects.toThrow('printer on fire');
    expect(document.querySelector('iframe')).toBeNull();
  });
});
