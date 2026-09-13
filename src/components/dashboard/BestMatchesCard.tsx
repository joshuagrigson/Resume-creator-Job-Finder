import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Radar } from 'lucide-react';
import type { Job, Resume } from '@shared/types';
import { matchLabel, scoreJobMatch } from '@shared/match';
import { resumeProfile } from '@/lib/resume/profile';
import { Card, EmptyState, MatchTone } from '@/components/ui';
import { useJobStore } from '@/stores/jobStore';
import './dashboard.css';

export interface BestMatchesCardProps {
  /** When absent, matches cannot be scored and the card nudges you to build a resume. */
  resume?: Resume;
  /** How many rows to show. */
  limit?: number;
  className?: string;
}

interface Scored {
  job: Job;
  score: number;
}

/** The strongest results from your last search, ranked against the active resume. */
export function BestMatchesCard({ resume, limit = 5, className }: BestMatchesCardProps) {
  const results = useJobStore((s) => s.results);
  const loading = useJobStore((s) => s.loading);
  const jobs = results?.jobs;

  const top = useMemo<Scored[]>(() => {
    if (!resume || !jobs || jobs.length === 0) return [];
    const profile = resumeProfile(resume);
    return jobs
      .map((job) => ({ job, score: scoreJobMatch(profile, job).score }))
      .sort((a, b) => b.score - a.score || a.job.title.localeCompare(b.job.title))
      .slice(0, limit);
  }, [jobs, limit, resume]);

  const subtitle = top.length > 0 ? `Best of your last ${results?.jobs.length ?? 0} results` : 'From your last search';

  return (
    <Card
      className={className}
      title="Best matches"
      subtitle={subtitle}
      footer={
        <Link className="small" to="/jobs">
          {top.length > 0 ? 'See all results' : 'Go to the job finder'}
        </Link>
      }
    >
      {top.length === 0 ? (
        <EmptyState
          plain
          size="sm"
          icon={<Radar size={20} aria-hidden="true" />}
          title={resume ? 'No results to rank yet' : 'Build a resume to see matches'}
          description={
            resume
              ? loading
                ? 'Your search is running — matches appear as soon as the boards respond.'
                : 'Run a search and the five closest roles to your resume land here.'
              : 'Match scores compare a job against your resume, so start one first — it takes a minute.'
          }
          actions={
            <Link className="small" to={resume ? '/jobs' : '/resume'}>
              {resume ? 'Search jobs' : 'Build a resume'}
            </Link>
          }
        />
      ) : (
        <ul className="db-list">
          {top.map(({ job, score }) => {
            const label = matchLabel(score);
            return (
              <li key={job.id}>
                <Link className="db-item" to={`/jobs/${encodeURIComponent(job.id)}`}>
                  <span className="db-item__body">
                    <span className="db-item__title truncate">{job.title}</span>
                    <span className="db-item__meta truncate">
                      {job.company} · {job.remote ? 'Remote' : job.location || 'Location not stated'}
                    </span>
                  </span>
                  <span className="db-item__side">
                    <MatchTone score={score} label={label.label} tone={label.tone} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default BestMatchesCard;
