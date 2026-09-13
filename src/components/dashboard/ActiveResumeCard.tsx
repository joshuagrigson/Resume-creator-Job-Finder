import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleAlert, CircleCheckBig, FileText, Lightbulb, TriangleAlert, Wand } from 'lucide-react';
import type { AtsIssue, AtsSeverity, Resume } from '@shared/types';
import { analyzeResume } from '@/lib/resume/ats';
import { Badge, Button, Card, ScoreRing } from '@/components/ui';
import { formatRelativeTime } from './utils';
import './dashboard.css';

export interface ActiveResumeCardProps {
  resume: Resume;
  /** How many other resumes exist, shown as context in the subtitle. */
  otherCount?: number;
  className?: string;
}

const ISSUE_ICONS: Record<AtsSeverity, typeof CircleAlert> = {
  critical: CircleAlert,
  warning: TriangleAlert,
  tip: Lightbulb,
};

const SEVERITY_WORD: Record<AtsSeverity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  tip: 'Tip',
};

function IssueRow({ issue }: { issue: AtsIssue }) {
  const Icon = ISSUE_ICONS[issue.severity];
  return (
    <li>
      <Link className={`db-issue db-issue--${issue.severity}`} to="/resume">
        <Icon className="db-issue__icon" size={16} aria-hidden="true" />
        <span className="db-issue__body">
          <span className="db-issue__message">
            <span className="visually-hidden">{SEVERITY_WORD[issue.severity]}: </span>
            {issue.message}
          </span>
          <span className="db-issue__fix">{issue.fix}</span>
        </span>
      </Link>
    </li>
  );
}

/** The resume you are working on: identity, ATS score and the three things worth fixing next. */
export function ActiveResumeCard({ resume, otherCount = 0, className }: ActiveResumeCardProps) {
  const navigate = useNavigate();
  const report = useMemo(() => analyzeResume(resume), [resume]);
  const topIssues = report.issues.slice(0, 3);
  const name = resume.contact.fullName.trim() || resume.name.trim() || 'Untitled resume';
  const headline = resume.contact.headline.trim();

  return (
    <Card
      className={className}
      title="Active resume"
      subtitle={otherCount > 0 ? `${otherCount} other resume${otherCount === 1 ? '' : 's'} saved` : 'Your working copy'}
      actions={
        <Button size="sm" leftIcon={<FileText size={14} />} onClick={() => navigate('/resume')}>
          Open editor
        </Button>
      }
      footer={
        <div className="row row-wrap row-between" style={{ width: '100%', gap: 'var(--space-3)' }}>
          <Link className="small" to="/resume">
            Fix these in the editor
          </Link>
          <Link className="row small" to="/tailor">
            <Wand size={14} aria-hidden="true" />
            Tailor for a job
          </Link>
        </div>
      }
    >
      <div className="db-resume">
        <div className="db-resume__ring">
          <ScoreRing name="ATS score" value={report.score} size={78} />
          <span className="db-resume__ring-label">ATS score</span>
        </div>

        <div className="db-resume__main">
          <h3 className="db-resume__name">{name}</h3>
          {headline ? (
            <p className="db-resume__headline">{headline}</p>
          ) : (
            <p className="muted">Add a headline so recruiters see your target role first.</p>
          )}
          <div className="db-resume__meta">
            <span>Updated {formatRelativeTime(resume.updatedAt)}</span>
            <span aria-hidden="true">·</span>
            <span>{report.stats.wordCount} words</span>
            <span aria-hidden="true">·</span>
            <span>
              {report.stats.estimatedPages} page{report.stats.estimatedPages === 1 ? '' : 's'}
            </span>
          </div>
          <div className="row row-wrap" style={{ marginTop: 'var(--space-3)' }}>
            <Badge tone="neutral" variant="outline">
              {resume.name}
            </Badge>
            <Badge tone="accent" variant="soft">
              {resume.style.template}
            </Badge>
          </div>
        </div>
      </div>

      {topIssues.length > 0 ? (
        <>
          <p className="db-issues__heading" style={{ marginTop: 'var(--space-5)' }}>
            Top fixes
          </p>
          <ul className="db-issues">
            {topIssues.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </ul>
        </>
      ) : (
        <p className="db-strength">
          <CircleCheckBig size={16} aria-hidden="true" />
          No blocking issues — this resume reads clean to an ATS.
        </p>
      )}
    </Card>
  );
}

export default ActiveResumeCard;
