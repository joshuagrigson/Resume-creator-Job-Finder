import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import type { TrackedJob } from '@shared/types';
import { APPLICATION_STATUS_LABELS } from '@shared/types';
import { Badge, Card, EmptyState } from '@/components/ui';
import { daysUntil, formatDueLabel } from './utils';
import './dashboard.css';

export interface FollowUpsCardProps {
  tracked: TrackedJob[];
  /** How far ahead to look. Defaults to a week. */
  withinDays?: number;
  className?: string;
}

/** Tracked applications whose follow-up date is overdue or lands inside the window. */
export function FollowUpsCard({ tracked, withinDays = 7, className }: FollowUpsCardProps) {
  const due = useMemo(() => {
    return tracked
      .map((item) => ({ item, days: daysUntil(item.followUpOn) }))
      .filter((entry): entry is { item: TrackedJob; days: number } => entry.days !== null && entry.days <= withinDays)
      .sort((a, b) => a.days - b.days || a.item.job.title.localeCompare(b.item.job.title));
  }, [tracked, withinDays]);

  const overdue = due.filter((entry) => entry.days < 0).length;

  return (
    <Card
      className={className}
      title="Follow-ups"
      subtitle={due.length === 0 ? 'Next 7 days' : `${due.length} due${overdue > 0 ? ` · ${overdue} overdue` : ''}`}
      footer={
        <Link className="small" to="/tracker">
          Manage follow-ups
        </Link>
      }
    >
      {due.length === 0 ? (
        <EmptyState
          plain
          size="sm"
          icon={<CalendarClock size={20} aria-hidden="true" />}
          title="Nothing due this week"
          description="Set a follow-up date on a tracked application and it will surface here a week ahead."
        />
      ) : (
        <ul className="db-list">
          {due.map(({ item, days }) => (
            <li key={item.job.id}>
              <Link className="db-item" to="/tracker">
                <span className="db-item__body">
                  <span className="db-item__title truncate">{item.job.title}</span>
                  <span className="db-item__meta truncate">
                    {item.job.company} · {APPLICATION_STATUS_LABELS[item.status]}
                  </span>
                </span>
                <span className="db-item__side">
                  <Badge tone={days < 0 ? 'danger' : days <= 1 ? 'warning' : 'neutral'} variant="soft" dot>
                    {formatDueLabel(days)}
                  </Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default FollowUpsCard;
