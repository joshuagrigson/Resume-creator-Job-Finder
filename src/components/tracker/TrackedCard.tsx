import { memo, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Building2, CalendarClock, ExternalLink, GripVertical } from 'lucide-react';
import type { ApplicationStatus, TrackedJob } from '@shared/types';
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from '@shared/types';
import { Badge, MatchTone, Select, cx } from '@/components/ui';
import { ageLabel, followUpLabel, isFollowUpOverdue } from './utils';

export interface TrackedCardProps {
  entry: TrackedJob;
  /** 0–100 match against the active resume, or null when there is no resume yet. */
  matchScore: number | null;
  onOpen: (jobId: string) => void;
  onStatusChange: (jobId: string, status: ApplicationStatus) => void;
  className?: string;
}

const STATUS_OPTIONS = APPLICATION_STATUSES.map((status) => ({
  value: status,
  label: APPLICATION_STATUS_LABELS[status],
}));

interface CardShellProps {
  entry: TrackedJob;
  matchScore: number | null;
  /** Drag handle; omitted in the drag overlay. */
  handle?: ReactNode;
  /** Interactive footer; omitted in the drag overlay. */
  controls?: ReactNode;
  onOpen?: (jobId: string) => void;
  nodeRef?: Ref<HTMLElement>;
  className?: string;
  rest?: HTMLAttributes<HTMLElement>;
}

/** Presentational card. Used both in a column and inside the drag overlay. */
function CardShell({ entry, matchScore, handle, controls, onOpen, nodeRef, className, rest }: CardShellProps) {
  const { job } = entry;
  const overdue = isFollowUpOverdue(entry.followUpOn);
  const follow = followUpLabel(entry.followUpOn);

  return (
    <article ref={nodeRef} className={cx('tr-card', className)} aria-label={`${job.title} at ${job.company}`} {...rest}>
      <div className="tr-card-top">
        {handle}
        {onOpen ? (
          <button type="button" className="tr-card-open" onClick={() => onOpen(job.id)}>
            <span className="tr-card-title">{job.title}</span>
            <span className="tr-card-company">
              <Building2 size={12} aria-hidden="true" />
              {job.company || 'Unknown company'}
            </span>
          </button>
        ) : (
          <span className="tr-card-open">
            <span className="tr-card-title">{job.title}</span>
            <span className="tr-card-company">
              <Building2 size={12} aria-hidden="true" />
              {job.company || 'Unknown company'}
            </span>
          </span>
        )}
      </div>

      <div className="tr-card-meta">
        {matchScore !== null && <MatchTone score={matchScore} size="sm" showScore />}
        <span className="tr-card-age">{ageLabel(entry)}</span>
      </div>

      {follow && (
        <Badge tone={overdue ? 'danger' : 'neutral'} variant="soft" size="sm" leftIcon={<CalendarClock size={11} />}>
          {follow}
        </Badge>
      )}

      {controls}
    </article>
  );
}

/**
 * One application in the board. The body opens the detail drawer, the grip is the drag handle
 * (pointer + keyboard), and the status select is the always-available fallback for people who
 * cannot or do not want to drag.
 */
function TrackedCardImpl({ entry, matchScore, onOpen, onStatusChange, className }: TrackedCardProps) {
  const { job } = entry;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id });

  return (
    <CardShell
      entry={entry}
      matchScore={matchScore}
      onOpen={onOpen}
      nodeRef={setNodeRef}
      className={cx(isDragging && 'tr-card-dragging', className)}
      handle={
        <button
          type="button"
          className="tr-grip"
          aria-label={`Move ${job.title} to another column`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
      }
      controls={
        <div className="tr-card-actions">
          <label className="visually-hidden" htmlFor={`tr-status-${job.id}`}>
            Status for {job.title}
          </label>
          <Select
            id={`tr-status-${job.id}`}
            uiSize="sm"
            value={entry.status}
            options={STATUS_OPTIONS}
            onChange={(e) => onStatusChange(job.id, e.target.value as ApplicationStatus)}
          />
          {job.url && (
            <a
              className="tr-card-link"
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open the ${job.title} posting on ${job.source}`}
            >
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
        </div>
      }
    />
  );
}

export const TrackedCard = memo(TrackedCardImpl);

/** The card as it looks under the cursor while dragging — no controls, no drag wiring. */
export function TrackedCardPreview({ entry, matchScore }: { entry: TrackedJob; matchScore: number | null }) {
  return <CardShell entry={entry} matchScore={matchScore} className="tr-card-overlay" />;
}
