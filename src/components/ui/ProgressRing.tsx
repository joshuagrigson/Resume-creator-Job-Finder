import type { CSSProperties, ReactNode } from 'react';
import { clamp, cx } from './utils';
import { Badge, type BadgeTone } from './Badge';
import './surfaces.css';

export type ScoreTone = 'success' | 'info' | 'warning' | 'danger';

/** Shared 0–100 → tone mapping used by score rings and match badges. */
export function scoreTone(score: number): ScoreTone {
  const s = clamp(score, 0, 100);
  if (s >= 70) return 'success';
  if (s >= 55) return 'info';
  if (s >= 40) return 'warning';
  return 'danger';
}

/** Short human label for a 0–100 score. */
export function scoreLabel(score: number): 'Excellent' | 'Strong' | 'Good' | 'Fair' | 'Low' {
  const s = clamp(score, 0, 100);
  if (s >= 85) return 'Excellent';
  if (s >= 70) return 'Strong';
  if (s >= 55) return 'Good';
  if (s >= 40) return 'Fair';
  return 'Low';
}

/** Rings: brass for a strong score (the house metal), ink for good, amber for fair, red for real problems. */
const TONE_VAR: Record<ScoreTone | 'muted', string> = {
  muted: 'var(--color-text-subtle)',
  success: 'var(--color-metal)',
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
};

export interface ProgressRingProps {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  /** Outer diameter in pixels. */
  size?: number;
  /** Stroke width in pixels. */
  thickness?: number;
  /** Small caption under the number, e.g. "ATS". */
  label?: ReactNode;
  /** Override the automatic colour. */
  tone?: ScoreTone | 'accent' | 'muted';
  /** Hide the number in the middle (e.g. when rendering your own content). */
  hideValue?: boolean;
  /** Custom center content, replaces the number + label. */
  children?: ReactNode;
  /** Accessible name; defaults to "<value> out of 100". */
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

/** Circular 0–100 indicator (ATS score, match score). */
export function ProgressRing({
  value,
  size = 56,
  thickness = 6,
  label,
  tone,
  hideValue = false,
  children,
  ariaLabel,
  className,
  style,
}: ProgressRingProps) {
  const v = Math.round(clamp(value, 0, 100));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - v / 100);
  const color = tone === 'accent' ? 'var(--color-accent)' : TONE_VAR[tone ?? scoreTone(v)];
  const fontSize = size >= 96 ? 'var(--text-2xl)' : size >= 64 ? 'var(--text-xl)' : size >= 44 ? 'var(--text-base)' : 'var(--text-sm)';
  const ringStyle = {
    width: size,
    height: size,
    '--ring-color': color,
    '--ring-font': fontSize,
    '--ring-size': `${size}px`,
    ...style,
  } as CSSProperties;

  return (
    <div
      className={cx('ui-ring', className)}
      style={ringStyle}
      role="img"
      aria-label={ariaLabel ?? `${v} out of 100`}
    >
      <svg className="ui-ring__svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="ui-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
        />
        <circle
          className="ui-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ui-ring__center">
        {children ?? (
          <>
            {hideValue ? null : <span className="ui-ring__number">{v}</span>}
            {label ? <span className="ui-ring__label">{label}</span> : null}
          </>
        )}
      </div>
    </div>
  );
}

export interface ScoreRingProps extends Omit<ProgressRingProps, 'ariaLabel'> {
  /** What the score measures, used in the accessible name, e.g. "ATS score". */
  name?: string;
}

/** `ProgressRing` with a score-flavoured accessible name. */
export function ScoreRing({ name = 'Score', value, ...rest }: ScoreRingProps) {
  const v = Math.round(clamp(value, 0, 100));
  return <ProgressRing {...rest} value={v} ariaLabel={`${name}: ${v} out of 100 — ${scoreLabel(v)}`} />;
}

export interface MatchToneProps {
  /** 0–100 match score. */
  score: number;
  /** Override the computed label (e.g. from `matchLabel()` in shared/match). */
  label?: string;
  /** Override the computed tone. */
  tone?: ScoreTone | 'neutral';
  /** Show the numeric score next to the label. */
  showScore?: boolean;
  size?: 'sm' | 'lg';
  className?: string;
}

/** Badge that turns a 0–100 match score into "82% · Strong" with a matching tone. */
export function MatchTone({ score, label, tone, showScore = true, size = 'sm', className }: MatchToneProps) {
  const v = Math.round(clamp(score, 0, 100));
  const auto = tone ?? scoreTone(v);
  // A strong score wears the house metal rather than a traffic-light green.
  const resolvedTone: BadgeTone = auto === 'success' ? 'metal' : auto;
  const text = label ?? scoreLabel(v);
  return (
    <Badge tone={resolvedTone} variant="soft" size={size} dot className={className}>
      {showScore ? `${v}% · ${text}` : text}
    </Badge>
  );
}
