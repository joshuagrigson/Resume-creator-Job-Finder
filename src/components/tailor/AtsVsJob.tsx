import { useMemo } from 'react';
import { AlertTriangle, CircleAlert, Lightbulb, ThumbsUp } from 'lucide-react';
import type { AtsIssue, Resume } from '@shared/types';
import { analyzeResume } from '@/lib/resume/ats';
import { Badge, Card, ScoreRing } from '@/components/ui';

export interface AtsVsJobProps {
  resume: Resume;
  jobText: string;
}

const SEVERITY_META = {
  critical: { tone: 'danger' as const, label: 'Critical', icon: <CircleAlert size={14} aria-hidden="true" /> },
  warning: { tone: 'warning' as const, label: 'Warning', icon: <AlertTriangle size={14} aria-hidden="true" /> },
  tip: { tone: 'info' as const, label: 'Tip', icon: <Lightbulb size={14} aria-hidden="true" /> },
};

/** The ATS report re-run against this specific posting, with the keyword category weighted in. */
export function AtsVsJob({ resume, jobText }: AtsVsJobProps) {
  const report = useMemo(() => analyzeResume(resume, jobText || undefined), [resume, jobText]);
  const coverage = report.keywordCoverage;

  return (
    <div className="tl-ats stack-4">
      <Card padding="sm">
        <div className="tl-ats-top">
          <ScoreRing name="ATS score against this job" value={report.score} size={84} label="ATS" />
          <div className="stack-2 grow">
            <p className="tl-ats-head">
              {report.score >= 80
                ? 'Strong against this posting.'
                : report.score >= 60
                  ? 'Solid, with a few gaps worth closing.'
                  : 'Needs work before you send it.'}
            </p>
            <p className="small muted">
              {report.stats.wordCount} words · {report.stats.bulletCount} bullets · {report.stats.quantifiedBullets} quantified ·
              about {report.stats.estimatedPages} page{report.stats.estimatedPages === 1 ? '' : 's'}
            </p>
            {coverage && (
              <p className="small muted">
                Keyword coverage vs this job: <strong>{coverage.percent}%</strong> ({coverage.matched.length} matched,{' '}
                {coverage.missing.length} missing)
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card title="Categories" padding="sm">
        <ul className="tl-cats">
          {report.categories.map((cat) => (
            <li key={cat.id}>
              <div className="tl-cat-row">
                <span className="tl-cat-label">{cat.label}</span>
                <span className="tl-cat-score">
                  {cat.score}
                  <span className="subtle"> / 100</span>
                </span>
              </div>
              <div
                className="tl-bar"
                role="meter"
                aria-valuenow={cat.score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${cat.label} score`}
              >
                <span
                  className="tl-bar-fill"
                  data-tone={cat.score >= 80 ? 'good' : cat.score >= 55 ? 'ok' : 'bad'}
                  style={{ width: `${Math.max(2, cat.score)}%` }}
                />
              </div>
              <span className="tl-cat-weight small subtle">weight {cat.weight}</span>
            </li>
          ))}
        </ul>
      </Card>

      {report.strengths.length > 0 && (
        <Card title="Working well" padding="sm">
          <ul className="tl-strengths">
            {report.strengths.map((s) => (
              <li key={s}>
                <ThumbsUp size={13} aria-hidden="true" />
                {s}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={`Issues (${report.issues.length})`} padding="sm">
        {report.issues.length === 0 ? (
          <p className="small muted">Nothing flagged. Send it.</p>
        ) : (
          <ul className="tl-issues">
            {report.issues.map((issue: AtsIssue) => {
              const meta = SEVERITY_META[issue.severity];
              return (
                <li key={issue.id}>
                  <div className="tl-issue-head">
                    <Badge tone={meta.tone} variant="soft" size="sm" leftIcon={meta.icon}>
                      {meta.label}
                    </Badge>
                    <span className="tl-issue-area">{issue.area}</span>
                    <span className="tl-issue-impact small subtle">−{issue.impact} pts</span>
                  </div>
                  <p className="tl-issue-msg">{issue.message}</p>
                  <p className="tl-issue-fix small muted">{issue.fix}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
