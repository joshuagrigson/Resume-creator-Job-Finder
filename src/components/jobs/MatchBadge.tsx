import type { MatchResult } from '@shared/types';
import { matchLabel } from '@shared/match';
import { MatchTone, ScoreRing } from '@/components/ui';
import './jobs.css';

export interface MatchBadgeProps {
  match: MatchResult | undefined;
  /** `ring` for the detail panel, `badge` for cards. */
  variant?: 'badge' | 'ring';
  size?: number;
  className?: string;
}

/**
 * Resume↔job match indicator. Renders nothing when there is no resume to score against,
 * so callers can drop it in unconditionally.
 */
export function MatchBadge({ match, variant = 'badge', size = 64, className }: MatchBadgeProps) {
  if (!match) return null;
  const { label, tone } = matchLabel(match.score);

  if (variant === 'ring') {
    return <ScoreRing name="Resume match" value={match.score} tone={tone} size={size} label={label} className={className} />;
  }

  return <MatchTone score={match.score} label={label} tone={tone} className={className} />;
}
