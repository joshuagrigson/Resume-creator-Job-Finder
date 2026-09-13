import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import type { Job } from '@shared/types';
import { JOB_SOURCE_LABELS } from '@shared/types';
import { Badge, Card, cx } from '@/components/ui';
import { sanitizeJobHtml } from './helpers';

export interface JdPreviewProps {
  /** The posting, when one is selected. Pasted text has no job. */
  job: Job | null;
  /** Plain text fallback (pasted descriptions, or postings with no HTML). */
  text: string;
}

/** Collapsible, sanitized preview of the job description that everything else is scored against. */
export function JdPreview({ job, text }: JdPreviewProps) {
  const [open, setOpen] = useState(false);
  const html = useMemo(() => (job?.descriptionHtml ? sanitizeJobHtml(job.descriptionHtml) : ''), [job?.descriptionHtml]);
  const plain = text.trim();

  if (!html && !plain) return null;

  const words = plain ? plain.split(/\s+/).filter(Boolean).length : 0;

  return (
    <Card padding="sm">
      <div className="tl-jd-head">
        <button type="button" className="tl-jd-toggle" aria-expanded={open} aria-controls="tl-jd-body" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          Job description
        </button>
        <span className="tl-jd-meta">
          {words > 0 && (
            <Badge tone="neutral" variant="outline" size="sm">
              {words} words
            </Badge>
          )}
          {job && (
            <Badge tone="neutral" variant="soft" size="sm">
              {JOB_SOURCE_LABELS[job.source] ?? job.source}
            </Badge>
          )}
        </span>
      </div>

      <div id="tl-jd-body" hidden={!open} className={cx('tl-jd-body')}>
        {html ? (
          <div className="tl-jd-html" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="tl-jd-text">{plain}</pre>
        )}
        {job?.url && (
          <a className="tl-jd-link" href={job.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={13} aria-hidden="true" />
            Open the original posting
          </a>
        )}
      </div>
    </Card>
  );
}
