import { forwardRef } from 'react';
import { Bookmark, BookmarkCheck, Building2, CheckCircle2, Clock, MapPin } from 'lucide-react';
import type { Job, MatchResult } from '@shared/types';
import { Badge, Button, Chip } from '@/components/ui';
import { MatchBadge } from './MatchBadge';
import { absoluteDate, companyInitial, formatSalary, locationLabel, relativeTime, sourceLabel } from './format';
import './jobs.css';

const MAX_TAGS = 4;

export interface JobCardProps {
  job: Job;
  match?: MatchResult;
  selected?: boolean;
  saved?: boolean;
  applied?: boolean;
  /** Opens the detail panel / sheet. */
  onOpen: (job: Job) => void;
  onToggleSave: (job: Job) => void;
  onMarkApplied: (job: Job) => void;
}

/** One search result. The title is the primary control; save/applied are secondary. */
export const JobCard = forwardRef<HTMLButtonElement, JobCardProps>(function JobCard(
  { job, match, selected = false, saved = false, applied = false, onOpen, onToggleSave, onMarkApplied },
  titleRef,
) {
  const salary = formatSalary(job.salary);
  const posted = relativeTime(job.postedAt);
  const tags = (job.tags ?? []).filter(Boolean);
  const extraTags = Math.max(0, tags.length - MAX_TAGS);

  return (
    <div className={selected ? 'jf-card jf-card--selected' : 'jf-card'} data-testid="job-card" data-job-id={job.id}>
      <div className="jf-card__top">
        <span className="jf-logo" aria-hidden="true">
          {companyInitial(job.company)}
        </span>

        <div className="jf-card__headings">
          <h3 className="jf-card__title">
            <button ref={titleRef} type="button" className="jf-card__title-btn" onClick={() => onOpen(job)}>
              {job.title}
            </button>
          </h3>
          <span className="jf-card__company">
            <Building2 className="jf-fact__icon" size={12} aria-hidden="true" /> {job.company || 'Company not listed'}
          </span>
        </div>

        <div className="jf-card__match">
          <MatchBadge match={match} />
        </div>
      </div>

      <div className="jf-card__facts">
        <span className="jf-fact">
          <MapPin className="jf-fact__icon" size={13} aria-hidden="true" />
          <span className="truncate">{locationLabel(job)}</span>
        </span>
        {job.remote ? (
          <Badge tone="info" variant="soft">
            Remote
          </Badge>
        ) : null}
        {posted ? (
          <span className="jf-fact" title={absoluteDate(job.postedAt)}>
            <Clock className="jf-fact__icon" size={13} aria-hidden="true" />
            {posted}
          </span>
        ) : null}
        {salary ? <span className="jf-fact jf-card__salary">{salary}</span> : null}
        <Badge tone="neutral" variant="outline">
          {sourceLabel(job.source)}
        </Badge>
      </div>

      {tags.length > 0 ? (
        <div className="jf-card__tags">
          {tags.slice(0, MAX_TAGS).map((tag) => (
            <Chip key={tag}>{tag}</Chip>
          ))}
          {extraTags > 0 ? <Chip>{`+${extraTags}`}</Chip> : null}
        </div>
      ) : null}

      <div className="jf-card__actions">
        <Button
          size="sm"
          variant={saved ? 'secondary' : 'ghost'}
          leftIcon={saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          aria-pressed={saved}
          onClick={() => onToggleSave(job)}
        >
          {saved ? 'Saved' : 'Save'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<CheckCircle2 size={14} />}
          aria-pressed={applied}
          disabled={applied}
          onClick={() => onMarkApplied(job)}
        >
          {applied ? 'Applied' : 'Mark applied'}
        </Button>
      </div>
    </div>
  );
});
