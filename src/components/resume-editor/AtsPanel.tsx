/** ATS report: overall ring, per-category bars, issues grouped by severity, and strengths. */
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { AtsReport, AtsSeverity } from '@shared/types';
import { Badge, ScoreRing } from '@/components/ui';
import { atsScoreLabel, atsScoreTone } from '@/lib/resume/ats';
import './editor.css';

const SEVERITY_ORDER: AtsSeverity[] = ['critical', 'warning', 'tip'];

const SEVERITY_META: Record<AtsSeverity, { label: string; tone: 'danger' | 'warning' | 'info'; icon: ReactNode }> = {
  critical: { label: 'Fix first', tone: 'danger', icon: <XCircle size={15} aria-hidden="true" /> },
  warning: { label: 'Worth fixing', tone: 'warning', icon: <AlertTriangle size={15} aria-hidden="true" /> },
  tip: { label: 'Polish', tone: 'info', icon: <Info size={15} aria-hidden="true" /> },
};

export interface AtsPanelProps {
  report: AtsReport;
}

export function AtsPanel({ report }: AtsPanelProps) {
  const tone = atsScoreTone(report.score);

  return (
    <div className="re-ats stack-6">
      <div className="re-ats__head">
        <ScoreRing name="ATS score" value={report.score} size={84} thickness={8} label="ATS" tone={tone} />
        <div className="stack-1">
          <p className="re-ats__verdict">{atsScoreLabel(report.score)}</p>
          <p className="subtle small">
            {report.stats.bulletCount} bullets · {report.stats.quantifiedBullets} with numbers ·{' '}
            {report.stats.wordCount} words · ~{report.stats.estimatedPages} page
            {report.stats.estimatedPages === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <section className="stack-2" aria-labelledby="re-ats-cats">
        <h3 className="re-ats__h" id="re-ats-cats">
          Category scores
        </h3>
        <ul className="re-ats__cats">
          {report.categories.map((category) => (
            <li key={category.id} className="re-ats__cat">
              <div className="re-ats__catTop">
                <span className="re-ats__catName">{category.label}</span>
                <span className="re-ats__catScore">
                  {Math.round(category.score)}
                  <span className="subtle"> / 100</span>
                </span>
              </div>
              <div
                className="re-ats__bar"
                role="meter"
                aria-valuenow={Math.round(category.score)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${category.label} score`}
              >
                <span
                  className={`re-ats__barFill re-ats__barFill--${atsScoreTone(category.score)}`}
                  style={{ width: `${Math.max(2, Math.min(100, category.score))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {report.keywordCoverage ? (
        <section className="stack-2" aria-labelledby="re-ats-kw">
          <h3 className="re-ats__h" id="re-ats-kw">
            Keyword coverage
          </h3>
          <p className="small">
            <Badge tone={report.keywordCoverage.percent >= 60 ? 'success' : 'warning'} variant="soft">
              {Math.round(report.keywordCoverage.percent)}% matched
            </Badge>
          </p>
          {report.keywordCoverage.missing.length > 0 ? (
            <p className="small muted">Missing: {report.keywordCoverage.missing.slice(0, 12).join(', ')}</p>
          ) : null}
        </section>
      ) : null}

      <section className="stack-2" aria-labelledby="re-ats-issues">
        <h3 className="re-ats__h" id="re-ats-issues">
          Issues
        </h3>
        {report.issues.length === 0 ? (
          <p className="small muted">Nothing flagged — this resume passes every check.</p>
        ) : (
          SEVERITY_ORDER.map((severity) => {
            const issues = report.issues.filter((issue) => issue.severity === severity);
            if (issues.length === 0) return null;
            const meta = SEVERITY_META[severity];
            return (
              <div key={severity} className="stack-2">
                <h4 className="re-ats__group">
                  <Badge tone={meta.tone} variant="soft" leftIcon={meta.icon}>
                    {meta.label}
                  </Badge>
                  <span className="subtle small">
                    {issues.length} item{issues.length === 1 ? '' : 's'}
                  </span>
                </h4>
                <ul className="re-ats__issues">
                  {issues.map((issue) => (
                    <li key={issue.id} className={`re-ats__issue re-ats__issue--${severity}`}>
                      <p className="re-ats__issueMsg">{issue.message}</p>
                      <p className="re-ats__issueFix">{issue.fix}</p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>

      {report.strengths.length > 0 ? (
        <section className="stack-2" aria-labelledby="re-ats-strengths">
          <h3 className="re-ats__h" id="re-ats-strengths">
            Working well
          </h3>
          <ul className="re-ats__strengths">
            {report.strengths.map((strength, i) => (
              <li key={i}>
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
