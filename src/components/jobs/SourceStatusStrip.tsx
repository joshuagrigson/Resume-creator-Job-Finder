import type { SourceReport } from '@shared/types';
import { Tooltip } from '@/components/ui';
import { formatDuration, sourceLabel, sourceStatusMeta } from './format';
import './jobs.css';

export interface SourceStatusStripProps {
  sources: readonly SourceReport[];
  className?: string;
}

function Pill({ report }: { report: SourceReport }) {
  const meta = sourceStatusMeta(report.status);
  const timing = formatDuration(report.ms);
  const detail = report.status === 'ok' ? `${report.count} job${report.count === 1 ? '' : 's'}` : meta.label;

  const pill = (
    <span
      className={`jf-sourcepill jf-sourcepill--${meta.tone}`}
      data-testid="source-pill"
      data-source={report.source}
      data-status={report.status}
    >
      <span className="jf-sourcepill__dot" aria-hidden="true" />
      <span className="jf-sourcepill__name">{sourceLabel(report.source)}</span>
      <span>{detail}</span>
      {timing && report.status !== 'disabled' && report.status !== 'skipped' ? <span>· {timing}</span> : null}
      {report.error ? <span className="visually-hidden">{report.error}</span> : null}
    </span>
  );

  if (report.status === 'ok' || !report.error) return pill;
  return (
    <Tooltip content={report.error} side="top">
      {pill}
    </Tooltip>
  );
}

/** Honest per-board report for the last search: who answered, with what and how fast. */
export function SourceStatusStrip({ sources, className }: SourceStatusStripProps) {
  if (!sources || sources.length === 0) return null;
  const ok = sources.filter((s) => s.status === 'ok').length;

  return (
    <div className={className ? `jf-sourcestrip ${className}` : 'jf-sourcestrip'} aria-label="Job board status">
      <span className="jf-sourcestrip__title">
        {ok} of {sources.length} boards responded
      </span>
      {sources.map((report) => (
        <Pill key={report.source} report={report} />
      ))}
    </div>
  );
}
