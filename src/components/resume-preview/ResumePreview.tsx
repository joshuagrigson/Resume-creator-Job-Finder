/**
 * ResumePreview — a real, page-sized sheet.
 *
 * The sheet is always laid out at true paper size (8.5×11in, or 210×297mm for A4) with the
 * margins drawn by us, so what you see is exactly what prints. On screen it is shrunk with a
 * CSS transform; the wrapper reserves the *scaled* box (measured with a ResizeObserver so a
 * two-page resume still reserves the right height) which keeps the surrounding layout honest.
 *
 * In print the transform is dropped and the sheet renders at true size — see preview.css.
 */

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Density, FontChoice, PageSize, Resume } from '@shared/types';
import { cx } from '@/components/ui';
import { resumeSections } from '@/lib/export/format';
import { normalizeHex, readableOnPaper, shade, tint } from '@/lib/export/color';
import { templateComponent } from './templates';
import './preview.css';
import './templates.css';

export interface ResumePreviewProps {
  resume: Resume;
  /** Screen scale, 0.1–2. `1` = true paper size (used for printing). */
  scale?: number;
  className?: string;
  id?: string;
  /**
   * Emit the `@page` rule that matches the resume's paper size. Keep the default when the
   * preview is what the browser prints; pass `false` when the host page owns `@page`.
   */
  pageRule?: boolean;
  /** Accessible name for the sheet. Defaults to "Resume preview — <name>". */
  label?: string;
}

interface PageSpec {
  width: string;
  height: string;
  /** Value for the CSS `@page { size: … }` descriptor. */
  cssSize: string;
}

export const PAGE_SPECS: Record<PageSize, PageSpec> = {
  letter: { width: '8.5in', height: '11in', cssSize: 'letter' },
  a4: { width: '210mm', height: '297mm', cssSize: 'A4' },
};

interface DensitySpec {
  /** Page margin we draw ourselves. */
  pad: string;
  sectionGap: string;
  itemGap: string;
  bulletGap: string;
  leading: string;
}

export const DENSITY_SPECS: Record<Density, DensitySpec> = {
  compact: { pad: '0.6in', sectionGap: '0.85em', itemGap: '0.55em', bulletGap: '0.16em', leading: '1.3' },
  normal: { pad: '0.68in', sectionGap: '1.15em', itemGap: '0.8em', bulletGap: '0.26em', leading: '1.42' },
  relaxed: { pad: '0.75in', sectionGap: '1.5em', itemGap: '1.05em', bulletGap: '0.36em', leading: '1.58' },
};

const FONT_SANS =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif";
const FONT_SERIF = "Georgia, 'Times New Roman', 'Liberation Serif', Times, serif";

export const FONT_STACKS: Record<FontChoice, { body: string; heading: string }> = {
  sans: { body: FONT_SANS, heading: FONT_SANS },
  serif: { body: FONT_SERIF, heading: FONT_SERIF },
  mixed: { body: FONT_SANS, heading: FONT_SERIF },
};

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function ResumePreview({ resume, scale = 1, className, id, pageRule = true, label }: ResumePreviewProps) {
  const style = resume.style;
  const pageSize: PageSize = style?.pageSize === 'a4' ? 'a4' : 'letter';
  const density: Density = DENSITY_SPECS[style?.density as Density] ? (style.density as Density) : 'normal';
  const font: FontChoice = FONT_STACKS[style?.font as FontChoice] ? (style.font as FontChoice) : 'sans';
  const template = style?.template ?? 'modern';

  const page = PAGE_SPECS[pageSize];
  const densitySpec = DENSITY_SPECS[density];
  const fonts = FONT_STACKS[font];
  const safeScale = clampNumber(scale, 0.1, 2, 1);
  const fontSize = clampNumber(Number(style?.fontSize), 8, 14, 10.5);

  const accent = normalizeHex(style?.accentColor);
  const accentText = readableOnPaper(accent);

  const sections = useMemo(() => resumeSections(resume), [resume]);
  const Template = templateComponent(template);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [sheetHeight, setSheetHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = sheetRef.current;
    if (!element) return;
    const measure = () => {
      const height = element.offsetHeight;
      setSheetHeight((previous) => (height > 0 && height !== previous ? height : previous));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [resume, pageSize, density, font, fontSize, template]);

  const vars = {
    '--rp-scale': String(safeScale),
    '--rp-page-w': page.width,
    '--rp-page-h': page.height,
    '--rp-pad': densitySpec.pad,
    '--rp-section-gap': densitySpec.sectionGap,
    '--rp-item-gap': densitySpec.itemGap,
    '--rp-bullet-gap': densitySpec.bulletGap,
    '--rp-leading': densitySpec.leading,
    '--rp-font-body': fonts.body,
    '--rp-font-head': fonts.heading,
    '--rp-accent': accent,
    '--rp-accent-text': accentText,
    '--rp-accent-tint': tint(accent, 0.09),
    '--rp-accent-tint-strong': tint(accent, 0.18),
    '--rp-accent-deep': shade(accent, 0.28),
  } as CSSProperties;

  const wrapperStyle: CSSProperties = {
    ...vars,
    width: `calc(${page.width} * ${safeScale})`,
    height: sheetHeight != null ? `${sheetHeight * safeScale}px` : `calc(${page.height} * ${safeScale})`,
  };

  const name = (resume.contact?.fullName ?? '').trim();
  const accessibleName = label ?? (name ? `Resume preview — ${name}` : 'Resume preview');

  return (
    <div
      className={cx('rp-preview', className)}
      style={wrapperStyle}
      data-template={template}
      data-page-size={pageSize}
      data-density={density}
      data-font={font}
    >
      {pageRule ? <style>{`@page{size:${page.cssSize};margin:0}`}</style> : null}
      <article
        ref={sheetRef}
        id={id}
        className={cx('rp-sheet', `rp-sheet--${template}`)}
        style={{ fontSize: `${fontSize}pt` }}
        aria-label={accessibleName}
      >
        {sections.length === 0 && !name ? (
          <p className="rp-blank">
            Your resume preview appears here. Add your name and a first role to get started.
          </p>
        ) : (
          <Template resume={resume} sections={sections} />
        )}
      </article>
    </div>
  );
}

export default ResumePreview;
