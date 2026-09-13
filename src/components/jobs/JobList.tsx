import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, SearchX } from 'lucide-react';
import type { Job, MatchResult } from '@shared/types';
import { Button, EmptyState, Skeleton, SkeletonText } from '@/components/ui';
import { JobCard } from './JobCard';
import './jobs.css';

export interface JobListProps {
  jobs: readonly Job[];
  matches: Map<string, MatchResult>;
  loading?: boolean;
  error?: string | null;
  selectedJobId?: string | null;
  /** Ids of jobs already in the tracker, and those already marked applied. */
  savedIds: ReadonlySet<string>;
  appliedIds: ReadonlySet<string>;
  skeletonCount?: number;
  onOpen: (job: Job) => void;
  onSelect: (job: Job) => void;
  onToggleSave: (job: Job) => void;
  onMarkApplied: (job: Job) => void;
  onRetry: () => void;
  /** Rendered when there are no results and no error (the page decides the wording). */
  emptyState?: ReactNode;
}

function CardSkeleton() {
  return (
    <li className="jf-skeleton">
      <div className="jf-skeleton__top">
        <Skeleton variant="circle" width={40} height={40} />
        <div style={{ flex: '1 1 auto', display: 'grid', gap: 'var(--space-2)' }}>
          <Skeleton width="55%" height={14} />
          <Skeleton width="35%" height={11} />
        </div>
      </div>
      <SkeletonText lines={2} label="Loading jobs" />
    </li>
  );
}

/**
 * The results list. Handles its own loading skeletons, error and empty states, plus
 * roving arrow-key focus between cards (Enter opens the focused job).
 */
export function JobList({
  jobs,
  matches,
  loading = false,
  error = null,
  selectedJobId = null,
  savedIds,
  appliedIds,
  skeletonCount = 5,
  onOpen,
  onSelect,
  onToggleSave,
  onMarkApplied,
  onRetry,
  emptyState,
}: JobListProps) {
  const titleRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    titleRefs.current.length = jobs.length;
  }, [jobs.length]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const active = document.activeElement;
      const index = titleRefs.current.findIndex((el) => el === active);
      if (index === -1) return;
      const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
      if (next < 0 || next >= jobs.length) return;
      event.preventDefault();
      titleRefs.current[next]?.focus();
      const job = jobs[next];
      if (job) onSelect(job);
    },
    [jobs, onSelect],
  );

  if (loading) {
    return (
      <ul className="jf-list" aria-busy="true" aria-label="Loading job results">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle size={20} />}
        title="That search could not be completed"
        description={error}
        actions={
          <Button variant="primary" leftIcon={<RotateCcw size={15} />} onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  }

  if (jobs.length === 0) {
    return (
      <>
        {emptyState ?? (
          <EmptyState
            icon={<SearchX size={20} />}
            title="No jobs matched those filters"
            description="Try fewer keywords, a wider posted-within window, or turn off Remote only."
          />
        )}
      </>
    );
  }

  return (
    <ul className="jf-list" aria-label="Job results" onKeyDown={handleKeyDown}>
      {jobs.map((job, i) => (
        <li key={job.id}>
          <JobCard
            ref={(el) => {
              titleRefs.current[i] = el;
            }}
            job={job}
            match={matches.get(job.id)}
            selected={job.id === selectedJobId}
            saved={savedIds.has(job.id)}
            applied={appliedIds.has(job.id)}
            onOpen={onOpen}
            onToggleSave={onToggleSave}
            onMarkApplied={onMarkApplied}
          />
        </li>
      ))}
    </ul>
  );
}
