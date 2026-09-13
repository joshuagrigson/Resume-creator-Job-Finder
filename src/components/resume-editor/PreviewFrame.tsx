/**
 * Live preview pane: measures itself and scales the page-sized sheet down to fit.
 *
 * `ResumePreview` reserves the scaled box itself, so all this component owns is the
 * measurement (a ResizeObserver on the pane) and the fit calculation.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PageSize, Resume } from '@shared/types';
import { ResumePreview } from '@/components/resume-preview/ResumePreview';

/** Paper widths in CSS pixels at 96dpi. */
export const PAGE_WIDTH_PX: Record<PageSize, number> = {
  letter: 816,
  a4: 794,
};

const MIN_SCALE = 0.25;

export interface PreviewFrameProps {
  resume: Resume;
  /** Extra horizontal breathing room subtracted from the measured width. */
  gutter?: number;
  className?: string;
}

export function PreviewFrame({ resume, gutter = 0, className }: PreviewFrameProps) {
  const paneRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = paneRef.current;
    if (!node) return;
    setWidth(node.clientWidth);
  }, []);

  useEffect(() => {
    const node = paneRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = entry.contentRect.width;
      setWidth((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pageWidth = PAGE_WIDTH_PX[resume.style?.pageSize ?? 'letter'] ?? PAGE_WIDTH_PX.letter;
  const available = Math.max(0, width - gutter);
  const scale = available > 0 ? Math.max(MIN_SCALE, Math.min(1, available / pageWidth)) : 1;

  return (
    <div ref={paneRef} className={['re-previewpane', className].filter(Boolean).join(' ')}>
      <div className="re-previewpane__stage">
        <ResumePreview resume={resume} scale={scale} label={`Live preview — ${resume.name}`} />
      </div>
    </div>
  );
}

export default PreviewFrame;
