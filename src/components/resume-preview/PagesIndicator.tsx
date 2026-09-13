/**
 * PagesIndicator — a rough "how long is this?" chip for the editor toolbar.
 *
 * It is a word-count estimate, not a layout measurement, so it says "about" and never
 * contradicts the printed page count loudly. Density and font size nudge the estimate the same
 * way they nudge the real page.
 */

import type { Resume } from '@shared/types';
import { WORDS_PER_PAGE } from '@/lib/resume/ats';
import { resumeToPlainText } from '@/lib/resume/profile';
import { cx } from '@/components/ui';

export interface PagesIndicatorProps {
  resume: Resume;
  className?: string;
}

const DENSITY_FACTOR = { compact: 1.18, normal: 1, relaxed: 0.84 } as const;

/** Estimated printed pages, minimum 1, rounded to a half page. */
export function estimatePages(resume: Resume): number {
  const words = resumeToPlainText(resume).split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1;

  const density = DENSITY_FACTOR[resume.style?.density ?? 'normal'] ?? 1;
  const fontSize = Number(resume.style?.fontSize);
  const sizeFactor = Number.isFinite(fontSize) && fontSize > 0 ? 10.5 / Math.min(14, Math.max(8, fontSize)) : 1;
  const perPage = WORDS_PER_PAGE * density * sizeFactor;

  return Math.max(1, Math.round((words / perPage) * 2) / 2);
}

export function PagesIndicator({ resume, className }: PagesIndicatorProps) {
  const pages = estimatePages(resume);
  const label = pages === 1 ? '1 page' : `${pages} pages`;
  return (
    <span className={cx('rp-pages', className)} title="Estimated from word count">
      About {label}
    </span>
  );
}

export default PagesIndicator;
