/**
 * TemplateThumb — a tiny, purely decorative schematic of a template, for the editor's template
 * picker. CSS only (no SVG, no images) so it inherits the chosen accent colour and stays crisp
 * at any size. It carries no text, so it is hidden from assistive tech; the picker labels the
 * option itself.
 */

import type { CSSProperties } from 'react';
import type { TemplateId } from '@shared/types';
import { cx } from '@/components/ui';
import { normalizeHex, tint } from '@/lib/export/color';
import './thumb.css';

export interface TemplateThumbProps {
  templateId: TemplateId;
  /** Defaults to the app accent. */
  accentColor?: string;
  className?: string;
}

function Lines({ count, className }: { count: number; className?: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <i key={index} className={cx('rp-thumb-line', className)} />
      ))}
    </>
  );
}

function Block({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rp-thumb-block">
      <i className="rp-thumb-heading" />
      <Lines count={lines} />
    </div>
  );
}

export function TemplateThumb({ templateId, accentColor, className }: TemplateThumbProps) {
  const accent = normalizeHex(accentColor);
  const style = {
    '--rp-thumb-accent': accent,
    '--rp-thumb-tint': tint(accent, 0.16),
  } as CSSProperties;

  if (templateId === 'sidebar') {
    return (
      <span className={cx('rp-thumb', 'rp-thumb--sidebar', className)} style={style} aria-hidden="true">
        <span className="rp-thumb-col rp-thumb-col--aside">
          <i className="rp-thumb-line rp-thumb-line--short" />
          <i className="rp-thumb-line rp-thumb-line--short" />
          <i className="rp-thumb-heading" />
          <i className="rp-thumb-line rp-thumb-line--short" />
          <i className="rp-thumb-line rp-thumb-line--short" />
        </span>
        <span className="rp-thumb-col rp-thumb-col--main">
          <i className="rp-thumb-name" />
          <Block lines={2} />
          <Block lines={3} />
        </span>
      </span>
    );
  }

  return (
    <span className={cx('rp-thumb', `rp-thumb--${templateId}`, className)} style={style} aria-hidden="true">
      <span className="rp-thumb-head">
        <i className="rp-thumb-name" />
        <i className="rp-thumb-line rp-thumb-line--sub" />
      </span>
      <Block lines={2} />
      <Block lines={3} />
      <Block lines={2} />
    </span>
  );
}

export default TemplateThumb;
