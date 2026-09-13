import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, MapPin, Sparkles, Trash2 } from 'lucide-react';
import type { ApplicationStatus, TrackedJob } from '@shared/types';
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, JOB_SOURCE_LABELS } from '@shared/types';
import { Badge, Button, ConfirmDialog, Drawer, Field, Input, MatchTone, Select, Textarea } from '@/components/ui';
import { useDebouncedCallback } from '@/hooks';
import { useResumeList } from '@/stores/resumeStore';
import { useJobStore } from '@/stores/jobStore';
import { STATUS_TONE, ageLabel, followUpLabel, isFollowUpOverdue } from './utils';

export interface TrackedDetailProps {
  entry: TrackedJob | null;
  open: boolean;
  onClose: () => void;
  matchScore: number | null;
}

const STATUS_OPTIONS = APPLICATION_STATUSES.map((status) => ({
  value: status,
  label: APPLICATION_STATUS_LABELS[status],
}));

/**
 * Side drawer for a single application: status, autosaved notes, follow-up date, the resume used,
 * and the links out (posting, tailor, remove).
 */
export function TrackedDetail({ entry, open, onClose, matchScore }: TrackedDetailProps) {
  const setStatus = useJobStore((s) => s.setStatus);
  const setNotes = useJobStore((s) => s.setNotes);
  const setFollowUp = useJobStore((s) => s.setFollowUp);
  const setTrackedResume = useJobStore((s) => s.setTrackedResume);
  const untrackJob = useJobStore((s) => s.untrackJob);
  const resumes = useResumeList();

  const jobId = entry?.job.id ?? '';
  const [notes, setLocalNotes] = useState(entry?.notes ?? '');
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitNotes = useDebouncedCallback((id: string, value: string) => {
    setNotes(id, value);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2200);
  }, 400);

  // Re-seed the textarea whenever a *different* application opens (not on our own saves).
  const seededFor = useRef(jobId);
  const incomingNotes = entry?.notes ?? '';
  useEffect(() => {
    if (seededFor.current === jobId) return;
    seededFor.current = jobId;
    commitNotes.cancel();
    setLocalNotes(incomingNotes);
    setSaved(false);
  }, [jobId, incomingNotes, commitNotes]);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  if (!entry) return null;
  const { job } = entry;
  const overdue = isFollowUpOverdue(entry.followUpOn);
  const follow = followUpLabel(entry.followUpOn);

  return (
    <>
      <Drawer open={open} onClose={onClose} side="right" size={460} title={job.title}>
        <div className="tr-detail stack-4">
          <div className="tr-detail-head">
            <p className="tr-detail-company">{job.company || 'Unknown company'}</p>
            <p className="tr-detail-sub">
              {job.location && (
                <span className="tr-detail-loc">
                  <MapPin size={12} aria-hidden="true" /> {job.location}
                </span>
              )}
              <Badge tone="neutral" variant="outline" size="sm">
                {JOB_SOURCE_LABELS[job.source] ?? job.source}
              </Badge>
              {job.remote && (
                <Badge tone="info" variant="soft" size="sm">
                  Remote
                </Badge>
              )}
            </p>
            <div className="tr-detail-stats">
              <Badge tone={STATUS_TONE[entry.status]} variant="soft" dot>
                {APPLICATION_STATUS_LABELS[entry.status]}
              </Badge>
              {matchScore !== null && <MatchTone score={matchScore} showScore />}
              <span className="small muted">{ageLabel(entry)}</span>
            </div>
          </div>

          <Field label="Status">
            <Select
              value={entry.status}
              options={STATUS_OPTIONS}
              onChange={(e) => setStatus(job.id, e.target.value as ApplicationStatus)}
            />
          </Field>

          <Field
            label="Notes"
            hint={saved ? 'Notes saved' : 'Recruiter names, interview prep, salary talk — saved as you type.'}
          >
            <Textarea
              rows={6}
              value={notes}
              placeholder="Spoke with the recruiter on Tuesday; take-home due Friday."
              onChange={(e) => {
                setLocalNotes(e.target.value);
                commitNotes(job.id, e.target.value);
              }}
              onBlur={() => commitNotes.flush()}
            />
          </Field>

          <Field
            label="Follow up on"
            hint={follow ? (overdue ? `${follow} — worth a nudge.` : follow) : 'Set a date and the card flags itself when it is due.'}
          >
            <Input
              type="date"
              value={entry.followUpOn ?? ''}
              onChange={(e) => setFollowUp(job.id, e.target.value || undefined)}
            />
          </Field>

          <Field label="Resume used" hint={resumes.length === 0 ? 'Create a resume to link one here.' : undefined}>
            <Select
              value={entry.resumeId ?? ''}
              placeholder={resumes.length === 0 ? 'No resumes yet' : 'Not linked'}
              disabled={resumes.length === 0}
              options={resumes.map((r) => ({ value: r.id, label: r.name }))}
              onChange={(e) => setTrackedResume(job.id, e.target.value || undefined)}
            />
          </Field>

          <div className="tr-detail-actions">
            {job.url && (
              <a className="tr-detail-link" href={job.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} aria-hidden="true" />
                View posting
              </a>
            )}
            <Link className="tr-tailor-link" to={`/tailor/${encodeURIComponent(job.id)}`} onClick={onClose}>
              <Sparkles size={15} aria-hidden="true" />
              Tailor resume
            </Link>
            <Button variant="danger" leftIcon={<Trash2 size={15} />} onClick={() => setConfirming(true)}>
              Remove
            </Button>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirming}
        destructive
        title="Remove this application?"
        description={`"${job.title}" at ${job.company || 'this company'} will be deleted from your tracker. Notes and follow-up dates go with it.`}
        confirmLabel="Remove"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          untrackJob(job.id);
          onClose();
        }}
      />
    </>
  );
}
