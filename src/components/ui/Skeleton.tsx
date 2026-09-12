import type { CSSProperties } from 'react';
import { cx } from './utils';
import './surfaces.css';

export interface SkeletonProps {
  /** CSS width, e.g. 200, '60%'. */
  width?: number | string;
  height?: number | string;
  variant?: 'block' | 'text' | 'circle';
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
}

/** Loading placeholder. Purely decorative — it is hidden from assistive tech. */
export function Skeleton({ width, height, variant = 'block', radius, className, style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cx('ui-skeleton', variant !== 'block' && `ui-skeleton--${variant}`, className)}
      style={{
        width: width ?? (variant === 'text' ? '100%' : undefined),
        height: height ?? (variant === 'circle' ? width : undefined),
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

export interface SkeletonTextProps {
  /** Number of lines. The last line is rendered shorter. */
  lines?: number;
  className?: string;
  /** Accessible status text announced while loading. */
  label?: string;
}

/** A few skeleton lines with a polite live-region label. */
export function SkeletonText({ lines = 3, className, label = 'Loading' }: SkeletonTextProps) {
  return (
    <div className={cx('ui-skeleton-lines', className)} role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: Math.max(1, lines) }, (_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 && lines > 1 ? '62%' : '100%'} />
      ))}
    </div>
  );
}
