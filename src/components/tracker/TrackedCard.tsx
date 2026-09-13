import { memo } from 'react';
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
  /** Rendered inside the drag overlay — no drag wiring, no interactive controls. */
  overlay?: boolean;
  className?: string;
}

const STATUS_OPTIONS = APPLICATION_STATUSES.map((status) => ({
  value: status,
  label: APPLICATION_STATUS_LABELS[status],
}));

/**
 * One application in the board. The body is a button (opens the detail drawer), the grip is the
 * drag handle (pointer + keyboard), and the status select is the always-available fallback for
 * people who cannot or do not want to drag.
 */
function TrackedCardImpl({ entry, matchScore, onOpen, onStatusChange, overlay = false, className }: TrackedCardProps) {
  const { job } = entry;
  const overdue = isFollowUpOverdue(entry.followUpOn);
  const followUp = followUpLabel(entry.followUpOn);

  const draggable = useDraggable({ id: job.id, disabled: overlay });
  const { attributes, listeners, setNodeRef, isDragging } = draggable;

  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      className={cx('tr-card', isDragging && 'tr-card-dragging', overlay && 'tr-card-overlay', className)}
      aria-label={`${job.title} at ${job.company}`}
    >
      <div className="tr-card-top">
        {!overlay && (
          <button
            type="button"
            className="tr-grip"
            aria-label={`Move ${job.title} to another column`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="tr-card-open" onClick={() => onOpen(job.id)} disabled={overlay}>
          <span className="tr-card-title">{job.title}</span>
          <span className="tr-card-company">
            <Building2 size={12} aria-hidden="true" />
            {job.company || 'Unknown company'}
          </span>
        </button>
      </div>

      <div className="tr-card-meta">
        {matchScore !== null && <MatchTone score={matchScore} size="sm" showScore />}
        <span className="tr-card-age">{ageLabel(entry)}</span>
      </div>

      {followUp && (
        <Badge tone={overdue ? 'danger' : 'neutral'} variant="soft" size="sm" leftIcon={<CalendarClock size={11} />}>
          {followUp}
        </Badge>
      )}

      {!overlay && (
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
      )}
    </article>
  );
}

export const TrackedCard = memo(TrackedCardImpl);
