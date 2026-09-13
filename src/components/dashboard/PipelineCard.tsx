import { Link } from 'react-router-dom';
import { Kanban } from 'lucide-react';
import type { ApplicationStatus, TrackedJob } from '@shared/types';
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from '@shared/types';
import { Card, EmptyState } from '@/components/ui';
import './dashboard.css';

export interface PipelineCardProps {
  tracked: TrackedJob[];
  className?: string;
}

/** Counts per application status with a stacked bar, linking into the tracker board. */
export function PipelineCard({ tracked, className }: PipelineCardProps) {
  const counts = {} as Record<ApplicationStatus, number>;
  for (const status of APPLICATION_STATUSES) counts[status] = 0;
  for (const item of tracked) counts[item.status] = (counts[item.status] ?? 0) + 1;

  const total = tracked.length;
  const active = total - counts.archived;

  return (
    <Card
      className={className}
      title="Pipeline"
      subtitle={total === 0 ? 'Nothing tracked yet' : `${active} active · ${total} total`}
      footer={
        <Link className="small" to="/tracker">
          Open the tracker
        </Link>
      }
    >
      {total === 0 ? (
        <EmptyState
          plain
          size="sm"
          icon={<Kanban size={20} aria-hidden="true" />}
          title="No applications tracked"
          description="Save a job from the finder and it shows up here as a card you can move through the pipeline."
          actions={
            <Link className="small" to="/jobs">
              Find jobs to save
            </Link>
          }
        />
      ) : (
        <>
          <div className="db-pipeline__bar" role="presentation">
            {APPLICATION_STATUSES.filter((s) => counts[s] > 0).map((status) => (
              <span
                key={status}
                className={`db-pipeline__seg db-pipeline__seg--${status}`}
                style={{ width: `${(counts[status] / total) * 100}%` }}
              />
            ))}
          </div>

          <ul className="db-pipeline">
            {APPLICATION_STATUSES.map((status) => (
              <li key={status}>
                <Link className="db-pipeline__row" to="/tracker">
                  <span className="db-pipeline__name">
                    <span className={`db-pipeline__dot db-pipeline__dot--${status}`} aria-hidden="true" />
                    <span className="truncate">{APPLICATION_STATUS_LABELS[status]}</span>
                  </span>
                  <span className="db-pipeline__count">
                    {counts[status]}
                    <span className="visually-hidden"> {APPLICATION_STATUS_LABELS[status].toLowerCase()}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export default PipelineCard;
